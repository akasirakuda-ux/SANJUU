import { doc, getDoc } from 'firebase/firestore';
import type { HundredPublicRecruit } from '../components/Renrakucho/types';
import { db } from '../firebase';
import { isHundredRoomInPlay } from './firestoreTime';
import { normalizePickupCharset } from './hundredPickupCharset';
import { saveHundredRestoreSession } from './rakudaHundredRestore';

function roomDocToRecruit(
  roomId: string,
  data: Record<string, unknown>,
  publicId?: string,
  publicData?: Record<string, unknown>
): HundredPublicRecruit {
  const cols =
    typeof data.boardCols === 'number'
      ? data.boardCols
      : typeof data.boardSize === 'number'
        ? data.boardSize
        : 10;
  const rows = typeof data.boardRows === 'number' ? data.boardRows : cols;
  const pubMode = publicData?.hundredMode;
  return {
    id: publicId || (typeof data.publicRecruitId === 'string' && data.publicRecruitId.trim()
      ? data.publicRecruitId.trim()
      : `local-${roomId}`),
    type: 'hundred',
    roomId,
    targetWord: typeof data.targetWord === 'string' ? data.targetWord : '',
    hundredMode:
      data.hundredMode === 'tile_match' || pubMode === 'tile_match' ? 'tile_match' : 'pickup',
    tileMatchDifficulty:
      data.tileMatchDifficulty === 'easy' ||
      data.tileMatchDifficulty === 'normal' ||
      data.tileMatchDifficulty === 'hard'
        ? data.tileMatchDifficulty
        : undefined,
    boardSize: cols,
    boardCols: cols,
    boardRows: rows,
    hostUid: typeof data.hostUid === 'string' ? data.hostUid : undefined,
    hostNickname: typeof data.hostNickname === 'string' ? data.hostNickname : undefined,
    hostEmoji: typeof data.hostEmoji === 'string' ? data.hostEmoji : undefined,
    recruitDeadlineAt: data.recruitDeadlineAt ?? publicData?.recruitDeadlineAt,
    createdAt: data.createdAt ?? publicData?.createdAt,
    gameTimeLimitSec: typeof data.gameTimeLimitSec === 'number' ? data.gameTimeLimitSec : 0,
    hintsEnabled: data.hintsEnabled === false ? false : publicData?.hintsEnabled === false ? false : undefined,
    pickupCharset: normalizePickupCharset(data.pickupCharset ?? publicData?.pickupCharset),
  };
}

/** ルーム ID から再参加用の募集情報を組み立てる */
export async function fetchHundredRecruitForRoom(roomId: string): Promise<HundredPublicRecruit | null> {
  const rid = roomId.trim();
  if (!rid) return null;
  try {
    const roomSnap = await getDoc(doc(db, 'hundred_rooms', rid));
    if (!roomSnap.exists()) return null;
    const data = roomSnap.data() as Record<string, unknown>;
    const status = typeof data.status === 'string' ? data.status : '';
    if (status === 'finished' || status === 'cancelled') return null;

    const publicRecruitId =
      typeof data.publicRecruitId === 'string' && data.publicRecruitId.trim()
        ? data.publicRecruitId.trim()
        : '';
    if (publicRecruitId && !publicRecruitId.startsWith('local-')) {
      try {
        const pubSnap = await getDoc(doc(db, 'hundred_public', publicRecruitId));
        if (pubSnap.exists()) {
          return roomDocToRecruit(rid, data, pubSnap.id, pubSnap.data() as Record<string, unknown>);
        }
      } catch {
        /* fall through to room-only */
      }
    }
    return roomDocToRecruit(rid, data);
  } catch {
    return null;
  }
}

export function isHundredRoomRejoinable(status: string | undefined): boolean {
  if (!status) return true;
  if (status === 'recruiting') return true;
  return isHundredRoomInPlay(status);
}

/** 盤面を離れたあと、待機ロビー経由で再参加できるよう sessionStorage に保存 */
export async function saveHundredRestoreForRoom(roomId: string): Promise<boolean> {
  const recruit = await fetchHundredRecruitForRoom(roomId);
  if (!recruit) return false;
  saveHundredRestoreSession({ publicScreen: 'hundred-wait', selectedHundred: recruit });
  return true;
}
