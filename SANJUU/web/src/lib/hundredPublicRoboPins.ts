import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { FirestoreTimeInput } from './hundredPublicListHelpers';

export type PinnedHundredPublicRecruitRow = {
  id: string;
  type: 'hundred';
  targetWord: string;
  hundredMode?: string;
  tileMatchDifficulty?: string;
  boardSize: number;
  boardCols?: number;
  boardRows?: number;
  createdAt: FirestoreTimeInput;
  roomId?: string;
  hostUid?: string;
  hostNickname?: string;
  hostEmoji?: string;
  recruitDeadlineAt?: FirestoreTimeInput;
  gameTimeLimitSec?: number;
  hintsEnabled?: boolean;
  pickupCharset?: 'hiragana' | 'digit' | 'latin';
  roboPickupLounge?: boolean;
};

export const PINNED_ROBO_PICKUP_LOUNGE_PUBLIC_IDS = [
  'robo-pickup-lounge',
  'robo-pickup-lounge-emoji',
] as const;

const pinnedIdSet = new Set<string>(PINNED_ROBO_PICKUP_LOUNGE_PUBLIC_IDS);

export function parseHundredPublicRecruitRow(
  id: string,
  x: Record<string, unknown>,
): PinnedHundredPublicRecruitRow {
  return {
    id,
    type: 'hundred',
    targetWord: typeof x.targetWord === 'string' ? x.targetWord : '',
    hundredMode: typeof x.hundredMode === 'string' ? x.hundredMode : undefined,
    tileMatchDifficulty:
      typeof x.tileMatchDifficulty === 'string' ? x.tileMatchDifficulty : undefined,
    boardSize: typeof x.boardSize === 'number' ? x.boardSize : Number(x.boardSize) || 0,
    boardCols: typeof x.boardCols === 'number' ? x.boardCols : undefined,
    boardRows: typeof x.boardRows === 'number' ? x.boardRows : undefined,
    createdAt: x.createdAt,
    roomId: typeof x.roomId === 'string' ? x.roomId : undefined,
    hostUid: typeof x.hostUid === 'string' ? x.hostUid : undefined,
    hostNickname: typeof x.hostNickname === 'string' ? x.hostNickname : undefined,
    hostEmoji: typeof x.hostEmoji === 'string' ? x.hostEmoji : undefined,
    recruitDeadlineAt: x.recruitDeadlineAt,
    gameTimeLimitSec: typeof x.gameTimeLimitSec === 'number' ? x.gameTimeLimitSec : undefined,
    hintsEnabled: x.hintsEnabled === false ? false : undefined,
    pickupCharset:
      x.pickupCharset === 'digit' || x.pickupCharset === 'latin' || x.pickupCharset === 'hiragana'
        ? x.pickupCharset
        : undefined,
    roboPickupLounge: x.roboPickupLounge === true ? true : undefined,
  };
}

export async function mergePinnedRoboPickupLoungePublicRecruits<T extends { id: string }>(
  firestoreDb: Firestore,
  list: T[],
  parsePinned: (id: string, x: Record<string, unknown>) => T,
): Promise<T[]> {
  const byId = new Map(list.map((h) => [h.id, h]));
  const pinned: T[] = [];

  for (const publicId of PINNED_ROBO_PICKUP_LOUNGE_PUBLIC_IDS) {
    const existing = byId.get(publicId);
    if (existing) {
      pinned.push(existing);
      continue;
    }
    try {
      const snap = await getDoc(doc(firestoreDb, 'hundred_public', publicId));
      if (snap.exists()) {
        pinned.push(parsePinned(snap.id, snap.data() as Record<string, unknown>));
      }
    } catch (e) {
      console.warn('[mergePinnedRoboPickupLoungePublicRecruits] fetch failed', { publicId, e });
    }
  }

  const rest = list.filter((h) => !pinnedIdSet.has(h.id));
  return [...pinned, ...rest];
}
