import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { HundredPublicRecruit } from '../components/Renrakucho/types';
import {
  ROBO_PICKUP_EMOJI_LOUNGE_PUBLIC_ID,
  ROBO_PICKUP_LOUNGE_PUBLIC_ID,
} from './roboPickupLoungeConfig';

/** 掲示板・募集一覧に常に載せる hundred_public（createdAt が古くて query limit 外になるのを防ぐ） */
export const PINNED_ROBO_PICKUP_LOUNGE_PUBLIC_IDS = [
  ROBO_PICKUP_LOUNGE_PUBLIC_ID,
  ROBO_PICKUP_EMOJI_LOUNGE_PUBLIC_ID,
] as const;

const pinnedIdSet = new Set<string>(PINNED_ROBO_PICKUP_LOUNGE_PUBLIC_IDS);

export function parseHundredPublicRecruitDoc(
  id: string,
  x: Record<string, unknown>,
): HundredPublicRecruit {
  return {
    id,
    type: 'hundred',
    targetWord: typeof x.targetWord === 'string' ? x.targetWord : '',
    hundredMode:
      x.hundredMode === 'pickup' || x.hundredMode === 'tile_match' ? x.hundredMode : undefined,
    tileMatchDifficulty:
      x.tileMatchDifficulty === 'easy' ||
      x.tileMatchDifficulty === 'normal' ||
      x.tileMatchDifficulty === 'hard'
        ? x.tileMatchDifficulty
        : undefined,
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

/** query 結果に無くても、固定 ID のロボ常設を先頭に足す */
export async function mergePinnedRoboPickupLoungePublicRecruits(
  firestoreDb: Firestore,
  list: HundredPublicRecruit[],
): Promise<HundredPublicRecruit[]> {
  const byId = new Map(list.map((h) => [h.id, h]));
  const pinned: HundredPublicRecruit[] = [];

  for (const publicId of PINNED_ROBO_PICKUP_LOUNGE_PUBLIC_IDS) {
    const existing = byId.get(publicId);
    if (existing) {
      pinned.push(existing);
      continue;
    }
    try {
      const snap = await getDoc(doc(firestoreDb, 'hundred_public', publicId));
      if (snap.exists()) {
        pinned.push(parseHundredPublicRecruitDoc(snap.id, snap.data() as Record<string, unknown>));
      }
    } catch (e) {
      console.warn('[mergePinnedRoboPickupLoungePublicRecruits] fetch failed', { publicId, e });
    }
  }

  const rest = list.filter((h) => !pinnedIdSet.has(h.id));
  return [...pinned, ...rest];
}
