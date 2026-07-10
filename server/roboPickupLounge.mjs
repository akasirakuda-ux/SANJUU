/**
 * 🤖 らくだロボ / 🎮 絵文字ロボ 常設ひと言探し — 初回シード用 cron + ensure
 */

const LOUNGE_PROFILES = [
  {
    roomId: 'robo-pickup-lounge',
    publicId: 'robo-pickup-lounge',
    hostUid: '__robo_pickup_lounge__',
    hostNickname: 'らくだロボ',
    hostEmoji: '🤖',
    forcedCharset: null,
  },
  {
    roomId: 'robo-pickup-lounge-emoji',
    publicId: 'robo-pickup-lounge-emoji',
    hostUid: '__robo_pickup_lounge_emoji__',
    hostNickname: '絵文字ロボ',
    hostEmoji: '🎮',
    forcedCharset: 'emoji',
  },
];

const COLS = 10;
const ROWS = 10;

let _core = null;

async function getCore() {
  if (_core) return _core;
  _core = await import('./roboPickupLoungeCore.bundle.mjs');
  return _core;
}

function readCronSecret() {
  return String(process.env.ROBO_PICKUP_CRON_SECRET ?? '').trim();
}

function isCronAuthorized(req) {
  const secret = readCronSecret();
  if (!secret) return false;
  const header = String(req.headers['x-robo-pickup-cron-secret'] ?? '').trim();
  return header.length > 0 && header === secret;
}

function roboLoungeBoardSizeMismatch(d) {
  const cols = Number(d?.boardCols ?? d?.boardSize ?? 0);
  const rows = Number(d?.boardRows ?? 0);
  const gridRowCount = Array.isArray(d?.gridRows) ? d.gridRows.length : 0;
  if (cols > 0 && cols !== COLS) return true;
  if (rows > 0 && rows !== ROWS) return true;
  if (gridRowCount > 0 && gridRowCount !== ROWS) return true;
  return false;
}

function roomNeedsRoboLoungeSeed(d) {
  if (roboLoungeBoardSizeMismatch(d)) return true;
  const targetWord = String(d?.targetWord ?? '').trim();
  const hasGrid = Array.isArray(d?.gridRows) && d.gridRows.length > 0;
  return !targetWord || !hasGrid || d?.problemsReady === false;
}

async function ensureLoungeDocuments(db, FieldValue, profile) {
  const roomRef = db.collection('hundred_rooms').doc(profile.roomId);
  const publicRef = db.collection('hundred_public').doc(profile.publicId);
  const [roomSnap, publicSnap] = await Promise.all([roomRef.get(), publicRef.get()]);

  const ts = FieldValue.serverTimestamp();
  const farFuture = new Date('2099-01-01T00:00:00+09:00');

  if (!publicSnap.exists) {
    const publicData = {
      type: 'hundred',
      roomId: profile.roomId,
      roboPickupLounge: true,
      targetWord: '',
      hostUid: profile.hostUid,
      hostNickname: profile.hostNickname,
      hostEmoji: profile.hostEmoji,
      hundredMode: 'pickup',
      hintsEnabled: false,
      gameTimeLimitSec: 0,
      boardSize: COLS,
      boardCols: COLS,
      boardRows: ROWS,
      recruitDeadlineAt: farFuture,
      createdAt: ts,
      updatedAt: ts,
    };
    if (profile.forcedCharset) {
      publicData.pickupCharset = profile.forcedCharset;
    }
    await publicRef.set(publicData);
  }

  if (!roomSnap.exists) {
    const roomData = {
      status: 'recruiting',
      roboPickupLounge: true,
      hostUid: profile.hostUid,
      hostNickname: profile.hostNickname,
      hostEmoji: profile.hostEmoji,
      hundredMode: 'pickup',
      hintsEnabled: false,
      gameTimeLimitSec: 0,
      boardSize: COLS,
      boardCols: COLS,
      boardRows: ROWS,
      publicRecruitId: profile.publicId,
      recruitDeadlineAt: farFuture,
      targetWord: '',
      createdAt: ts,
      updatedAt: ts,
      problemsGenerating: false,
      problemsReady: false,
    };
    if (profile.forcedCharset) {
      roomData.pickupCharset = profile.forcedCharset;
    }
    await roomRef.set(roomData);
  }
}

