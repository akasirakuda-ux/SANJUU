import {
  collection,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  applyGomokuMove,
  createGomokuStartBoard,
  getGomokuWinnerAfterMove,
  gomokuBoardSizeLabelJa,
  gomokuHandicapLabelJa,
  gomokuOpponent,
  isValidGomokuMove,
  type GomokuBoardSize,
  type GomokuCell,
  type GomokuColor,
} from './gomokuLogic';
import type { GomokuOnlineStartMode, GomokuRoomSettings } from './gomokuConfig';
import {
  gomokuOnlineStartModeLabelJa,
  normalizeGomokuOnlineStartMode,
  normalizeGomokuRecruitComment,
} from './gomokuConfig';
import { firestoreLikeToMillis } from './firestoreTime';
import { boardGridColumnLabel } from './boardGridCoordinates';
import { gomokuCoordLabel } from './gomokuLogic';

export type GomokuRoomStatus = 'waiting' | 'side_pick' | 'side_reveal' | 'playing' | 'finished';

export type GomokuSidePickMethod = 'coin';

export type GomokuEndReason = 'normal' | 'abandoned';

export interface GomokuRoomPlayer {
  uid: string;
  name: string;
  emoji: string;
}

export interface GomokuHostRecord {
  wins: number;
  losses: number;
  draws: number;
  onlineWins: number;
  onlineLosses: number;
  onlineDraws: number;
}

export interface GomokuRoomDoc {
  roomCode: string;
  status: GomokuRoomStatus;
  host: GomokuRoomPlayer;
  guest?: GomokuRoomPlayer;
  settings: GomokuRoomSettings;
  hostRecord?: GomokuHostRecord;
  onlineStartMode: GomokuOnlineStartMode;
  recruitComment?: string;
  sidePickMethod?: GomokuSidePickMethod;
  sidePickAnimMethod?: GomokuSidePickMethod;
  board: string;
  handicapKeys: string[];
  boardSize: GomokuBoardSize;
  turn: GomokuColor;
  blackUid: string;
  whiteUid: string;
  winner?: GomokuColor;
  lastMoveCoord?: string;
  endReason?: GomokuEndReason;
  endedBy?: string;
  lastMoveAt?: unknown;
  createdAt?: unknown;
}

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function serializeGomokuBoard(board: readonly (readonly GomokuCell[])[]): string {
  return board
    .map((row) =>
      row
        .map((c) => (c === 'black' ? 'b' : c === 'white' ? 'w' : '.'))
        .join(''),
    )
    .join('/');
}

export function deserializeGomokuBoard(serialized: string, size: GomokuBoardSize): GomokuCell[][] {
  const rows = serialized.split('/');
  if (rows.length !== size) {
    return createGomokuStartBoard(size, 0, 'white').board;
  }
  return rows.map((row) =>
    row.split('').map((ch) => (ch === 'b' ? 'black' : ch === 'w' ? 'white' : null)),
  );
}

function startBoardPayload(settings: GomokuRoomSettings): {
  board: string;
  handicapKeys: string[];
} {
  const start = createGomokuStartBoard(
    settings.boardSize,
    settings.handicapStones,
    settings.handicapBeneficiary,
  );
  return {
    board: serializeGomokuBoard(start.board),
    handicapKeys: start.handicapKeys,
  };
}

function guestJoinUpdate(
  cur: GomokuRoomDoc,
  guest: GomokuRoomPlayer,
  startMode: GomokuOnlineStartMode,
): Record<string, unknown> {
  const { board, handicapKeys } = startBoardPayload(cur.settings);
  const boardBase = {
    board,
    handicapKeys,
    boardSize: cur.settings.boardSize,
    turn: 'black' as const,
    lastMoveAt: serverTimestamp(),
  };

  if (startMode === 'coin') {
    return {
      guest,
      status: 'side_pick' as const,
      ...boardBase,
      blackUid: '',
      whiteUid: '',
    };
  }

  const playingBase = {
    guest,
    status: 'playing' as const,
    ...boardBase,
  };
  if (startMode === 'guest_black') {
    return {
      ...playingBase,
      blackUid: guest.uid,
      whiteUid: cur.host.uid,
    };
  }
  return {
    ...playingBase,
    blackUid: cur.host.uid,
    whiteUid: guest.uid,
  };
}

