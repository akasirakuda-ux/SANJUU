import type { TileMatchDifficultyId } from './config';
import { buildLayoutForGame } from './layoutCatalog';
import { TILE_GRID_SPAN, type TileSlot } from './layouts';
import { buildSymbolDeck } from './symbols';

export interface TileMatchTile {
  slotId: number;
  symbol: string;
  removed: boolean;
}

export interface TileMatchMove {
  slotA: number;
  slotB: number;
}

export interface TileMatchBoard {
  difficulty: TileMatchDifficultyId;
  layoutId: string;
  layoutLabelJa: string;
  slots: TileSlot[];
  tiles: TileMatchTile[];
  selectedSlotId: number | null;
  hintsUsed: number;
  undosUsed: number;
  undoStack: TileMatchMove[];
}

/** 表示と同じく、層が上がるほど半マスずれる論理位置 */
function effectiveLayerCoord(slot: TileSlot): { x: number; y: number } {
  return { x: slot.x + slot.layer, y: slot.y + slot.layer };
}

function tilesOverlap(a: TileSlot, b: TileSlot): boolean {
  const ae = effectiveLayerCoord(a);
  const be = effectiveLayerCoord(b);
  return (
    Math.abs(ae.x - be.x) <= TILE_GRID_SPAN && Math.abs(ae.y - be.y) <= TILE_GRID_SPAN
  );
}

/** 上の層の牌が下を覆っている（上海型・面が重なる） */
function isAbove(upper: TileSlot, lower: TileSlot): boolean {
  return upper.layer > lower.layer && tilesOverlap(upper, lower);
}

/** 同じ層で左右に隣接し、取り除きの妨げになる */
function isSideNeighbor(a: TileSlot, b: TileSlot): boolean {
  if (a.layer !== b.layer) return false;
  if (Math.abs(a.y - b.y) >= TILE_GRID_SPAN) return false;
  return a.x + TILE_GRID_SPAN === b.x || a.x === b.x + TILE_GRID_SPAN;
}

/** 盤上の牌だけを見て、そのマスが取れる／置けるか（未配置マスも判定可） */
export function isSlotPlaceable(
  slotId: number,
  slots: TileSlot[],
  tiles: TileMatchTile[]
): boolean {
  const slot = slots[slotId];
  if (!slot) return false;

  for (let i = 0; i < slots.length; i++) {
    if (i === slotId) continue;
    const other = tiles[i];
    if (!other || other.removed) continue;
    if (isAbove(slots[i], slot)) return false;
  }

  let leftBlocked = false;
  let rightBlocked = false;
  for (let i = 0; i < slots.length; i++) {
    if (i === slotId) continue;
    const other = tiles[i];
    if (!other || other.removed) continue;
    if (!isSideNeighbor(slots[i], slot)) continue;
    if (slots[i].x < slot.x) leftBlocked = true;
    if (slots[i].x > slot.x) rightBlocked = true;
  }
  return !leftBlocked || !rightBlocked;
}

