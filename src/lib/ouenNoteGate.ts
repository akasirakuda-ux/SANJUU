import type { User } from 'firebase/auth';
import { isGoogleSignedInUser } from './authRedirectBootstrap';
import { getTotalStampCount, type ShussekiClearSlice } from './shussekiDailyClears';
import { isRenrakuAdmin } from './renrakuAdmin';
import { OUEN_NOTE_MIN_STAMPS } from './ouenNoteConfig';

export type OuenNoteAccessResult = { ok: true } | { ok: false; reason: 'login' | 'stamps' };

export function checkOuenNoteAccess(params: {
  firebaseUser: User | null | undefined;
  shusseki: ShussekiClearSlice;
  isAdmin?: boolean;
}): OuenNoteAccessResult {
  if (params.isAdmin || isRenrakuAdmin(params.firebaseUser ?? null)) {
    return { ok: true };
  }
  if (!isGoogleSignedInUser(params.firebaseUser ?? null)) {
    return { ok: false, reason: 'login' };
  }
  const myStamps = getTotalStampCount(params.shusseki);
  if (myStamps < OUEN_NOTE_MIN_STAMPS) {
    return { ok: false, reason: 'stamps' };
  }
  return { ok: true };
}

export function ouenNoteAccessDeniedMessage(reason: Exclude<OuenNoteAccessResult, { ok: true }>['reason']): string {
  if (reason === 'login') {
    return 'Googleログインとしゅっせき簿の記録がある方の場所です';
  }
  return `しゅっせき簿の出席が${OUEN_NOTE_MIN_STAMPS}日に達すると入れます。順位ではなく、らくだの空気に慣れてきた方の目安です`;
}
