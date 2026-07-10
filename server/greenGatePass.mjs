/**
 * 緑ゲート — 感謝の1年無料パス（緑券相当）
 * Firestore: rk_green_pass/{code}（サーバーのみ書込）→ rk_green_gate/{uid}
 */

import { verifyBearerUid, verifyRenrakuAdmin } from './firebaseAuthHelpers.mjs';

const PASS_COLLECTION = 'rk_green_pass';
const REFERRER_COLLECTION = 'rk_green_referrer';
const GATE_COLLECTION = 'rk_green_gate';
const PASS_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_CREATE_COUNT = 20;
const LIST_LIMIT = 80;

function normalizePassCode(raw) {
  const compact = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
  if (!/^RK[A-Z0-9]{8}$/.test(compact)) return null;
  return `${compact.slice(0, 2)}-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
}

function randomPassSegment(len) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += PASS_CODE_CHARS[Math.floor(Math.random() * PASS_CODE_CHARS.length)];
  }
  return out;
}

async function generateUniquePassCode(db) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `RK-${randomPassSegment(4)}-${randomPassSegment(4)}`;
    const snap = await db.collection(PASS_COLLECTION).doc(code).get();
    if (!snap.exists) return code;
  }
  throw new Error('pass_code_collision');
}

function addCalendarYear(fromMs) {
  const d = new Date(fromMs);
  d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
}

function readStoredMs(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function trimText(raw, maxLen) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.slice(0, maxLen);
}

function newReferrerId() {
  return `ref_${randomPassSegment(4)}_${randomPassSegment(4)}`;
}

function newBatchId() {
  return `batch_${randomPassSegment(4)}_${randomPassSegment(4)}`;
}

function referrerSnapshot(data) {
  if (!data || typeof data !== 'object') return null;
  const name = trimText(data.name, 80);
  if (!name) return null;
  return {
    name,
    facility: trimText(data.facility, 80),
    introducedBy: trimText(data.introducedBy, 80),
    note: trimText(data.note, 200),
    advocate: data.advocate === true,
  };
}

async function resolveReferrerForIssue(db, body, adminUid, FieldValue) {
  const referrerIdRaw = trimText(body.referrerId, 40);
  const inline = referrerSnapshot(body.referrer);

  if (referrerIdRaw) {
    const ref = db.collection(REFERRER_COLLECTION).doc(referrerIdRaw);
    const snap = await ref.get();
    if (!snap.exists) return { error: 'referrer_not_found' };
    const data = snap.data() ?? {};
    await ref.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        lastIssuedAt: FieldValue.serverTimestamp(),
        ...(inline?.note ? { note: inline.note } : {}),
        ...(inline?.advocate != null ? { advocate: inline.advocate } : {}),
      },
      { merge: true },
    );
    return {
      referrerId: referrerIdRaw,
      referrerName: trimText(data.name, 80),
      referrerFacility: trimText(data.facility, 80),
      introducedBy: trimText(data.introducedBy, 80),
      advocate: data.advocate === true,
    };
  }

  if (!inline) return { referrerId: '', referrerName: '', referrerFacility: '', introducedBy: '', advocate: false };

  const referrerId = newReferrerId();
  await db.collection(REFERRER_COLLECTION).doc(referrerId).set({
    name: inline.name,
    facility: inline.facility,
    introducedBy: inline.introducedBy,
    note: inline.note,
    advocate: inline.advocate,
    issuedCount: 0,
    redeemedCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastIssuedAt: FieldValue.serverTimestamp(),
    createdByUid: adminUid,
  });

  return {
    referrerId,
    referrerName: inline.name,
    referrerFacility: inline.facility,
    introducedBy: inline.introducedBy,
    advocate: inline.advocate,
  };
}

async function bumpReferrerIssued(db, referrerId, count, FieldValue) {
  if (!referrerId) return;
  const ref = db.collection(REFERRER_COLLECTION).doc(referrerId);
  await ref.set(
    {
      issuedCount: FieldValue.increment(count),
      updatedAt: FieldValue.serverTimestamp(),
      lastIssuedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function bumpReferrerRedeemed(db, referrerId, FieldValue) {
  if (!referrerId) return;
  const ref = db.collection(REFERRER_COLLECTION).doc(referrerId);
  await ref.set(
    {
      redeemedCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      lastRedeemedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export function registerGreenGatePassApi(app, { getFirebaseAdmin }) {
  app.post(['/api/green-pass/redeem', '/api/green-pass/redeem/'], async (req, res) => {
    try {
      const { auth, db } = await getFirebaseAdmin();
      const uid = await verifyBearerUid(auth, req);
      if (!uid) {
        res.status(401).json({ ok: false, error: 'auth_required' });
        return;
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const code = normalizePassCode(body.code);
      if (!code) {
        res.status(400).json({ ok: false, error: 'invalid_code' });
        return;
      }

      const passRef = db.collection(PASS_COLLECTION).doc(code);
      const gateRef = db.collection(GATE_COLLECTION).doc(uid);
      const { FieldValue } = await import('firebase-admin/firestore');

      const result = await db.runTransaction(async (tx) => {
        const passSnap = await tx.get(passRef);
        if (!passSnap.exists) return { error: 'not_found' };
        const pass = passSnap.data() ?? {};
        if (pass.revoked === true) return { error: 'revoked' };
        if (pass.redeemedByUid) return { error: 'already_redeemed' };

        const gateSnap = await tx.get(gateRef);
        const prev = gateSnap.exists ? gateSnap.data() : null;
        const prevUntil = readStoredMs(prev?.greenUntilMs) ?? 0;
        const now = Date.now();
        const baseMs = Math.max(now, prevUntil);
        const greenUntilMs = addCalendarYear(baseMs);
        const prevContract = readStoredMs(prev?.contractAtMs);
        const label =
          typeof pass.label === 'string' && pass.label.trim() ? pass.label.trim() : '感謝の1年無料パス';

        tx.set(
          passRef,
          {
            redeemedAt: FieldValue.serverTimestamp(),
            redeemedByUid: uid,
          },
          { merge: true },
        );

        tx.set(
          gateRef,
          {
            greenUntilMs,
            contractAtMs: prevContract ?? now,
            status: 'gift',
            source: 'gratitude_pass',
            gratitudePassCode: code,
            gratitudePassLabel: label,
            ...(typeof pass.referrerId === 'string' && pass.referrerId
              ? { gratitudePassReferrerId: pass.referrerId }
              : {}),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        return { greenUntilMs, label, referrerId: pass.referrerId ?? '' };
      });

      if (result.error) {
        const status = result.error === 'not_found' ? 404 : 409;
        res.status(status).json({ ok: false, error: result.error });
        return;
      }

      if (result.referrerId) {
        const { FieldValue } = await import('firebase-admin/firestore');
        await bumpReferrerRedeemed(db, result.referrerId, FieldValue);
      }

      res.status(200).json({
        ok: true,
        greenUntilMs: result.greenUntilMs,
        label: result.label,
      });
    } catch (e) {
      console.error('[green-pass/redeem]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  app.post(['/api/green-pass/admin/create', '/api/green-pass/admin/create/'], async (req, res) => {
    try {
      const { auth, db } = await getFirebaseAdmin();
      const adminUid = await verifyRenrakuAdmin(auth, req);
      if (!adminUid) {
        res.status(403).json({ ok: false, error: 'admin_required' });
        return;
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const countRaw = Number(body.count ?? 1);
      const count = Number.isFinite(countRaw) ? Math.min(MAX_CREATE_COUNT, Math.max(1, Math.floor(countRaw))) : 1;
      const label =
        typeof body.label === 'string' && body.label.trim()
          ? body.label.trim().slice(0, 80)
          : '感謝の1年無料パス';
      const origin = String(process.env.APP_PUBLIC_ORIGIN ?? 'https://rakuda.coffee')
        .trim()
        .replace(/\/+$/, '');
      const { FieldValue } = await import('firebase-admin/firestore');

      const referrerResolved = await resolveReferrerForIssue(db, body, adminUid, FieldValue);
      if (referrerResolved.error) {
        res.status(400).json({ ok: false, error: referrerResolved.error });
        return;
      }

      const batchId = newBatchId();
      const passes = [];
      for (let i = 0; i < count; i += 1) {
        const code = await generateUniquePassCode(db);
        await db.collection(PASS_COLLECTION).doc(code).set({
          code,
          label,
          durationKind: 'calendar_1y',
          batchId,
          createdAt: FieldValue.serverTimestamp(),
          createdByUid: adminUid,
          redeemedAt: null,
          redeemedByUid: null,
          revoked: false,
          ...(referrerResolved.referrerId
            ? {
                referrerId: referrerResolved.referrerId,
                referrerName: referrerResolved.referrerName,
                referrerFacility: referrerResolved.referrerFacility,
                introducedBy: referrerResolved.introducedBy,
                referrerAdvocate: referrerResolved.advocate,
              }
            : {}),
        });
        passes.push({
          code,
          redeemUrl: `${origin}/?green_pass=${encodeURIComponent(code)}`,
        });
      }

      if (referrerResolved.referrerId) {
        await bumpReferrerIssued(db, referrerResolved.referrerId, count, FieldValue);
      }

      res.status(200).json({
        ok: true,
        passes,
        label,
        batchId,
        referrerId: referrerResolved.referrerId || null,
        referrerName: referrerResolved.referrerName || null,
      });
    } catch (e) {
      console.error('[green-pass/admin/create]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  app.get(['/api/green-pass/admin/list', '/api/green-pass/admin/list/'], async (req, res) => {
    try {
      const { auth, db } = await getFirebaseAdmin();
      const adminUid = await verifyRenrakuAdmin(auth, req);
      if (!adminUid) {
        res.status(403).json({ ok: false, error: 'admin_required' });
        return;
      }

      const snap = await db
        .collection(PASS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(LIST_LIMIT)
        .get();

      const origin = String(process.env.APP_PUBLIC_ORIGIN ?? 'https://rakuda.coffee')
        .trim()
        .replace(/\/+$/, '');

      const passes = snap.docs.map((d) => {
        const data = d.data();
        const code = d.id;
        const redeemedByUid = typeof data.redeemedByUid === 'string' ? data.redeemedByUid : null;
        return {
          code,
          label: typeof data.label === 'string' ? data.label : '',
          batchId: typeof data.batchId === 'string' ? data.batchId : '',
          referrerId: typeof data.referrerId === 'string' ? data.referrerId : '',
          referrerName: typeof data.referrerName === 'string' ? data.referrerName : '',
          referrerFacility: typeof data.referrerFacility === 'string' ? data.referrerFacility : '',
          introducedBy: typeof data.introducedBy === 'string' ? data.introducedBy : '',
          referrerAdvocate: data.referrerAdvocate === true,
          createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
          redeemedByUid,
          revoked: data.revoked === true,
          status: redeemedByUid ? 'redeemed' : data.revoked === true ? 'revoked' : 'available',
          redeemUrl: `${origin}/?green_pass=${encodeURIComponent(code)}`,
        };
      });

      res.status(200).json({ ok: true, passes });
    } catch (e) {
      console.error('[green-pass/admin/list]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  app.get(['/api/green-pass/admin/referrers', '/api/green-pass/admin/referrers/'], async (req, res) => {
    try {
      const { auth, db } = await getFirebaseAdmin();
      const adminUid = await verifyRenrakuAdmin(auth, req);
      if (!adminUid) {
        res.status(403).json({ ok: false, error: 'admin_required' });
        return;
      }

      const snap = await db
        .collection(REFERRER_COLLECTION)
        .orderBy('lastIssuedAt', 'desc')
        .limit(100)
        .get();

      const referrers = snap.docs.map((d) => {
        const data = d.data();
        const issued = Number(data.issuedCount ?? 0);
        const redeemed = Number(data.redeemedCount ?? 0);
        return {
          id: d.id,
          name: typeof data.name === 'string' ? data.name : '',
          facility: typeof data.facility === 'string' ? data.facility : '',
          introducedBy: typeof data.introducedBy === 'string' ? data.introducedBy : '',
          note: typeof data.note === 'string' ? data.note : '',
          advocate: data.advocate === true,
          issuedCount: Number.isFinite(issued) ? issued : 0,
          redeemedCount: Number.isFinite(redeemed) ? redeemed : 0,
          availableCount: Math.max(0, (Number.isFinite(issued) ? issued : 0) - (Number.isFinite(redeemed) ? redeemed : 0)),
        };
      });

      res.status(200).json({ ok: true, referrers });
    } catch (e) {
      console.error('[green-pass/admin/referrers]', e);
      res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });
}