export function isSlotFree(
  slotId: number,
  slots: TileSlot[],
  tiles: TileMatchTile[]
): boolean {
  const tile = tiles[slotId];
  if (!tile || tile.removed) return false;
  return isSlotPlaceable(slotId, slots, tiles);
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTwo<T>(arr: T[], rand: () => number): [T, T] | null {
  if (arr.length < 2) return null;
  const i = Math.floor(rand() * arr.length);
  let j = Math.floor(rand() * (arr.length - 1));
  if (j >= i) j++;
  return [arr[i], arr[j]];
}

/** 逆順で積む — 必ず1手以上取れる配牌になる */
function tryDealSolvable(
  difficulty: TileMatchDifficultyId,
  slots: TileSlot[],
  deck: string[],
  seed: number
): TileMatchBoard | null {
  const symCount = new Map<string, number>();
  for (const sym of deck) {
    symCount.set(sym, (symCount.get(sym) ?? 0) + 1);
  }
  const symbols = [...symCount.keys()];
  const tiles: TileMatchTile[] = slots.map((s) => ({
    slotId: s.id,
    symbol: '?',
    removed: true,
  }));
  const remaining = new Set(slots.map((s) => s.id));
  const rand = mulberry32(seed);

  while (remaining.size > 0) {
    const placeable = [...remaining].filter((id) => isSlotPlaceable(id, slots, tiles));
    const pairSlots = pickTwo(placeable, rand);
    if (!pairSlots) return null;

    const available = symbols.filter((sym) => (symCount.get(sym) ?? 0) >= 2);
    if (available.length === 0) return null;
    const sym = available[Math.floor(rand() * available.length)];

    const [idA, idB] = pairSlots;
    tiles[idA] = { slotId: idA, symbol: sym, removed: false };
    tiles[idB] = { slotId: idB, symbol: sym, removed: false };
    remaining.delete(idA);
    remaining.delete(idB);
    symCount.set(sym, (symCount.get(sym) ?? 0) - 2);
  }

  return {
    difficulty,
    slots,
    tiles,
    selectedSlotId: null,
    hintsUsed: 0,
    undosUsed: 0,
    undoStack: [],
  };
}

export function listRemovablePairs(board: TileMatchBoard): TileMatchMove[] {
  const freeIds: number[] = [];
  for (let i = 0; i < board.tiles.length; i++) {
    const t = board.tiles[i];
    if (!t || t.removed) continue;
    if (!isSlotFree(i, board.slots, board.tiles)) continue;
    freeIds.push(i);
  }
  const moves: TileMatchMove[] = [];
  for (let a = 0; a < freeIds.length; a++) {
    for (let b = a + 1; b < freeIds.length; b++) {
      const idA = freeIds[a];
      const idB = freeIds[b];
      if (board.tiles[idA]?.symbol === board.tiles[idB]?.symbol) {
        moves.push({ slotA: idA, slotB: idB });
      }
    }
  }
  return moves;
}

export function hasRemovablePair(board: TileMatchBoard): boolean {
  return listRemovablePairs(board).length > 0;
}

/** 残り牌の記号だけ入れ替えて、取れるペアが出るまで試す */
export function reshuffleRemainingSymbols(
  board: TileMatchBoard,
  seed = Date.now()
): TileMatchBoard | null {
  const activeIds = board.tiles.filter((t) => !t.removed).map((t) => t.slotId);
  if (activeIds.length < 2) return board;

  const symbols = activeIds.map((id) => board.tiles[id]?.symbol ?? '?');
  const rand = mulberry32(seed);

  for (let attempt = 0; attempt < 120; attempt++) {
    const shuffled = [...symbols];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const tiles = board.tiles.map((t) => {
      if (t.removed) return t;
      const idx = activeIds.indexOf(t.slotId);
      return { ...t, symbol: shuffled[idx] ?? t.symbol };
    });
    const next = { ...board, tiles, selectedSlotId: null };
    if (hasRemovablePair(next)) return next;
  }
  return null;
}

export function createTileMatchBoard(
  difficulty: TileMatchDifficultyId,
  seed = Date.now()
): TileMatchBoard {
  const { slots, layoutId, layoutLabelJa } = buildLayoutForGame(difficulty, seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const deck = buildSymbolDeck(slots.length, seed + attempt * 7919);
    const board = tryDealSolvable(difficulty, slots, deck, seed + attempt * 31337);
    if (board && hasRemovablePair(board)) {
      return { ...board, layoutId, layoutLabelJa };
    }
  }
  const deck = buildSymbolDeck(slots.length, seed ^ 0x9e3779b9);
  const fallback = tryDealSolvable(difficulty, slots, deck, seed ^ 0x85ebca6b);
  if (fallback && hasRemovablePair(fallback)) {
    return { ...fallback, layoutId, layoutLabelJa };
  }
  const tiles: TileMatchTile[] = slots.map((s, i) => ({
    slotId: s.id,
    symbol: deck[i] ?? '?',
    removed: false,
  }));
  return {
    difficulty,
    layoutId,
    layoutLabelJa,
    slots,
    tiles,
    selectedSlotId: null,
    hintsUsed: 0,
    undosUsed: 0,
    undoStack: [],
  };
}

export function isBoardCleared(board: TileMatchBoard): boolean {
  return board.tiles.every((t) => t.removed);
}

export function findHintPair(board: TileMatchBoard): TileMatchMove | null {
  const moves = listRemovablePairs(board);
  return moves[0] ?? null;
}

export function applyRemovePair(board: TileMatchBoard, move: TileMatchMove): TileMatchBoard {
  const tiles = board.tiles.map((t) => {
    if (t.slotId === move.slotA || t.slotId === move.slotB) {
      return { ...t, removed: true };
    }
    return t;
  });
  return {
    ...board,
    tiles,
    selectedSlotId: null,
    undoStack: [...board.undoStack, move],
  };
}

export function undoLastMove(board: TileMatchBoard): TileMatchBoard | null {
  const last = board.undoStack[board.undoStack.length - 1];
  if (!last) return null;
  const tiles = board.tiles.map((t) => {
    if (t.slotId === last.slotA || t.slotId === last.slotB) {
      return { ...t, removed: false };
    }
    return t;
  });
  return {
    ...board,
    tiles,
    selectedSlotId: null,
    undoStack: board.undoStack.slice(0, -1),
    undosUsed: board.undosUsed + 1,
  };
}

export function tapSlot(board: TileMatchBoard, slotId: number): {
  board: TileMatchBoard;
  removed?: TileMatchMove;
  error?: 'not_free' | 'mismatch';
} {
  if (!isSlotFree(slotId, board.slots, board.tiles)) {
    return { board, error: 'not_free' };
  }

  const selected = board.selectedSlotId;
  if (selected == null) {
    return { board: { ...board, selectedSlotId: slotId } };
  }
  if (selected === slotId) {
    return { board: { ...board, selectedSlotId: null } };
  }

  const symA = board.tiles[selected]?.symbol;
  const symB = board.tiles[slotId]?.symbol;
  if (symA !== symB) {
    return { board: { ...board, selectedSlotId: slotId }, error: 'mismatch' };
  }

  if (!isSlotFree(selected, board.slots, board.tiles)) {
    return { board: { ...board, selectedSlotId: slotId }, error: 'not_free' };
  }

  const move = { slotA: selected, slotB: slotId };
  return { board: applyRemovePair(board, move), removed: move };
}
