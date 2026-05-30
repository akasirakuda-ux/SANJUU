import { Timestamp } from 'firebase/firestore';
import type { HundredPublicRecruit, RenrakuchoPublicScreenState } from '../components/Renrakucho/types';

const STORAGE_KEY = 'rk_hundred_restore_v1';

export type HundredRestorePayload = {
  publicScreen: RenrakuchoPublicScreenState;
  selectedHundred: HundredPublicRecruit;
};

function toMillis(t: unknown): number | null {
  if (t == null) return null;
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
    try {
      return (t as Timestamp).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeForHundredRestore(r: HundredPublicRecruit): Record<string, unknown> {
  return {
    ...r,
    recruitDeadlineAt: toMillis(r.recruitDeadlineAt as unknown),
    createdAt: toMillis(r.createdAt as unknown),
  };
}

function reviveRecruit(raw: Record<string, unknown>): HundredPublicRecruit {
  const rd = raw.recruitDeadlineAt;
  const ca = raw.createdAt;
  return {
    ...(raw as unknown as HundredPublicRecruit),
    recruitDeadlineAt:
      typeof rd === 'number' ? Timestamp.fromMillis(rd) : (rd as HundredPublicRecruit['recruitDeadlineAt']),
    createdAt: typeof ca === 'number' ? Timestamp.fromMillis(ca) : (ca as HundredPublicRecruit['createdAt']),
  };
}

export function saveHundredRestoreSession(payload: HundredRestorePayload): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        publicScreen: payload.publicScreen,
        selectedHundred: serializeForHundredRestore(payload.selectedHundred),
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadHundredRestoreSession(): HundredRestorePayload | null {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const j = JSON.parse(s) as { publicScreen?: string; selectedHundred?: Record<string, unknown> };
    const ps = j.publicScreen;
    const sh = j.selectedHundred;
    if (typeof ps !== 'string' || !sh || typeof sh !== 'object') return null;
    const allowed: readonly string[] = ['hundred-wait', 'hundred-board', 'hundred-detail', 'list', 'closed'];
    if (!allowed.includes(ps)) return null;
    if (typeof sh.roomId !== 'string' || !sh.roomId) return null;
    return {
      publicScreen: ps as RenrakuchoPublicScreenState,
      selectedHundred: reviveRecruit(sh),
    };
  } catch {
    return null;
  }
}

export function clearHundredRestoreSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
