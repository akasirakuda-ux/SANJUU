import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const RK_RENRAKU_PLAY_INVITE_KEY = 'rk-renraku-play-invite';
export const RK_RENRAKU_PLAY_INVITE_UNTIL_KEY = 'rk-renraku-play-invite-until';

/** 手動「一緒に遊ぶ？」の有効時間（30分） */
export const RENRAKU_PLAY_INVITE_TTL_MS = 30 * 60 * 1000;

export function readRenrakuPlayInviteLocal(): boolean {
  try {
    return localStorage.getItem(RK_RENRAKU_PLAY_INVITE_KEY) === '1';
  } catch {
    return false;
  }
}

export function readRenrakuPlayInviteUntilLocal(): number {
  try {
    const raw = localStorage.getItem(RK_RENRAKU_PLAY_INVITE_UNTIL_KEY);
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function isRenrakuPlayInviteLocalActive(): boolean {
  if (!readRenrakuPlayInviteLocal()) return false;
  const until = readRenrakuPlayInviteUntilLocal();
  if (until > 0 && Date.now() > until) return false;
  return true;
}

export function writeRenrakuPlayInviteLocal(active: boolean, untilMs = 0): void {
  try {
    localStorage.setItem(RK_RENRAKU_PLAY_INVITE_KEY, active ? '1' : '0');
    localStorage.setItem(RK_RENRAKU_PLAY_INVITE_UNTIL_KEY, active ? String(untilMs) : '0');
  } catch {
    /* ignore */
  }
}

export function isRenrakuPlayInviteActive(data: {
  playInvite?: unknown;
  playInviteUntilMs?: unknown;
}): boolean {
  if (data.playInvite !== true) return false;
  const until =
    typeof data.playInviteUntilMs === 'number' && Number.isFinite(data.playInviteUntilMs)
      ? data.playInviteUntilMs
      : 0;
  if (until > 0 && Date.now() > until) return false;
  return true;
}

/** 掲示板の在席 doc に「一緒に遊ぶ？」を書き込む（merge） */
export async function setRenrakuPresencePlayInvite(uid: string, active: boolean): Promise<void> {
  if (active) {
    await setDoc(
      doc(db, 'renraku_presence', uid),
      {
        playInvite: true,
        playInviteUntilMs: Date.now() + RENRAKU_PLAY_INVITE_TTL_MS,
      },
      { merge: true },
    );
    return;
  }
  await setDoc(
    doc(db, 'renraku_presence', uid),
    {
      playInvite: false,
      playInviteUntilMs: null,
    },
    { merge: true },
  );
}