export async function createGomokuRoom(
  host: GomokuRoomPlayer,
  settings: GomokuRoomSettings,
  hostRecord?: GomokuHostRecord,
  onlineStartMode: GomokuOnlineStartMode = 'default_black',
  recruitComment?: string,
): Promise<string> {
  const roomCode = randomRoomCode();
  const comment = recruitComment ? normalizeGomokuRecruitComment(recruitComment) : '';
  const { board, handicapKeys } = startBoardPayload(settings);

  await setDoc(doc(db, 'gomoku_rooms', roomCode), {
    roomCode,
    status: 'waiting',
    host,
    settings,
    ...(hostRecord ? { hostRecord } : {}),
    ...(comment ? { recruitComment: comment } : {}),
    onlineStartMode,
    board,
    handicapKeys,
    boardSize: settings.boardSize,
    turn: 'black',
    blackUid: '',
    whiteUid: '',
    createdAt: serverTimestamp(),
  });
  return roomCode;
}

export async function joinGomokuRoom(
  roomCode: string,
  guest: GomokuRoomPlayer,
): Promise<'ok' | 'not_found' | 'full' | 'self'> {
  const ref = doc(db, 'gomoku_rooms', roomCode.toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return 'not_found';

  const data = snap.data() as GomokuRoomDoc;
  if (data.host.uid === guest.uid) return 'self';
  if (data.guest?.uid || data.status !== 'waiting') return 'full';

  try {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('room gone');
      const cur = fresh.data() as GomokuRoomDoc;
      if (cur.guest?.uid || cur.status !== 'waiting') throw new Error('room full');
      const startMode = normalizeGomokuOnlineStartMode(cur.onlineStartMode);
      tx.update(ref, guestJoinUpdate(cur, guest, startMode));
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'room gone') return 'not_found';
    return 'full';
  }
}

export async function signalGomokuSidePickAnim(
  roomCode: string,
  uid: string,
  method: GomokuSidePickMethod,
): Promise<'ok' | 'forbidden' | 'not_ready' | 'not_found'> {
  const ref = doc(db, 'gomoku_rooms', roomCode.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('not_found');
      const cur = fresh.data() as GomokuRoomDoc;
      if (cur.status !== 'side_pick') throw new Error('not_ready');
      if (cur.host.uid !== uid) throw new Error('forbidden');
      if (!cur.guest) throw new Error('not_ready');
      tx.update(ref, { sidePickAnimMethod: method });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    if (msg === 'not_ready') return 'not_ready';
    return 'not_found';
  }
}

export async function commitGomokuSidePick(
  roomCode: string,
  uid: string,
  method: GomokuSidePickMethod,
): Promise<
  | { ok: true; hostColor: GomokuColor }
  | { ok: false; reason: 'forbidden' | 'not_ready' | 'not_found' }
> {
  const ref = doc(db, 'gomoku_rooms', roomCode.toUpperCase());

  try {
    let hostColor: GomokuColor = 'black';
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('not_found');
      const cur = fresh.data() as GomokuRoomDoc;
      if (cur.status !== 'side_pick') throw new Error('not_ready');
      if (cur.host.uid !== uid) throw new Error('forbidden');
      if (!cur.guest) throw new Error('not_ready');

      const hostIsBlack = Math.random() < 0.5;
      hostColor = hostIsBlack ? 'black' : 'white';
      const blackUid = hostIsBlack ? cur.host.uid : cur.guest.uid;
      const whiteUid = hostIsBlack ? cur.guest.uid : cur.host.uid;
      const { board, handicapKeys } = startBoardPayload(cur.settings);

      tx.update(ref, {
        status: 'side_reveal',
        blackUid,
        whiteUid,
        board,
        handicapKeys,
        turn: 'black',
        sidePickMethod: method,
        sidePickAnimMethod: deleteField(),
      });
    });
    return { ok: true, hostColor };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return { ok: false, reason: 'forbidden' };
    if (msg === 'not_ready') return { ok: false, reason: 'not_ready' };
    return { ok: false, reason: 'not_found' };
  }
}

export async function beginGomokuRoomPlay(
  roomCode: string,
  uid: string,
): Promise<'ok' | 'forbidden' | 'not_ready' | 'not_found'> {
  const ref = doc(db, 'gomoku_rooms', roomCode.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('not_found');
      const cur = fresh.data() as GomokuRoomDoc;
      if (cur.status === 'playing') return;
      if (cur.status !== 'side_reveal') throw new Error('not_ready');
      const isMember = cur.host.uid === uid || cur.guest?.uid === uid;
      if (!isMember) throw new Error('forbidden');
      tx.update(ref, {
        status: 'playing',
        lastMoveAt: serverTimestamp(),
      });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    if (msg === 'not_ready') return 'not_ready';
    return 'not_found';
  }
}

export function subscribeGomokuRoom(
  roomCode: string,
  onChange: (room: GomokuRoomDoc | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'gomoku_rooms', roomCode.toUpperCase()),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(snap.data() as GomokuRoomDoc);
    },
    (err) => onError?.(err),
  );
}

const OPEN_ROOM_MAX_AGE_MS = 45 * 60 * 1000;
const OPEN_ROOM_LIST_LIMIT = 24;

