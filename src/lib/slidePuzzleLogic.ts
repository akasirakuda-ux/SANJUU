export const SLIDE_PUZZLE_GRID_SIZE = 3 as const;
export type SlidePuzzleGridSize = typeof SLIDE_PUZZLE_GRID_SIZE;

/** 「混ぜる」・放置モード共通 — 完成までの逆シャッフル手数 */
export const SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT = 40;
export type SlidePuzzleArtId = 'r-hero' | 'thumbs-up';

export interface SlidePuzzleArt {
  id: SlidePuzzleArtId;
  labelJa: string;
  url: string;
  width: number;
  height: number;
}

/** 絵ごとの実ピクセル（盤面は 1:1 正方形・絵は中央クロップ） */
export const SLIDE_PUZZLE_ARTS: Record<SlidePuzzleArtId, SlidePuzzleArt> = {
  'r-hero': {
    id: 'r-hero',
    labelJa: 'ヒーロー',
    url: '/games/slide-puzzle/r-hero.png',
    width: 873,
    height: 960,
  },
  'thumbs-up': {
    id: 'thumbs-up',
    labelJa: 'おにぎり',
    url: '/games/slide-puzzle/thumbs-up.png',
    width: 873,
    height: 960,
  },
};

export const SLIDE_PUZZLE_ART_IDS = Object.keys(SLIDE_PUZZLE_ARTS) as SlidePuzzleArtId[];

export function getSlidePuzzleArt(artId: SlidePuzzleArtId): SlidePuzzleArt {
  return SLIDE_PUZZLE_ARTS[artId];
}

const SLIDE_PUZZLE_SESSION_STORAGE_KEY = 'rakuda_slide_idle_session_v2';

/** スライドパズルで最後に選んだ絵（ペア探しの卓背景など） */
export function readSlidePuzzlePreferredArtId(): SlidePuzzleArtId {
  try {
    if (typeof localStorage === 'undefined') return 'r-hero';
    const raw = localStorage.getItem(SLIDE_PUZZLE_SESSION_STORAGE_KEY);
    if (!raw) return 'r-hero';
    const parsed = JSON.parse(raw) as { artId?: string };
    if (parsed.artId === 'r-hero' || parsed.artId === 'thumbs-up') return parsed.artId;
  } catch {
    /* noop */
  }
  return 'r-hero';
}

export function getSlidePuzzlePreferredArt(): SlidePuzzleArt {
  return getSlidePuzzleArt(readSlidePuzzlePreferredArtId());
}

export function getSlidePuzzleTileCount(gridSize: SlidePuzzleGridSize): number {
  return gridSize * gridSize;
}

export function getSlidePuzzleEmptyTile(gridSize: SlidePuzzleGridSize): number {
  return getSlidePuzzleTileCount(gridSize) - 1;
}

export function createSolvedSlideBoard(gridSize: SlidePuzzleGridSize): number[] {
  return Array.from({ length: getSlidePuzzleTileCount(gridSize) }, (_, index) => index);
}

export function isSlidePuzzleSolved(board: readonly number[], gridSize: SlidePuzzleGridSize): boolean {
  const tileCount = getSlidePuzzleTileCount(gridSize);
  return board.length === tileCount && board.every((tile, index) => tile === index);
}

export function findSlidePuzzleEmptyIndex(board: readonly number[], gridSize: SlidePuzzleGridSize): number {
  return board.indexOf(getSlidePuzzleEmptyTile(gridSize));
}

function slidePuzzleNeighborIndices(index: number, gridSize: SlidePuzzleGridSize): number[] {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const neighbors: number[] = [];
  if (col > 0) neighbors.push(index - 1);
  if (col < gridSize - 1) neighbors.push(index + 1);
  if (row > 0) neighbors.push(index - gridSize);
  if (row < gridSize - 1) neighbors.push(index + gridSize);
  return neighbors;
}

export function canSlideTile(
  board: readonly number[],
  fromIndex: number,
  gridSize: SlidePuzzleGridSize,
): boolean {
  const tileCount = getSlidePuzzleTileCount(gridSize);
  if (fromIndex < 0 || fromIndex >= tileCount) return false;
  const emptyIndex = findSlidePuzzleEmptyIndex(board, gridSize);
  if (emptyIndex < 0) return false;
  return slidePuzzleNeighborIndices(emptyIndex, gridSize).includes(fromIndex);
}

export function moveSlideTile(
  board: readonly number[],
  fromIndex: number,
  gridSize: SlidePuzzleGridSize,
): number[] | null {
  if (!canSlideTile(board, fromIndex, gridSize)) return null;
  const emptyIndex = findSlidePuzzleEmptyIndex(board, gridSize);
  const next = [...board];
  [next[fromIndex], next[emptyIndex]] = [next[emptyIndex], next[fromIndex]];
  return next;
}

