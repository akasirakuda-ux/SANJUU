import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import { isGoogleLoginPending, isGoogleSignedInUser, pickEffectiveAuthUser } from './authRedirectBootstrap';
import { isRenrakuAdmin } from './renrakuAdmin';

export type AuthLoginTone = 'google' | 'guest' | 'none' | 'loading';

export type AuthLoginDisplay = {
  label: string;
  title?: string;
  tone: AuthLoginTone;
};

function hasGoogleProvider(user: User): boolean {
  return (user.providerData ?? []).some((p) => p.providerId === 'google.com');
}

/** React state と Firebase の currentUser のずれを吸収（ログイン直後の表示ズレ対策） */
export function resolveAuthUserForLoginDisplay(
  reactUser: User | null | undefined,
  reactGoogleUser?: User | null | undefined,
): User | null {
  const fromReact = pickEffectiveAuthUser(reactUser, reactGoogleUser);
  if (isGoogleSignedInUser(fromReact)) return fromReact;
  const cur = auth.currentUser;
  if (isGoogleSignedInUser(cur)) return cur;
  return fromReact ?? cur ?? null;
}

/** 下部ステータス帯 1 行目用: Firebase のログイン状態 */
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
    const label = email
      ? admin
        ? `ログイン中: ${email}（管理者）`
        : `ログイン中: ${email}`
      : admin
        ? 'ログイン（管理者）'
        : 'ログイン';
    return {
      label,
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

/** 未 Google ログイン時のボタン文言 */
export function googleLoginActionLabelJa(tone: AuthLoginTone): string {
  if (isGoogleLoginPending()) return 'ログイン処理中…';
  if (tone === 'guest' || tone === 'none') return 'ログインしていません';
  return 'Google でログイン';
}
