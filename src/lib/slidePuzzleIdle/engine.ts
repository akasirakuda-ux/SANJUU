import {
  SLIDE_PUZZLE_GRID_SIZE,
  SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT,
  createSolvedSlideBoard,
  findSlidePuzzleEmptyIndex,
  isSlidePuzzleSolved,
  moveSlideTile,
  slidePuzzleBoardKey,
  type SlidePuzzleArtId,
  type SlidePuzzleGridSize,
} from '../slidePuzzleLogic';
import { SLIDE_IDLE_MAX_PENDING_CREDITS } from './config';

export type SlideIdleMode = 'manual' | 'countdown' | 'autoPlay';

/** 完成形から逆シャッフルした1セッション */
export type GeneratedIdlePuzzle = {
  board: number[];
  /** シャッフル順の undo index（空きマスが動く前の cell index） */
  undoMoves: number[];
  /** 混ぜ直後から完成までのタップ index 列（お手伝い・検証用） */
  helpTapMoves: number[];
};

export type IdlePuzzleSnapshot = {
  artId: SlidePuzzleArtId;
  board: number[];
  undoMoves: readonly number[];
  resolvedStep: number;
  /** 広告でためた未解放の手数 */
  pendingCredits: number;
  mode: SlideIdleMode;
  exitRequested: boolean;
  boardKeyAtShuffle: string;
};

function neighborIndices(index: number, gridSize: SlidePuzzleGridSize): number[] {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const neighbors: number[] = [];
  if (col > 0) neighbors.push(index - 1);
  if (col < gridSize - 1) neighbors.push(index + 1);
  if (row > 0) neighbors.push(index - gridSize);
  if (row < gridSize - 1) neighbors.push(index + gridSize);
  return neighbors;
}

/** 再現可能な軽量 PRNG（テスト用 seed 対応） */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateIdlePuzzle(options?: {
  gridSize?: SlidePuzzleGridSize;
  moveCount?: number;
  seed?: number;
  random?: () => number;
}): GeneratedIdlePuzzle {
  const gridSize = options?.gridSize ?? SLIDE_PUZZLE_GRID_SIZE;
  const moveCount = options?.moveCount ?? SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT;
  const random = options?.random ?? (options?.seed != null ? createSeededRandom(options.seed) : Math.random);

  let board = createSolvedSlideBoard(gridSize);
  let emptyIndex = findSlidePuzzleEmptyIndex(board, gridSize);
  let previousEmpty = -1;
  const undoMoves: number[] = [];

  for (let step = 0; step < moveCount; step += 1) {
    let candidates = neighborIndices(emptyIndex, gridSize).filter((index) => index !== previousEmpty);
    if (candidates.length === 0) {
      candidates = neighborIndices(emptyIndex, gridSize);
    }
    const pick = candidates[Math.floor(random() * candidates.length)]!;
    undoMoves.push(emptyIndex);
    [board[emptyIndex], board[pick]] = [board[pick], board[emptyIndex]];
    previousEmpty = emptyIndex;
    emptyIndex = pick;
  }

  const helpTapMoves: number[] = [];
  let solveBoard = [...board];
  for (let i = undoMoves.length - 1; i >= 0; i -= 1) {
    const fromIndex = undoMoves[i]!;
    helpTapMoves.push(fromIndex);
    const next = moveSlideTile(solveBoard, fromIndex, gridSize);
    if (!next) break;
    solveBoard = next;
  }

  return { board, undoMoves, helpTapMoves };
}

export function createIdleSnapshot(
  artId: SlidePuzzleArtId,
  generated: GeneratedIdlePuzzle,
  mode: SlideIdleMode = 'manual',
): IdlePuzzleSnapshot {
  return {
    artId,
    board: [...generated.board],
    undoMoves: generated.undoMoves,
    resolvedStep: 0,
    pendingCredits: 0,
    mode,
    exitRequested: false,
    boardKeyAtShuffle: slidePuzzleBoardKey(generated.board),
  };
}

export function idleSnapshotRemainingSteps(snapshot: IdlePuzzleSnapshot): number {
  return Math.max(0, snapshot.undoMoves.length - snapshot.resolvedStep);
}

export function idleSnapshotMaxBankableCredits(snapshot: IdlePuzzleSnapshot): number {
  return Math.min(SLIDE_IDLE_MAX_PENDING_CREDITS, idleSnapshotRemainingSteps(snapshot));
}

export function isIdleCreditBankFull(snapshot: IdlePuzzleSnapshot): boolean {
  return snapshot.pendingCredits >= idleSnapshotMaxBankableCredits(snapshot);
}

/** 広告1本 → クレジット+1（上限・残り手数を尊重） */
export function addIdlePendingCredit(snapshot: IdlePuzzleSnapshot): IdlePuzzleSnapshot {
  if (isIdleCreditBankFull(snapshot)) return snapshot;
  return { ...snapshot, pendingCredits: snapshot.pendingCredits + 1 };
}

export function idleSnapshotTotalSteps(snapshot: IdlePuzzleSnapshot): number {
  return snapshot.undoMoves.length;
}

export function isIdleSnapshotSolved(snapshot: IdlePuzzleSnapshot): boolean {
  return isSlidePuzzleSolved(snapshot.board, SLIDE_PUZZLE_GRID_SIZE);
}

export function canApplyIdleUndoStep(snapshot: IdlePuzzleSnapshot): boolean {
  return snapshot.resolvedStep < snapshot.undoMoves.length;
}

/** 広告1本ごとに1手 — 記録したシャッフルを逆順で戻す */
export function getIdleUndoFromIndex(snapshot: IdlePuzzleSnapshot): number | null {
  if (!canApplyIdleUndoStep(snapshot)) return null;
  const undoIndex = snapshot.undoMoves.length - 1 - snapshot.resolvedStep;
  return snapshot.undoMoves[undoIndex] ?? null;
}

export function applyIdleUndoStep(snapshot: IdlePuzzleSnapshot): IdlePuzzleSnapshot {
  const fromIndex = getIdleUndoFromIndex(snapshot);
  if (fromIndex == null) return snapshot;

  const nextBoard = moveSlideTile(snapshot.board, fromIndex, SLIDE_PUZZLE_GRID_SIZE);
  if (!nextBoard) return snapshot;

  return {
    ...snapshot,
    board: nextBoard,
    resolvedStep: snapshot.resolvedStep + 1,
  };
}

/** helpTapMoves ですべて完成するか（100手検証） */
export function verifyHelpTapMovesSolve(
  startBoard: readonly number[],
  helpTapMoves: readonly number[],
  gridSize: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE,
): boolean {
  let board = [...startBoard];
  for (const fromIndex of helpTapMoves) {
    const next = moveSlideTile(board, fromIndex, gridSize);
    if (!next) return false;
    board = next;
  }
  return isSlidePuzzleSolved(board, gridSize);
}
