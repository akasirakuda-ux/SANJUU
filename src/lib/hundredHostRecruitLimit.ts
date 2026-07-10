import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { HundredPublicRecruit } from '../components/Renrakucho/types';
import { HUNDRED_MAX_PLAYERS } from './hundredRoomCapacity';
import { parseHundredRoomMeta } from './hundredRoomListMeta';
import {
  firestoreLikeToMillis,
  hundredRecruitHasOpenDeadline,
  isHundredInPlayPastBoardVisibleWindow,
  isHundredOpenRecruitSessionEnded,
  isHundredRecruitPastBoardVisibleWindow,
  isHundredRoomInPlay,
  type HundredRoomListMeta,
} from './firestoreTime';

export type HundredPublicRecruitSlice = {
  id: string;
  roomId?: string;
  hostUid?: string;
  hundredMode?: string;
  recruitDeadlineAt?: unknown;
  createdAt?: unknown;
};

export type HostRoomLimitContext = {
  recruitDeadlineAt?: unknown;
  createdAt?: unknown;
  nowMs?: number;
};

/**
 * ホストは同時に1件まで。
 * 一覧には「あそび中」しか載せないが、控室（recruiting）もホストの持ち枠として数える。
 */
export function hostRoomBlocksNewRecruit(
  room: HundredRoomListMeta | undefined,
  roomDocMissing: boolean,
  ctx?: HostRoomLimitContext
): boolean {
  if (roomDocMissing) return false;
  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return false;
  if (typeof room?.playerCount === 'number' && room.playerCount >= HUNDRED_MAX_PLAYERS) {
    return false;
  }

  const nowMs = ctx?.nowMs ?? Date.now();
  const item = {
    recruitDeadlineAt: ctx?.recruitDeadlineAt ?? room?.recruitDeadlineAt,
    createdAt: ctx?.createdAt,
  };

  if (isHundredRoomInPlay(st) || room?.problemsGenerating === true) {
    return !isHundredInPlayPastBoardVisibleWindow(item, room, nowMs);
  }

  if (st === 'recruiting') {
    // お題間・控室の放置 → 新規を妨げない
    if (isHundredOpenRecruitSessionEnded(item, room, nowMs)) return false;
    if (
      !hundredRecruitHasOpenDeadline(item, room) &&
      isHundredRecruitPastBoardVisibleWindow(item, room, nowMs)
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export function hostHasActiveHundredRecruitFromSlices(
  hostUid: string,
  publicItems: HundredPublicRecruitSlice[],
  roomMetaByRoomId: Record<string, HundredRoomListMeta>,
  missingRoomIds: Set<string>,
  extraHostRoomIds: string[] = [],
  roomRawById: Record<string, Record<string, unknown>> = {},
  nowMs: number = Date.now()
): boolean {
  const uid = hostUid.trim();
  if (!uid) return false;

  const checkedRoomIds = new Set<string>();

  for (const item of publicItems) {
    if (item.hostUid !== uid) continue;
    const roomId = (item.roomId || '').trim();
    if (roomId) checkedRoomIds.add(roomId);
    const room = roomId ? roomMetaByRoomId[roomId] : undefined;
    const roomDocMissing = !!roomId && missingRoomIds.has(roomId);
    const raw = roomId ? roomRawById[roomId] : undefined;
    if (
      hostRoomBlocksNewRecruit(room, roomDocMissing, {
        recruitDeadlineAt: item.recruitDeadlineAt ?? raw?.recruitDeadlineAt,
        createdAt: item.createdAt ?? raw?.createdAt,
        nowMs,
      })
    ) {
      return true;
    }
  }

  for (const roomId of extraHostRoomIds) {
    if (checkedRoomIds.has(roomId)) continue;
    const room = roomMetaByRoomId[roomId];
    const raw = roomRawById[roomId];
    if (
      room &&
      hostRoomBlocksNewRecruit(room, false, {
        recruitDeadlineAt: raw?.recruitDeadlineAt,
        createdAt: raw?.createdAt,
        nowMs,
      })
    ) {
      return true;
    }
  }

  return false;
}

function parsePublicSlice(id: string, data: Record<string, unknown>): HundredPublicRecruitSlice {
  return {
    id,
    roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
    hostUid: typeof data.hostUid === 'string' ? data.hostUid : undefined,
    hundredMode: typeof data.hundredMode === 'string' ? data.hundredMode : undefined,
    recruitDeadlineAt: data.recruitDeadlineAt,
    createdAt: data.createdAt,
  };
}

function roomDocToRecruit(
  roomId: string,
  data: Record<string, unknown>,
  publicDoc?: HundredPublicRecruitSlice
): HundredPublicRecruit {
  const publicRecruitId =
    typeof data.publicRecruitId === 'string' && data.publicRecruitId.trim()
      ? data.publicRecruitId.trim()
      : '';
  const cols =
    typeof data.boardCols === 'number'
      ? data.boardCols
      : typeof data.boardSize === 'number'
        ? data.boardSize
        : 10;
  const rows = typeof data.boardRows === 'number' ? data.boardRows : cols;
  return {
    id: publicDoc?.id ?? (publicRecruitId || `local-${roomId}`),
    type: 'hundred',
    roomId,
    targetWord: typeof data.targetWord === 'string' ? data.targetWord : '',
    hundredMode:
      data.hundredMode === 'tile_match' ? 'tile_match' : publicDoc?.hundredMode === 'tile_match' ? 'tile_match' : 'pickup',
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
    recruitDeadlineAt: data.recruitDeadlineAt ?? publicDoc?.recruitDeadlineAt,
    createdAt: data.createdAt ?? publicDoc?.createdAt,
    gameTimeLimitSec: typeof data.gameTimeLimitSec === 'number' ? data.gameTimeLimitSec : 0,
    hintsEnabled: data.hintsEnabled === false ? false : publicDoc?.hintsEnabled === false ? false : undefined,
  };
}

/** ホストがまだ終えていない募集・対戦部屋が1件でもあれば true */
export async function fetchHostHasActiveHundredRecruit(
  db: Firestore,
  hostUid: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  const uid = hostUid.trim();
  if (!uid) return false;

  const [pubSnap, roomSnap] = await Promise.all([
    getDocs(query(collection(db, 'hundred_public'), where('hostUid', '==', uid), limit(30))),
    getDocs(query(collection(db, 'hundred_rooms'), where('hostUid', '==', uid), limit(30))),
  ]);

  const roomMetaByRoomId: Record<string, HundredRoomListMeta> = {};
  const roomRawById: Record<string, Record<string, unknown>> = {};
  const extraHostRoomIds: string[] = [];
  for (const d of roomSnap.docs) {
    const raw = d.data() as Record<string, unknown>;
    roomRawById[d.id] = raw;
    roomMetaByRoomId[d.id] = parseHundredRoomMeta(raw);
    extraHostRoomIds.push(d.id);
  }

  const publicItems: HundredPublicRecruitSlice[] = pubSnap.docs.map((d) =>
    parsePublicSlice(d.id, d.data() as Record<string, unknown>)
  );

  const publicRoomIds = publicItems
    .map((h) => (h.roomId || '').trim())
    .filter(Boolean);
  const missingRoomIds = new Set(publicRoomIds.filter((id) => !roomMetaByRoomId[id]));

  return hostHasActiveHundredRecruitFromSlices(
    uid,
    publicItems,
    roomMetaByRoomId,
    missingRoomIds,
    extraHostRoomIds,
    roomRawById,
    nowMs
  );
}

/** いま続けられる待機室（新しい active 部屋1件） */
export async function fetchHostActiveHundredResumeRecruit(
  db: Firestore,
  hostUid: string,
  nowMs: number = Date.now()
): Promise<HundredPublicRecruit | null> {
  const uid = hostUid.trim();
  if (!uid) return null;

  const roomSnap = await getDocs(
    query(collection(db, 'hundred_rooms'), where('hostUid', '==', uid), limit(30))
  );

  type Candidate = { roomId: string; raw: Record<string, unknown>; createdMs: number };
  const candidates: Candidate[] = [];

  for (const d of roomSnap.docs) {
    const raw = d.data() as Record<string, unknown>;
    const room = parseHundredRoomMeta(raw);
    if (
      !hostRoomBlocksNewRecruit(room, false, {
        recruitDeadlineAt: raw.recruitDeadlineAt,
        createdAt: raw.createdAt,
        nowMs,
      })
    ) {
      continue;
    }
    const createdMs = firestoreLikeToMillis(raw.createdAt) ?? 0;
    candidates.push({ roomId: d.id, raw, createdMs });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.createdMs - a.createdMs);
  const best = candidates[0];
  const publicRecruitId =
    typeof best.raw.publicRecruitId === 'string' && best.raw.publicRecruitId.trim()
      ? best.raw.publicRecruitId.trim()
      : '';
  let publicDoc: HundredPublicRecruitSlice | undefined;
  if (publicRecruitId) {
    try {
      const snap = await getDoc(doc(db, 'hundred_public', publicRecruitId));
      if (snap.exists()) {
        publicDoc = parsePublicSlice(snap.id, snap.data() as Record<string, unknown>);
      }
    } catch {
      /* ignore */
    }
  }
  return roomDocToRecruit(best.roomId, best.raw, publicDoc);
}

export const HOST_HUNDRED_RECRUIT_LIMIT_MESSAGE =
  '募集は同時に1件までです。いまの部屋を終えるか「募集をとじる」してから、新しく作ってください。';

export const HOST_HUNDRED_RESUME_WAIT_MESSAGE =
  'いまの待機室があります。下のボタンで続きから入れます（募集一覧には出しません）。';

/** @deprecated 旧名 */
export const HOST_PICKUP_RECRUIT_LIMIT_MESSAGE = HOST_HUNDRED_RECRUIT_LIMIT_MESSAGE;

export const fetchHostHasActivePickupHundredRecruit = fetchHostHasActiveHundredRecruit;
