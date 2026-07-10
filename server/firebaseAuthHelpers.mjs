/** Firebase Bearer 認証・連絡帳管理者判定（firestore.rules / renrakuAdmin.ts と同一 UID） */

const RENRAKU_ADMIN_UIDS = ['6YGjqqBB0RejB5N01WUYupEogh53'];
const RENRAKU_ADMIN_EMAIL = 'akasirakuda@gmail.com';

function normalizedRenrakuAdminEmail(email) {
  const t = String(email ?? '')
    .trim()
    .toLowerCase();
  const parts = t.split('@');
  if (parts.length !== 2) return t;
  const [local, domain] = parts;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.replace(/\./g, '')}@gmail.com`;
  }
  return t;
}

export async function verifyBearerUid(auth, req) {
  const authz = String(req.headers.authorization ?? '').trim();
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) return null;
  try {
    const decoded = await auth.verifyIdToken(m[1].trim());
    return String(decoded?.uid ?? '').trim() || null;
  } catch {
    return null;
  }
}

export async function verifyBearerDecoded(auth, req) {
  const authz = String(req.headers.authorization ?? '').trim();
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) return null;
  try {
    return await auth.verifyIdToken(m[1].trim());
  } catch {
    return null;
  }
}

export function isRenrakuAdminDecoded(decoded) {
  if (!decoded?.uid) return false;
  if (RENRAKU_ADMIN_UIDS.includes(String(decoded.uid))) return true;
  const email = decoded.email;
  if (typeof email !== 'string' || !email.trim()) return false;
  return normalizedRenrakuAdminEmail(email) === normalizedRenrakuAdminEmail(RENRAKU_ADMIN_EMAIL);
}

export async function verifyRenrakuAdmin(auth, req) {
  const decoded = await verifyBearerDecoded(auth, req);
  if (!decoded || !isRenrakuAdminDecoded(decoded)) return null;
  return String(decoded.uid);
}
