import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { normalizeHundredGameTimeLimitSec, type HundredRoomListMeta } from './firestoreTime';

export function parseHundredRoomMeta(data: Record<string, unknown>): HundredRoomListMeta {
  return {
    status: typeof data.status === 'string' ? data.status : 'recruiting',
    playerCount: typeof data.playerCount === 'number' ? data.playerCount : undefined,
    recruitDeadlineAt: data.recruitDeadlineAt,
    hostNickname: typeof data.hostNickname === 'string' ? data.hostNickname : undefined,
    hostEmoji: typeof data.hostEmoji === 'string' ? data.hostEmoji : undefined,
    gameTimeLimitSec:
      typeof data.gameTimeLimitSec === 'number'
        ? normalizeHundredGameTimeLimitSec(data.gameTimeLimitSec)
        : undefined,
    hundredMode: typeof data.hundredMode === 'string' ? data.hundredMode : undefined,
    tileMatchDifficulty:
      typeof data.tileMatchDifficulty === 'string' ? data.tileMatchDifficulty : undefined,
    targetWord: typeof data.targetWord === 'string' ? data.targetWord : undefined,
    pickupCharset: typeof data.pickupCharset === 'string' ? data.pickupCharset : undefined,
    boardSize: typeof data.boardSize === 'number' ? data.boardSize : undefined,
    boardCols: typeof data.boardCols === 'number' ? data.boardCols : undefined,
    boardRows: typeof data.boardRows === 'number' ? data.boardRows : undefined,
    roboPickupLounge: data.roboPickupLounge === true ? true : undefined,
    startedAt: data.startedAt,
    foundWords: data.foundWords,
    words: data.words,
    placedWords: data.placedWords,
    problemsGenerating: data.problemsGenerating === true ? true : undefined,
    problemsReady: data.problemsReady === true ? true : undefined,
    gridRowsPresent:
      Array.isArray(data.gridRows) && data.gridRows.length > 0 ? true : undefined,
    endReason: typeof data.endReason === 'string' ? data.endReason : undefined,
    endedAt: data.endedAt,
  };
}

export type FetchHundredRoomMetaResult = {
  byRoomId: Record<string, HundredRoomListMeta>;
  /** getDoc 済みでドキュメントが存在しなかった roomId */
  missingRoomIds: Set<string>;
};

/** `hundred_public` 一覧に載っている roomId だけを読む（collection limit 60 では足りない） */
export async function fetchHundredRoomMetaByIds(
  db: Firestore,
  roomIds: string[]
): Promise<FetchHundredRoomMetaResult> {
  const unique = [...new Set(roomIds.map((id) => id.trim()).filter(Boolean))];
  const byRoomId: Record<string, HundredRoomListMeta> = {};
  const missingRoomIds = new Set<string>();

  await Promise.all(
    unique.map(async (roomId) => {
      try {
        const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
        if (!snap.exists()) {
          missingRoomIds.add(roomId);
          return;
        }
        byRoomId[roomId] = parseHundredRoomMeta(snap.data() as Record<string, unknown>);
      } catch (e) {
        console.warn('[fetchHundredRoomMetaByIds] getDoc failed', { roomId, e });
      }
    })
  );

  return { byRoomId, missingRoomIds };
}