/** 完成形から合法手だけを繰り返し、必ず解ける盤面にする */
export function shuffleSlideBoard(
  gridSize: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE,
  moveCount = SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT,
): number[] {
  return shuffleSlideBoardWithHelp(gridSize, moveCount).board;
}

export type ShuffledSlideBoard = {
  board: number[];
  /** 「混ぜる」直後の盤面から完成までのタップ index 列（3×3 お手伝い用） */
  helpTapMoves: number[];
};

/** シャッフルと同時に、逆手順のお手伝い用タップ列を生成（BFS 不要・軽量） */
export function shuffleSlideBoardWithHelp(
  gridSize: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE,
  moveCount = SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT,
): ShuffledSlideBoard {
  let board = createSolvedSlideBoard(gridSize);
  let emptyIndex = findSlidePuzzleEmptyIndex(board, gridSize);
  let previousEmpty = -1;
  const undoFromIndices: number[] = [];

  for (let step = 0; step < moveCount; step += 1) {
    const candidates = slidePuzzleNeighborIndices(emptyIndex, gridSize).filter((index) => index !== previousEmpty);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    undoFromIndices.push(emptyIndex);
    [board[emptyIndex], board[pick]] = [board[pick], board[emptyIndex]];
    previousEmpty = emptyIndex;
    emptyIndex = pick;
  }

  const helpTapMoves: number[] = [];
  let solveBoard = [...board];
  for (let i = undoFromIndices.length - 1; i >= 0; i -= 1) {
    const fromIndex = undoFromIndices[i]!;
    helpTapMoves.push(fromIndex);
    const next = moveSlideTile(solveBoard, fromIndex, gridSize);
    if (!next) break;
    solveBoard = next;
  }

  return { board, helpTapMoves };
}

export function slidePuzzleBoardKey(board: readonly number[]): string {
  return board.join(',');
}

export function slidePuzzleTileBackgroundPosition(tileId: number, gridSize: SlidePuzzleGridSize): string {
  const row = Math.floor(tileId / gridSize);
  const col = tileId % gridSize;
  const x = gridSize === 1 ? 0 : (col / (gridSize - 1)) * 100;
  const y = gridSize === 1 ? 0 : (row / (gridSize - 1)) * 100;
  return `${x}% ${y}%`;
}

/** 盤面は正方形（1:1）。絵が縦長でも中央で正方形クロップしてタイルに割り当てる */
export function slidePuzzleTileBackgroundStyle(
  tileId: number,
  gridSize: SlidePuzzleGridSize,
  art: SlidePuzzleArt,
): { backgroundSize: string; backgroundPosition: string } {
  const n = gridSize;
  const crop = Math.min(art.width, art.height);
  const cropX = (art.width - crop) / 2;
  const cropY = (art.height - crop) / 2;
  const col = tileId % n;
  const row = Math.floor(tileId / n);

  const bgSizeX = (art.width / crop) * n * 100;
  const bgSizeY = (art.height / crop) * n * 100;

  const imgX = cropX + col * (crop / n);
  const imgY = cropY + row * (crop / n);

  const offsetX = (-imgX * n) / crop;
  const offsetY = (-imgY * n) / crop;

  const bgW = bgSizeX / 100;
  const bgH = bgSizeY / 100;

  const posX = bgW === 1 ? 0 : (offsetX / (1 - bgW)) * 100;
  const posY = bgH === 1 ? 0 : (offsetY / (1 - bgH)) * 100;

  return {
    backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}

export function slidePuzzleCellLayout(index: number, gridSize: SlidePuzzleGridSize) {
  const step = 100 / gridSize;
  return {
    width: `${step}%`,
    height: `${step}%`,
    left: `${(index % gridSize) * step}%`,
    top: `${Math.floor(index / gridSize) * step}%`,
  };
}

/** 盤面が gridSize² の順列 0..n-1 か */
export function isValidSlideBoard(board: readonly number[], gridSize: SlidePuzzleGridSize): boolean {
  const n = getSlidePuzzleTileCount(gridSize);
  if (board.length !== n) return false;
  const seen = new Set<number>();
  for (const tile of board) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= n || seen.has(tile)) return false;
    seen.add(tile);
  }
  return seen.size === n;
}

/** 不正な長さ（旧5×5セッション等）は null。合法ならコピーを返す */
export function normalizeSlideBoard(
  board: readonly number[],
  gridSize: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE,
): number[] | null {
  if (!isValidSlideBoard(board, gridSize)) return null;
  return [...board];
}

/** 3×3（幅奇数）: 逆転数が偶数なら解ける */
export function isSlidePuzzleSolvable(
  board: readonly number[],
  gridSize: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE,
): boolean {
  if (!isValidSlideBoard(board, gridSize)) return false;
  const emptyTile = getSlidePuzzleEmptyTile(gridSize);
  const tiles = board.filter((t) => t !== emptyTile);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      if (tiles[i]! > tiles[j]!) inversions += 1;
    }
  }
  return inversions % 2 === 0;
}
