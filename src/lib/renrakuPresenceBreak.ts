import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const RK_RENRAKU_ON_BREAK_KEY = 'rk-renraku-on-break';

export function readRenrakuOnBreakLocal(): boolean {
  try {
    return localStorage.getItem(RK_RENRAKU_ON_BREAK_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeRenrakuOnBreakLocal(onBreak: boolean): void {
  try {
    localStorage.setItem(RK_RENRAKU_ON_BREAK_KEY, onBreak ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** 掲示板の在席 doc に休憩フラグを書き込む（merge） */
export async function setRenrakuPresenceBreak(uid: string, onBreak: boolean): Promise<void> {
  await setDoc(doc(db, 'renraku_presence', uid), { onBreak }, { merge: true });
}
