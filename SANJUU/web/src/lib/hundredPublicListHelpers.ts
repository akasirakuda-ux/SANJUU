/**
 * hundred_public 一覧（みんなであそぶ募集）用。らくだ本体 `src/lib/firestoreTime.ts` と同じ判定を三十側でも使う。
 */

import { isRoboLoungeRoundComplete } from './roboLoungeBoardHide';

export type FirestoreTimeInput = unknown;

export function firestoreLikeToMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object') {
    const v = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof v.toMillis === 'function') {
      const m = v.toMillis();
      return typeof m === 'number' && Number.isFinite(m) ? m : null;
    }
    if (typeof v.toDate === 'function') {
      const d = v.toDate();
      if (!(d instanceof Date)) return null;
      const t = d.getTime();
      return Number.isNaN(t) ? null : t;
    }
    const secRaw =
      typeof v.seconds === 'number' && Number.isFinite(v.seconds)
        ? v.seconds
        : typeof (v as { _seconds?: number })._seconds === 'number' &&
            Number.isFinite((v as { _seconds: number })._seconds)
          ? (v as { _seconds: number })._seconds
          : null;
    if (secRaw != null) {
      const nanosKey = v as { nanoseconds?: number; _nanoseconds?: number };
      const ns =
        typeof nanosKey.nanoseconds === 'number' && Number.isFinite(nanosKey.nanoseconds)
          ? nanosKey.nanoseconds
          : typeof nanosKey._nanoseconds === 'number' && Number.isFinite(nanosKey._nanoseconds)
            ? nanosKey._nanoseconds
            : 0;
      return secRaw * 1000 + Math.floor(ns / 1_000_000);
    }
  }
  return null;
}

export function formatFirestoreTimeJa(
  value: FirestoreTimeInput,
  options?: Intl.DateTimeFormatOptions
): string {
  const ms = firestoreLikeToMillis(value);
  if (ms == null) return '—';
  return new Date(ms).toLocaleString('ja-JP', options);
}

export const HUNDRED_RECRUIT_WINDOW_MS = 5 * 60 * 1000;
export const HUNDRED_OPEN_RECRUIT_DEADLINE_MS = Date.parse('2099-01-01T00:00:00+09:00');
export const HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS = 15 * 60 * 1000;
export const HUNDRED_OPEN_RECRUIT_ABANDON_MS = 45 * 60 * 1000;
export const HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS = 5 * 60 * 1000;
export const HUNDRED_IN_PLAY_BOARD_VISIBLE_MS = 3 * 60 * 60 * 1000;
export const HUNDRED_IN_PLAY_MAX_STALE_FROM_CREATED_MS = 24 * 60 * 60 * 1000;

export function normalizeHundredGameTimeLimitSec(sec: unknown): number {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) {
    return 0;
  }
  return sec;
}

export function isHundredOpenRecruitDeadline(value: FirestoreTimeInput): boolean {
  const ms = firestoreLikeToMillis(value);
  if (ms == null) return false;
  return ms >= HUNDRED_OPEN_RECRUIT_DEADLINE_MS - 24 * 60 * 60 * 1000;
}

