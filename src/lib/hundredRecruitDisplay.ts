import { isRoboPickupLoungeRecruit } from './roboPickupLoungeConfig';
import type { PickupCharset } from './hundredPickupCharset';
import { normalizePickupCharset } from './hundredPickupCharset';

export type HundredRecruitListItem = {
  targetWord?: string;
  pickupCharset?: PickupCharset | string;
  boardSize?: number;
  boardCols?: number;
  boardRows?: number;
  roboPickupLounge?: boolean;
  roomId?: string;
  createdAt?: unknown;
};

export type HundredRecruitRoomMeta = {
  targetWord?: string;
  pickupCharset?: PickupCharset | string;
  boardSize?: number;
  boardCols?: number;
  boardRows?: number;
  startedAt?: unknown;
};

/** らくだロボ常設は hundred_rooms の現行お題を優先（hundred_public は更新が遅れやすい） */
export function resolveHundredRecruitTargetWord(
  item: HundredRecruitListItem,
  room?: HundredRecruitRoomMeta | null,
): string {
  const fromRoom = (room?.targetWord ?? '').trim();
  const fromItem = (item.targetWord ?? '').trim();
  if (fromRoom && isRoboPickupLoungeRecruit(item)) return fromRoom;
  // 次のお題で hundred_rooms が先に更新されたとき、一覧の語句を現行お題に合わせる
  if (fromRoom && fromItem && fromRoom !== fromItem) return fromRoom;
  return fromItem || fromRoom || '—';
}

export function resolveHundredRecruitPickupCharset(
  item: HundredRecruitListItem,
  room?: HundredRecruitRoomMeta | null,
): PickupCharset {
  if (isRoboPickupLoungeRecruit(item) && room?.pickupCharset) {
    return normalizePickupCharset(room.pickupCharset);
  }
  return normalizePickupCharset(item.pickupCharset);
}

/** らくだロボ常設は hundred_rooms.startedAt（現行お題）。一般募集は hundred_public.createdAt */
export function resolveHundredRecruitRoundStartedAt(
  item: HundredRecruitListItem,
  room?: HundredRecruitRoomMeta | null,
): unknown {
  if (isRoboPickupLoungeRecruit(item) && room?.startedAt != null) {
    return room.startedAt;
  }
  return item.createdAt;
}

export function resolveHundredRecruitBoardFields(
  item: HundredRecruitListItem,
  room?: HundredRecruitRoomMeta | null,
): { boardSize?: number; boardCols?: number; boardRows?: number } {
  if (!isRoboPickupLoungeRecruit(item) || !room) {
    return {
      boardSize: item.boardSize,
      boardCols: item.boardCols,
      boardRows: item.boardRows,
    };
  }
  return {
    boardSize: room.boardSize ?? item.boardSize,
    boardCols: room.boardCols ?? item.boardCols,
    boardRows: room.boardRows ?? item.boardRows,
  };
}
