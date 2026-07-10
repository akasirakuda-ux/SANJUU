import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import type { TileMatchDifficultyId } from './config';
import { TILE_MATCH_HINT_LIMIT } from './config';
import {
  createTileMatchBoard,
  findHintPair,
  hasRemovablePair,
  isBoardCleared,
  isSlotFree,
  reshuffleRemainingSymbols,
  type TileMatchBoard,
  type TileMatchMove,
  type TileMatchTile,
} from './engine';
import type { TileSlot } from './layouts';

export type TileMatchHundredFirestore = {
  difficulty: TileMatchDifficultyId;
  layoutId: string;
  layoutLabelJa: string;
  slots: TileSlot[];
  tiles: TileMatchTile[];
  hintsUsed: number;
  undosUsed: number;
};

export function tileMatchBoardToFirestore(board: TileMatchBoard): TileMatchHundredFirestore {
  return {
    difficulty: board.difficulty,
    layoutId: board.layoutId,
    layoutLabelJa: board.layoutLabelJa,
    slots: board.slots.map((s) => ({
      id: s.id,
      layer: s.layer,
      x: s.x,
      y: s.y,
    })),
    tiles: board.tiles.map((t) => ({
      slotId: t.slotId,
      symbol: t.symbol,
      removed: t.removed,
    })),
    hintsUsed: board.hintsUsed,
    undosUsed: board.undosUsed,
  };
}

export function tileMatchBoardFromFirestore(raw: unknown): TileMatchBoard | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as TileMatchHundredFirestore;
  if (!Array.isArray(d.slots) || !Array.isArray(d.tiles) || d.slots.length === 0) return null;
  const slots: TileSlot[] = d.slots.map((s, i) => ({
    id: typeof s.id === 'number' ? s.id : i,
    layer: typeof s.layer === 'number' ? s.layer : 0,
    x: typeof s.x === 'number' ? s.x : 0,
    y: typeof s.y === 'number' ? s.y : 0,
  }));
  const tiles: TileMatchTile[] = slots.map((s) => {
    const t = d.tiles.find((x) => x?.slotId === s.id) ?? d.tiles[s.id];
    return {
      slotId: s.id,
      symbol: typeof t?.symbol === 'string' ? t.symbol : '?',
      removed: !!t?.removed,
    };
  });
  return {
    difficulty: d.difficulty ?? 'normal',
    layoutId: typeof d.layoutId === 'string' ? d.layoutId : 'unknown',
    layoutLabelJa: typeof d.layoutLabelJa === 'string' ? d.layoutLabelJa : '',
    slots,
    tiles,
    selectedSlotId: null,
    hintsUsed: typeof d.hintsUsed === 'number' ? d.hintsUsed : 0,
    undosUsed: typeof d.undosUsed === 'number' ? d.undosUsed : 0,
    undoStack: [],
  };
}

export function mergeTileMatchBoard(
  prev: TileMatchBoard | null,
  remote: TileMatchBoard,
  localSelectedSlotId: number | null
): TileMatchBoard {
  return {
    ...remote,
    selectedSlotId: localSelectedSlotId,
    undoStack: prev?.undoStack ?? [],
  };
}

export async function commitTileMatchRemovePair(
  roomId: string,
  move: TileMatchMove,
  displayName: string,
  userEmoji: string
): Promise<{ ok: true; cleared: boolean } | { ok: false; reason: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { ok: false, reason: 'not_signed_in' };

  const roomRef = doc(db, 'hundred_rooms', roomId);
  const playerRef = doc(db, 'hundred_rooms', roomId, 'players', uid);

  try {
    const cleared = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('room_missing');
      const data = snap.data() as Record<string, unknown>;
      const board = tileMatchBoardFromFirestore(data.tileMatch);
      if (!board) throw new Error('board_missing');

      const symA = board.tiles[move.slotA]?.symbol;
      const symB = board.tiles[move.slotB]?.symbol;
      if (!symA || symA !== symB) throw new Error('mismatch');
      if (!isSlotFree(move.slotA, board.slots, board.tiles)) throw new Error('not_free');
      if (!isSlotFree(move.slotB, board.slots, board.tiles)) throw new Error('not_free');

      const tiles = board.tiles.map((t) => {
        if (t.slotId === move.slotA || t.slotId === move.slotB) {
          return { ...t, removed: true };
        }
        return t;
      });

      const nextBoard: TileMatchBoard = {
        ...board,
        tiles,
        selectedSlotId: null,
      };

      tx.set(
        roomRef,
        {
          tileMatch: tileMatchBoardToFirestore(nextBoard),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        playerRef,
        {
          uid,
          name: displayName.slice(0, 32),
          emoji: userEmoji || '🌸',
          foundCount: increment(1),
          lastActiveAt: serverTimestamp(),
        },
        { merge: true }
      );

      return isBoardCleared(nextBoard);
    });
    return { ok: true, cleared };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }
}

export async function commitTileMatchHint(roomId: string): Promise<TileMatchMove | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const roomRef = doc(db, 'hundred_rooms', roomId);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return null;
      const board = tileMatchBoardFromFirestore((snap.data() as any).tileMatch);
      if (!board) return null;
      if (board.hintsUsed >= TILE_MATCH_HINT_LIMIT) return null;
      const pair = findHintPair(board);
      if (!pair) return null;
      const next = { ...board, hintsUsed: board.hintsUsed + 1 };
      tx.set(
        roomRef,
        {
          tileMatch: tileMatchBoardToFirestore(next),
          tileMatchHint: { a: pair.slotA, b: pair.slotB, at: Date.now() },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return pair;
    });
  } catch {
    return null;
  }
}

export async function commitTileMatchShuffle(
  roomId: string,
  hostUid: string
): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== hostUid) return false;
  const roomRef = doc(db, 'hundred_rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return false;
  const board = tileMatchBoardFromFirestore((snap.data() as any).tileMatch);
  if (!board) return false;
  const mixed = reshuffleRemainingSymbols(board, Date.now());
  if (!mixed) return false;
  await setDoc(
    roomRef,
    {
      tileMatch: tileMatchBoardToFirestore(mixed),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}

export function buildInitialTileMatchRoomBoard(
  difficulty: TileMatchDifficultyId,
  seed = Date.now()
): TileMatchBoard {
  const board = createTileMatchBoard(difficulty, seed);
  return board;
}

export function boardHasPlayablePair(board: TileMatchBoard): boolean {
  return hasRemovablePair(board);
}
