import {
  SLIDE_PUZZLE_GRID_SIZE,
  findSlidePuzzleEmptyIndex,
  getSlidePuzzleTileCount,
  isSlidePuzzleSolvable,
  isSlidePuzzleSolved,
  normalizeSlideBoard,
  slidePuzzleBoardKey,
  type SlidePuzzleGridSize,
} from './slidePuzzleLogic';

/** 5×5 では A* も重いため、3×3 のみ */
export const SLIDE_PUZZLE_BFS_MAX_GRID_SIZE = 3 as const;

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

function manhattanDistance(board: readonly number[], gridSize: SlidePuzzleGridSize): number {
  const emptyTile = getSlidePuzzleTileCount(gridSize) - 1;
  let sum = 0;
  for (let i = 0; i < board.length; i += 1) {
    const tile = board[i]!;
    if (tile === emptyTile) continue;
    const goalRow = Math.floor(tile / gridSize);
    const goalCol = tile % gridSize;
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    sum += Math.abs(row - goalRow) + Math.abs(col - goalCol);
  }
  return sum;
}

type AStarNode = {
  board: number[];
  moves: number[];
  g: number;
  f: number;
};

/**
 * 3×3 向け A*（マンハッタン距離）— いまの並びから最短手数。
 * 盤面長が gridSize² でない（旧5×5保存など）は解けないので null。
 */
export function findSlidePuzzleSolutionMoves(
  startBoard: readonly number[],
  gridSize: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE,
): number[] | null {
  if (gridSize > SLIDE_PUZZLE_BFS_MAX_GRID_SIZE) return null;

  const board = normalizeSlideBoard(startBoard, gridSize);
  if (!board) return null;
  if (isSlidePuzzleSolved(board, gridSize)) return [];
  if (!isSlidePuzzleSolvable(board, gridSize)) return null;

  const startKey = slidePuzzleBoardKey(board);
  const open: AStarNode[] = [
    { board, moves: [], g: 0, f: manhattanDistance(board, gridSize) },
  ];
  const bestG = new Map<string, number>([[startKey, 0]]);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.g - b.g);
    const current = open.shift()!;

    if (isSlidePuzzleSolved(current.board, gridSize)) return current.moves;

    const emptyIndex = findSlidePuzzleEmptyIndex(current.board, gridSize);
    for (const fromIndex of slidePuzzleNeighborIndices(emptyIndex, gridSize)) {
      const nextBoard = [...current.board];
      [nextBoard[fromIndex], nextBoard[emptyIndex]] = [nextBoard[emptyIndex], nextBoard[fromIndex]];
      const key = slidePuzzleBoardKey(nextBoard);
      const g = current.g + 1;
      const prev = bestG.get(key);
      if (prev !== undefined && prev <= g) continue;
      bestG.set(key, g);
      open.push({
        board: nextBoard,
        moves: [...current.moves, fromIndex],
        g,
        f: g + manhattanDistance(nextBoard, gridSize),
      });
    }
  }

  return null;
}

export { slidePuzzleBoardKey };