async function refreshLoungeCron(db, FieldValue, profile) {
  const core = await getCore();
  const roomRef = db.collection('hundred_rooms').doc(profile.roomId);

  const lock = await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) return { ok: false, reason: 'missing' };
    const d = snap.data() || {};
    if (d.problemsGenerating === true && !roboLoungeBoardSizeMismatch(d)) {
      return { ok: false, reason: 'generating' };
    }
    tx.set(roomRef, { problemsGenerating: true, problemsReady: false }, { merge: true });
    return {
      ok: true,
      previousTargetWord: String(d.targetWord ?? '').trim(),
      previousCharset: d.pickupCharset ?? null,
    };
  });

  if (!lock.ok) {
    return { ok: false, reason: lock.reason, roomId: profile.roomId };
  }

  try {
    const payload = core.buildRoboLoungeRefreshPayload({
      previousTargetWord: lock.previousTargetWord,
      previousCharset: lock.previousCharset,
      exclude: lock.previousTargetWord ? [lock.previousTargetWord] : [],
      profile: {
        roomId: profile.roomId,
        publicId: profile.publicId,
        hostUid: profile.hostUid,
        hostNickname: profile.hostNickname,
        hostEmoji: profile.hostEmoji,
        forcedCharset: profile.forcedCharset,
      },
    });
    if (!payload) {
      await roomRef.set({ problemsGenerating: false }, { merge: true });
      return { ok: false, reason: 'generate_failed', roomId: profile.roomId };
    }

    const ts = FieldValue.serverTimestamp();
    await roomRef.set(
      {
        status: 'playing',
        hundredMode: 'pickup',
        roboPickupLounge: true,
        hostUid: profile.hostUid,
        hostNickname: profile.hostNickname,
        hostEmoji: profile.hostEmoji,
        pickupCharset: payload.pickupCharset,
        gridRows: payload.gridRows,
        words: payload.words,
        targetWord: payload.targetWord,
        boardSize: payload.boardCols,
        boardCols: payload.boardCols,
        boardRows: payload.boardRows,
        gameTimeLimitSec: 0,
        hintsEnabled: false,
        foundWords: [],
        endReason: null,
        endedAt: null,
        startedAt: ts,
        startedBy: profile.hostUid,
        problemsGenerating: false,
        problemsReady: true,
        updatedAt: ts,
      },
      { merge: true },
    );

    await db
      .collection('hundred_public')
      .doc(profile.publicId)
      .set(
        {
          targetWord: payload.targetWord,
          pickupCharset: payload.pickupCharset,
          boardSize: payload.boardCols,
          boardCols: payload.boardCols,
          boardRows: payload.boardRows,
          updatedAt: ts,
        },
        { merge: true },
      );

    return {
      ok: true,
      roomId: profile.roomId,
      targetWord: payload.targetWord,
      pickupCharset: payload.pickupCharset,
    };
  } catch (e) {
    console.error('[roboPickupLounge] cron refresh failed', profile.roomId, e);
    await roomRef.set({ problemsGenerating: false }, { merge: true }).catch(() => {});
    return { ok: false, reason: 'error', roomId: profile.roomId };
  }
}

async function ensureAllLounges(db, FieldValue) {
  for (const profile of LOUNGE_PROFILES) {
    await ensureLoungeDocuments(db, FieldValue, profile);
  }
}

async function seedLoungesIfNeeded(db, FieldValue) {
  const results = [];
  for (const profile of LOUNGE_PROFILES) {
    const roomSnap = await db.collection('hundred_rooms').doc(profile.roomId).get();
    const d = roomSnap.data() || {};
    if (!roomNeedsRoboLoungeSeed(d)) {
      results.push({ roomId: profile.roomId, skipped: 'round_in_progress' });
      continue;
    }
    const result = await refreshLoungeCron(db, FieldValue, profile);
    results.push({ ...result, seeded: result.ok });
  }
  return results;
}

export function registerRoboPickupLoungeApi(app, { getFirebaseAdmin }) {
  app.post(['/api/robo-pickup/cron', '/api/robo-pickup/cron/'], async (req, res) => {
    if (!isCronAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    try {
      const { db } = await getFirebaseAdmin();
      const { FieldValue } = await import('firebase-admin/firestore');
      await ensureAllLounges(db, FieldValue);
      const results = await seedLoungesIfNeeded(db, FieldValue);
      const anyFailed = results.some((r) => r.ok === false && r.reason !== 'generating');
      if (anyFailed) {
        res.status(500).json({ ok: false, results });
        return;
      }
      res.json({ ok: true, results });
    } catch (e) {
      console.error('[roboPickupLounge] cron', e);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });

  app.post(['/api/robo-pickup/ensure', '/api/robo-pickup/ensure/'], async (req, res) => {
    if (!isCronAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    try {
      const { db } = await getFirebaseAdmin();
      const { FieldValue } = await import('firebase-admin/firestore');
      await ensureAllLounges(db, FieldValue);
      const results = await seedLoungesIfNeeded(db, FieldValue);
      res.json({ ok: true, results });
    } catch (e) {
      console.error('[roboPickupLounge] ensure', e);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  });
}
