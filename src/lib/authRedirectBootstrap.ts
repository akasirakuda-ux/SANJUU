import type { User } from 'firebase/auth';
import { auth, authRedirectResultPromise } from '../firebase';

export const GOOGLE_LOGIN_PENDING_KEY = 'rk_google_login_pending_v1';

/** firebase.ts で起動時に開始済み。二重呼び出ししない */
export function consumeGoogleRedirectResult() {
  return authRedirectResultPromise;
}

export function isGoogleLoginPending(): boolean {
  try {
    return sessionStorage.getItem(GOOGLE_LOGIN_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGoogleLoginPending(): void {
  try {
    sessionStorage.setItem(GOOGLE_LOGIN_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearGoogleLoginPending(): void {
  try {
    sessionStorage.removeItem(GOOGLE_LOGIN_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function isGoogleSignedInUser(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous) return false;
  return (
    (user.providerData ?? []).some((p) => p.providerId === 'google.com') || !!user.email
  );
}

/** 連絡帳内の Auth と App シェルの Auth のうち、Google ログインを優先して採用 */
export function pickEffectiveAuthUser(
  primary: User | null | undefined,
  fallback: User | null | undefined
): User | null {
  if (isGoogleSignedInUser(primary)) return primary ?? null;
  if (isGoogleSignedInUser(fallback)) return fallback ?? null;
  return primary ?? fallback ?? null;
}

const GOOGLE_SESSION_UID_KEY = 'rk_google_session_uid_v1';

export function markGoogleSessionUid(uid: string): void {
  const id = String(uid ?? '').trim();
  if (!id) return;
  try {
    sessionStorage.setItem(GOOGLE_SESSION_UID_KEY, id);
    localStorage.setItem(GOOGLE_SESSION_UID_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getGoogleSessionUid(): string | null {
  try {
    return sessionStorage.getItem(GOOGLE_SESSION_UID_KEY) || localStorage.getItem(GOOGLE_SESSION_UID_KEY);
  } catch {
    return null;
  }
}

export function clearGoogleSessionUid(): void {
  try {
    sessionStorage.removeItem(GOOGLE_SESSION_UID_KEY);
    localStorage.removeItem(GOOGLE_SESSION_UID_KEY);
  } catch {
    /* ignore */
  }
}

export function expectsGoogleSession(): boolean {
  return !!getGoogleSessionUid();
}

/** Google ログイン直後・掲示板遷移時に匿名ログインへ先走りしないよう待つ */
export async function waitForGoogleSessionRestore(maxMs = 3000): Promise<User | null> {
  const expectedUid = getGoogleSessionUid();
  if (!expectedUid) return null;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      await auth.authStateReady();
    } catch {
      /* ignore */
    }
    const u = auth.currentUser;
    if (isGoogleSignedInUser(u) && u!.uid === expectedUid) return u;
    await new Promise((r) => setTimeout(r, 120));
  }
  const u = auth.currentUser;
  return isGoogleSignedInUser(u) && u!.uid === expectedUid ? u : null;
}

/**
 * リダイレクト直後など、getRedirectResult の user がまだ反映されていないときに
 * auth.currentUser が Google になるまで待つ（初回ログインでは sessionStorage に UID が無い）
 */
export async function waitForAnyGoogleUser(maxMs = 5500): Promise<User | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      await auth.authStateReady();
    } catch {
      /* ignore */
    }
    const u = auth.currentUser;
    if (isGoogleSignedInUser(u)) return u;
    await new Promise((r) => setTimeout(r, 150));
  }
  return isGoogleSignedInUser(auth.currentUser) ? auth.currentUser! : null;
}
