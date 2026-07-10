import type { User } from 'firebase/auth';
import { ADMIN_UIDS, RENRAKU_ADMIN_EMAIL_FALLBACK } from '../constants/renrakuAdmin';

/** Gmail / Googlemail: ドット無視・googlemail は gmail と同一（`firestore.rules` の正規化と揃える） */
export function normalizeEmailForRenrakuAdmin(email: string): string {
  const t = email.trim().toLowerCase();
  const at = t.lastIndexOf('@');
  if (at <= 0) return t;
  let local = t.slice(0, at);
  let domain = t.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

function collectEmails(user: User): string[] {
  const out: string[] = [];
  if (user.email) out.push(user.email);
  for (const p of user.providerData ?? []) {
    if (p?.email) out.push(p.email);
  }
  return out;
}

const canonicalAdminEmail = normalizeEmailForRenrakuAdmin(RENRAKU_ADMIN_EMAIL_FALLBACK);

/**
 * 管理者: 列挙 UID のいずれか、または正規化後メールが akasirakuda@gmail.com と一致（ルールの isAdmin と対応）。
 */
export function isRenrakuAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  if (ADMIN_UIDS.includes(user.uid)) return true;
  return collectEmails(user).some((e) => normalizeEmailForRenrakuAdmin(e) === canonicalAdminEmail);
}

/**
 * Firestore ルールの isAdmin() は ID トークン（email クレーム）で判定する。
 * クライアントだけ isRenrakuAdmin=true でも、トークンが古いと一覧が permission-denied になることがある。
 */
export async function ensureRenrakuAdminFirestoreAuth(user: User | null | undefined): Promise<boolean> {
  if (!user || !isRenrakuAdmin(user)) return false;
  try {
    await user.getIdToken(true);
    return true;
  } catch (e) {
    console.warn('[renrakuAdmin] getIdToken(true) failed', e);
    return false;
  }
}