export function hundredRecruitHasOpenDeadline(
  item: { recruitDeadlineAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
): boolean {
  return (
    isHundredOpenRecruitDeadline(item.recruitDeadlineAt) ||
    isHundredOpenRecruitDeadline(room?.recruitDeadlineAt)
  );
}

export function hundredDisplayDeadlineMs(params: {
  roomRecruitDeadlineAt?: FirestoreTimeInput;
  itemRecruitDeadlineAt?: FirestoreTimeInput;
  itemCreatedAt?: FirestoreTimeInput;
}): number | null {
  const fromRoomOrItem = firestoreLikeToMillis(
    params.roomRecruitDeadlineAt ?? params.itemRecruitDeadlineAt
  );
  if (fromRoomOrItem != null) return fromRoomOrItem;
  const ca = firestoreLikeToMillis(params.itemCreatedAt);
  if (ca != null && ca > 0) return ca + HUNDRED_RECRUIT_WINDOW_MS;
  return null;
}

export function shouldHideHundredPublicFromListItem(
  item: { recruitDeadlineAt?: FirestoreTimeInput; createdAt?: FirestoreTimeInput },
  nowMs: number
): boolean {
  const effectiveMs = hundredDisplayDeadlineMs({
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
  if (effectiveMs == null) return false;
  return effectiveMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS < nowMs;
}

export type HundredRoomListMeta = {
  status: string;
  playerCount?: number;
  recruitDeadlineAt?: FirestoreTimeInput;
  hostNickname?: string;
  hostEmoji?: string;
  gameTimeLimitSec?: number;
  hundredMode?: string;
  tileMatchDifficulty?: string;
  targetWord?: string;
  pickupCharset?: string;
  boardSize?: number;
  boardCols?: number;
  boardRows?: number;
  roboPickupLounge?: boolean;
  startedAt?: FirestoreTimeInput;
  foundWords?: unknown;
  words?: unknown;
  placedWords?: unknown;
  problemsGenerating?: boolean;
  problemsReady?: boolean;
  gridRowsPresent?: boolean;
  endReason?: string;
  endedAt?: FirestoreTimeInput;
};

const ROBO_PICKUP_LOUNGE_ROOM_IDS = ['robo-pickup-lounge', 'robo-pickup-lounge-emoji'];

function isRoboPickupLoungeRecruit(item: {
  roboPickupLounge?: boolean;
  roomId?: string;
}): boolean {
  if (item.roboPickupLounge === true) return true;
  const id = (item.roomId || '').trim();
  return ROBO_PICKUP_LOUNGE_ROOM_IDS.includes(id);
}

export function resolveHundredRecruitTargetWord(
  item: { targetWord?: string; roboPickupLounge?: boolean; roomId?: string },
  room?: HundredRoomListMeta | null,
): string {
  const fromRoom = (room?.targetWord ?? '').trim();
  if (fromRoom && isRoboPickupLoungeRecruit(item)) return fromRoom;
  const fromItem = (item.targetWord ?? '').trim();
  return fromItem || '—';
}

export function resolveHundredRecruitRoundStartedAt(
  item: { createdAt?: FirestoreTimeInput; roboPickupLounge?: boolean; roomId?: string },
  room?: HundredRoomListMeta | null,
): FirestoreTimeInput {
  if (isRoboPickupLoungeRecruit(item) && room?.startedAt != null) {
    return room.startedAt;
  }
  return item.createdAt;
}

export function isHundredBetweenRounds(room: HundredRoomListMeta | undefined): boolean {
  if (!room) return false;
  if ((room.status ?? 'recruiting') !== 'recruiting') return false;
  const er = room.endReason;
  return er === 'cleared' || er === 'timeout';
}

function hundredRoomHasActiveBoard(room: HundredRoomListMeta | undefined): boolean {
  if (!room) return false;
  if (room.problemsReady === true) return true;
  if (room.gridRowsPresent === true) return true;
  const placedWords = room.words ?? room.placedWords;
  return Array.isArray(placedWords) && placedWords.length > 0;
}

export function isHundredAbandonedPlayingRoom(
  room: HundredRoomListMeta | undefined,
  nowMs: number,
): boolean {
  if (!room || !isHundredRoomInPlay(room.status)) return false;
  if (hundredRoomHasActiveBoard(room)) return false;
  if (typeof room.playerCount !== 'number') return false;
  if (room.playerCount > 0) return false;
  const foundLen = Array.isArray(room.foundWords) ? room.foundWords.length : 0;
  if (foundLen > 0) return false;
  const startedAtMs = firestoreLikeToMillis(room.startedAt);
  if (startedAtMs == null) return false;
  return nowMs - startedAtMs >= 60_000;
}

export function isHundredOpenRecruitSessionEnded(
  item: { createdAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
  nowMs: number,
): boolean {
  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return true;
  if (isHundredRoomInPlay(st)) {
    const placedWords = room?.words ?? room?.placedWords;
    const placedWordsKnown =
      room != null &&
      (room.words !== undefined ||
        room.placedWords !== undefined ||
        room.problemsReady === true ||
        room.gridRowsPresent === true);
    if (placedWordsKnown && room && isRoboLoungeRoundComplete(room.foundWords, placedWords)) {
      return true;
    }
    if (isHundredAbandonedPlayingRoom(room, nowMs)) {
      return true;
    }
    const startedAtMs = firestoreLikeToMillis(room?.startedAt);
    const hasBoard = hundredRoomHasActiveBoard(room);
    if (placedWordsKnown && !hasBoard && room?.problemsGenerating !== true) {
      return true;
    }
    if (startedAtMs != null && nowMs - startedAtMs >= HUNDRED_IN_PLAY_BOARD_VISIBLE_MS) {
      return true;
    }
    return false;
  }
  if (room?.problemsGenerating === true) return false;

  const endedAtMs = firestoreLikeToMillis(room?.endedAt);
  if (endedAtMs != null && nowMs - endedAtMs >= HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS) {
    return true;
  }

  const createdMs = firestoreLikeToMillis(item.createdAt);
  // お題間なのに endedAt 欠損（旧データ）→ createdAt 基準で消す
  if (endedAtMs == null && isHundredBetweenRounds(room)) {
    if (createdMs != null && nowMs - createdMs >= HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS) {
      return true;
    }
  }

  const startedAtMs = firestoreLikeToMillis(room?.startedAt);
  if (
    endedAtMs == null &&
    st === 'recruiting' &&
    startedAtMs != null &&
    nowMs - startedAtMs >= HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS
  ) {
    return true;
  }

  if (
    endedAtMs == null &&
    startedAtMs == null &&
    !isHundredBetweenRounds(room) &&
    createdMs != null &&
    nowMs - createdMs >= HUNDRED_OPEN_RECRUIT_ABANDON_MS
  ) {
    return true;
  }

  return false;
}

export function isHundredRoomInPlay(status: string | undefined): boolean {
  return status === 'playing' || status === 'started';
}

export function isHundredRoomInPlayOrStarting(room: HundredRoomListMeta | undefined): boolean {
  if (!room) return false;
  if (isHundredBetweenRounds(room)) return false;
  const st = room.status ?? 'recruiting';
  if (st === 'recruiting') {
    return room.problemsGenerating === true;
  }
  if (isHundredRoomInPlay(st)) return true;
  if (room.problemsGenerating === true) return true;
  if (room.problemsReady === true) return true;
  if (room.startedAt != null) return true;
  const words = room.words ?? room.placedWords;
  if (Array.isArray(words) && words.length > 0) return true;
  return false;
}

function isHundredInPlayPastBoardVisibleWindow(
  item: { recruitDeadlineAt?: FirestoreTimeInput; createdAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
  nowMs: number
): boolean {
  const createdMs = firestoreLikeToMillis(item.createdAt);
  if (createdMs != null && nowMs > createdMs + HUNDRED_IN_PLAY_MAX_STALE_FROM_CREATED_MS) {
    return true;
  }
  const effectiveMs = hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: room?.recruitDeadlineAt,
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
  if (effectiveMs == null) return false;
  return (
    effectiveMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS + HUNDRED_IN_PLAY_BOARD_VISIBLE_MS < nowMs
  );
}

function isHundredRecruitPastBoardVisibleWindow(
  item: { recruitDeadlineAt?: FirestoreTimeInput; createdAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
  nowMs: number
): boolean {
  const effectiveMs = hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: room?.recruitDeadlineAt,
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
  if (effectiveMs == null) return false;
  return effectiveMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS < nowMs;
}

export type ShouldHideSanjuuRecruitBoardOptions = {
  roomDocMissing?: boolean;
};

export function shouldHideFromSanjuuRecruitBoard(
  item: {
    recruitDeadlineAt?: FirestoreTimeInput;
    createdAt?: FirestoreTimeInput;
    roomId?: string;
    roboPickupLounge?: boolean;
  },
  room: HundredRoomListMeta | undefined,
  nowMs: number,
  options?: ShouldHideSanjuuRecruitBoardOptions
): boolean {
  if (options?.roomDocMissing) return true;
  if (isRoboPickupLoungeRecruit(item)) return false;

  // room メタ未取得のあいだは出さない（終わった募集が一瞬出るのを防ぐ）
  if (!room && (item.roomId || '').trim()) return true;

  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return true;

  // お題とお題のあいだ・ホスト開始前の控室: 一緒に遊べないので一覧に出さない。
  if (isHundredBetweenRounds(room)) return true;
  if (!isHundredRoomInPlayOrStarting(room)) return true;

  const placedWords = room?.words ?? room?.placedWords;
  const foundLen = Array.isArray(room?.foundWords) ? room.foundWords.length : 0;
  if (room && isRoboLoungeRoundComplete(room.foundWords, placedWords)) {
    return true;
  }

  if (isHundredAbandonedPlayingRoom(room, nowMs)) {
    return true;
  }

  if (
    room &&
    isHundredRoomInPlay(st) &&
    foundLen > 0 &&
    (!Array.isArray(placedWords) || placedWords.length === 0) &&
    room.problemsGenerating !== true
  ) {
    return true;
  }

  if (hundredRecruitHasOpenDeadline(item, room)) {
    return isHundredOpenRecruitSessionEnded(item, room, nowMs);
  }

  return isHundredInPlayPastBoardVisibleWindow(item, room, nowMs);
}

export function formatHundredBoardLabel(item: {
  boardSize?: number;
  boardCols?: number;
  boardRows?: number;
}): string {
  const cols =
    typeof item.boardCols === 'number' && item.boardCols > 0
      ? item.boardCols
      : typeof item.boardSize === 'number' && item.boardSize > 0
        ? item.boardSize
        : 0;
  const rows =
    typeof item.boardRows === 'number' && item.boardRows > 0
      ? item.boardRows
      : cols;
  if (cols <= 0) return '—';
  return `${cols}×${rows}`;
}
