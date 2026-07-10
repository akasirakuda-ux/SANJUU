/**
 * らくだ本体 `src/lib/renrakuAdmin.ts` / `src/constants/renrakuAdmin.ts` と同内容を維持すること。
 * thirty は Vite 本体を import しないため、クライアント判定だけ複製する。
 */
import type { User } from 'firebase/auth';

export const ADMIN_UIDS: readonly string[] = [
  '6YGjqqBB0RejB5N01WUYupEogh53',
  /** 旧表記（l/I 取り違え防止で両方保持） */
  'e64TlfCKEnOB8DeqCwobZUasnHT2',
  /** akasirakuda@gmail.com（本番で確認した UID） */
  'e64TIfCKEnO8BDEqCwobZUasnHT2',
];

export function isProtectedRenrakuAdminUid(uid: string | null | undefined): boolean {
  const id = String(uid ?? '').trim();
  return id.length > 0 && ADMIN_UIDS.includes(id);
}

export const RENRAKU_ADMIN_EMAIL_FALLBACK = 'akasirakuda@gmail.com';

export type AuthLoginTone = 'google' | 'guest' | 'none' | 'loading';

export type AuthLoginDisplay = {
  label: string;
  title?: string;
  tone: AuthLoginTone;
};

function normalizeEmailForRenrakuAdmin(email: string): string {
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

export function isRenrakuAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  if (ADMIN_UIDS.includes(user.uid)) return true;
  return collectEmails(user).some((e) => normalizeEmailForRenrakuAdmin(e) === canonicalAdminEmail);
}

function hasGoogleProvider(user: User): boolean {
  return (user.providerData ?? []).some((p) => p.providerId === 'google.com');
}

/** 右上バッジ 1 行目（らくだ AppHeader と同じ文言・トーン） */
export function getAuthLoginDisplay(user: User | null | undefined, isAuthReady: boolean): AuthLoginDisplay {
  if (!isAuthReady) {
    return { label: '確認中…', tone: 'loading' };
  }
  if (!user) {
    return { label: '未ログイン', title: 'タップして Google でログイン', tone: 'none' };
  }
  const google = hasGoogleProvider(user) || (!user.isAnonymous && !!user.email);
  if (google) {
    const email = (user.email ?? '').trim();
    const admin = isRenrakuAdmin(user);
    return {
      label: admin ? 'ログイン（管理者）' : 'ログイン',
      title: email || undefined,
      tone: 'google',
    };
  }
  if (user.isAnonymous) {
    return {
      label: 'ゲスト',
      title: '匿名ログイン。Google でログインすると記録の同期が安定します',
      tone: 'guest',
    };
  }
  return { label: 'ログイン', title: user.email ?? undefined, tone: 'google' };
}