export function subscribeOpenGomokuRooms(
  onChange: (rooms: GomokuRoomDoc[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'gomoku_rooms'),
    where('status', '==', 'waiting'),
    limit(OPEN_ROOM_LIST_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const rooms = snap.docs
        .map((d) => d.data() as GomokuRoomDoc)
        .filter((room) => {
          const createdMs = firestoreLikeToMillis(room.createdAt);
          if (createdMs == null) return true;
          return now - createdMs < OPEN_ROOM_MAX_AGE_MS;
        })
        .sort((a, b) => {
          const am = firestoreLikeToMillis(a.createdAt) ?? 0;
          const bm = firestoreLikeToMillis(b.createdAt) ?? 0;
          return bm - am;
        });
      onChange(rooms);
    },
    (err) => onError?.(err),
  );
}

export function colorForGomokuUid(room: GomokuRoomDoc, uid: string | null): GomokuColor | null {
  if (!uid) return null;
  if (room.blackUid === uid) return 'black';
  if (room.whiteUid === uid) return 'white';
  return null;
}

export async function submitGomokuRoomMove(
  roomCode: string,
  uid: string,
  row: number,
  col: number,
): Promise<'ok' | 'forbidden' | 'invalid'> {
  const ref = doc(db, 'gomoku_rooms', roomCode.toUpperCase());

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('missing');
      const room = snap.data() as GomokuRoomDoc;
      if (room.status !== 'playing') throw new Error('not playing');

      const myColor: GomokuColor | null =
        room.blackUid === uid ? 'black' : room.whiteUid === uid ? 'white' : null;
      if (!myColor || room.turn !== myColor) throw new Error('forbidden');

      const board = deserializeGomokuBoard(room.board, room.boardSize);
      if (!isValidGomokuMove(board, row, col)) throw new Error('invalid');

      const nextBoard = applyGomokuMove(board, row, col, myColor);
      const winner = getGomokuWinnerAfterMove(nextBoard, row, col, myColor);
      const coord = gomokuCoordLabel(col, row, boardGridColumnLabel);

      if (winner) {
        tx.update(ref, {
          board: serializeGomokuBoard(nextBoard),
          winner,
          status: 'finished',
          endReason: 'normal',
          lastMoveCoord: coord,
          lastMoveAt: serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          board: serializeGomokuBoard(nextBoard),
          turn: gomokuOpponent(myColor),
          lastMoveCoord: coord,
          lastMoveAt: serverTimestamp(),
        });
      }
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    return 'invalid';
  }
}

export async function abandonGomokuRoom(
  roomCode: string,
  uid: string,
): Promise<'ok' | 'forbidden' | 'not_found'> {
  const ref = doc(db, 'gomoku_rooms', roomCode.toUpperCase());

  try {
    let outcome: 'ok' | 'not_found' = 'not_found';
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as GomokuRoomDoc;
      const isMember = room.host.uid === uid || room.guest?.uid === uid;
      if (!isMember) throw new Error('forbidden');

      if (room.status === 'waiting' && room.host.uid === uid) {
        tx.delete(ref);
        outcome = 'ok';
        return;
      }

      if (
        room.status === 'side_pick' ||
        room.status === 'side_reveal' ||
        room.status === 'playing'
      ) {
        const winner: GomokuColor | undefined =
          room.status === 'playing' && uid === room.blackUid
            ? 'white'
            : room.status === 'playing' && uid === room.whiteUid
              ? 'black'
              : undefined;
        tx.update(ref, {
          status: 'finished',
          endReason: 'abandoned',
          endedBy: uid,
          ...(winner ? { winner } : { winner: deleteField() }),
        });
        outcome = 'ok';
        return;
      }

      if (room.status === 'finished') {
        outcome = 'ok';
      }
    });
    return outcome;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    return 'not_found';
  }
}

export function gomokuOpenRoomRulesJa(room: GomokuRoomDoc): string {
  const h = room.settings.handicapStones;
  const handicap =
    h > 0
      ? `星ハンデ${gomokuHandicapLabelJa(h)}（${room.settings.handicapBeneficiary === 'black' ? '黒' : '白'}）`
      : 'ハンデなし';
  return `${gomokuBoardSizeLabelJa(room.settings.boardSize)} · ${handicap} · ${gomokuOnlineStartModeLabelJa(room.onlineStartMode)}`;
}

export function gomokuWaitingAgeJa(createdAt: unknown, nowMs = Date.now()): string {
  const createdMs = firestoreLikeToMillis(createdAt);
  if (createdMs == null) return 'たった今';
  const sec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
  if (sec < 60) return 'たった今';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

export function gomokuHandicapKeysSet(keys: string[] | undefined): Set<string> {
  return new Set(keys ?? []);
}
