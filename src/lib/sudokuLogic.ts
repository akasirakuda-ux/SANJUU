/** 9×9数字パズル — 生成・判定（クライアント軽量） */

export type SudokuDifficulty = 'easy' | 'normal' | 'hard';

export const SUDOKU_DIFFICULTY_LABEL: Record<SudokuDifficulty, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
};

export const SUDOKU_DIFFICULTY_HINT: Record<SudokuDifficulty, string> = {
  easy: '数字が多め・重複は色付き・ヒントあり',
  normal: '標準的な問題・重複は色付き',
  hard: '空マス多め・重複は色付き',
};

export const SUDOKU_GIVEN_COUNT: Record<SudokuDifficulty, number> = {
  easy: 40,
  normal: 32,
  hard: 26,
};

export type SudokuGrid = number[][];

export interface SudokuPuzzle {
  puzzle: SudokuGrid;
  solution: SudokuGrid;
  fixed: boolean[][];
  difficulty: SudokuDifficulty;
  seed: number;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function emptySudokuGrid(): SudokuGrid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function copyGrid(grid: SudokuGrid): SudokuGrid {
  return grid.map((row) => [...row]);
}

function isValidPlacement(grid: SudokuGrid, row: number, col: number, num: number): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (grid[row][i] === num || grid[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r += 1) {
    for (let c = bc; c < bc + 3; c += 1) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function fillDiagonalBoxes(grid: SudokuGrid, rng: () => number): void {
  for (let box = 0; box < 9; box += 3) {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    shuffleInPlace(nums, rng);
    let idx = 0;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        grid[box + r][box + c] = nums[idx];
        idx += 1;
      }
    }
  }
}

function solveGrid(grid: SudokuGrid, rng: () => number): boolean {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (grid[row][col] !== 0) continue;
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      shuffleInPlace(nums, rng);
      for (const n of nums) {
        if (!isValidPlacement(grid, row, col, n)) continue;
        grid[row][col] = n;
        if (solveGrid(grid, rng)) return true;
        grid[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function permuteRows(grid: SudokuGrid, rng: () => number): void {
  for (let band = 0; band < 3; band += 1) {
    const order = [0, 1, 2];
    shuffleInPlace(order, rng);
    const base = band * 3;
    const rows = [grid[base], grid[base + 1], grid[base + 2]];
    grid[base] = rows[order[0]];
    grid[base + 1] = rows[order[1]];
    grid[base + 2] = rows[order[2]];
  }
}

function permuteCols(grid: SudokuGrid, rng: () => number): void {
  for (let band = 0; band < 3; band += 1) {
    const order = [0, 1, 2];
    shuffleInPlace(order, rng);
    const base = band * 3;
    for (let r = 0; r < 9; r += 1) {
      const cols = [grid[r][base], grid[r][base + 1], grid[r][base + 2]];
      grid[r][base] = cols[order[0]];
      grid[r][base + 1] = cols[order[1]];
      grid[r][base + 2] = cols[order[2]];
    }
  }
}

function remapDigits(grid: SudokuGrid, rng: () => number): void {
  const map = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  shuffleInPlace(map, rng);
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const v = grid[r][c];
      if (v > 0) grid[r][c] = map[v - 1];
    }
  }
}

function generateSolution(seed: number): SudokuGrid {
  const rng = createRng(seed);
  const grid = emptySudokuGrid();
  fillDiagonalBoxes(grid, rng);
  solveGrid(grid, rng);
  remapDigits(grid, rng);
  permuteRows(grid, rng);
  permuteCols(grid, rng);
  return grid;
}

function countSudokuSolutions(grid: SudokuGrid, limit = 2): number {
  const g = copyGrid(grid);
  let count = 0;

  function solve(): boolean {
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (g[row][col] !== 0) continue;
        for (let n = 1; n <= 9; n += 1) {
          if (!isValidPlacement(g, row, col, n)) continue;
          g[row][col] = n;
          if (solve()) return true;
          g[row][col] = 0;
        }
        return false;
      }
    }
    count += 1;
    return count >= limit;
  }

  solve();
  return count;
}

function sudokuCellCandidates(grid: SudokuGrid, row: number, col: number): number[] {
  if (grid[row][col] !== 0) return [];
  const banned = new Set<number>();
  for (let i = 0; i < 9; i += 1) {
    const rowVal = grid[row][i];
    const colVal = grid[i][col];
    if (rowVal > 0) banned.add(rowVal);
    if (colVal > 0) banned.add(colVal);
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r += 1) {
    for (let c = bc; c < bc + 3; c += 1) {
      const v = grid[r][c];
      if (v > 0) banned.add(v);
    }
  }
  const out: number[] = [];
  for (let n = 1; n <= 9; n += 1) {
    if (!banned.has(n)) out.push(n);
  }
  return out;
}

function buildSudokuCandidateGrid(grid: SudokuGrid): number[][][] {
  return Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => sudokuCellCandidates(grid, row, col)),
  );
}

/** 裸のシングル・隠れたシングルだけで1手進める（推測なし） */
function applyHumanLogicStepFromCandidates(
  grid: SudokuGrid,
  candidates: number[][][],
): boolean {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (grid[row][col] !== 0) continue;
      const cands = candidates[row][col];
      if (cands.length === 1) {
        grid[row][col] = cands[0];
        return true;
      }
    }
  }

  const placeHiddenSingle = (cells: [number, number][]) => {
    for (let digit = 1; digit <= 9; digit += 1) {
      const places: [number, number][] = [];
      for (const [row, col] of cells) {
        if (grid[row][col] !== 0) continue;
        if (candidates[row][col].includes(digit)) places.push([row, col]);
      }
      if (places.length === 1) {
        const [row, col] = places[0];
        grid[row][col] = digit;
        return true;
      }
    }
    return false;
  };

  for (let row = 0; row < 9; row += 1) {
    if (placeHiddenSingle(Array.from({ length: 9 }, (_, col) => [row, col] as [number, number]))) {
      return true;
    }
  }
  for (let col = 0; col < 9; col += 1) {
    if (placeHiddenSingle(Array.from({ length: 9 }, (_, row) => [row, col] as [number, number]))) {
      return true;
    }
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const cells: [number, number][] = [];
      for (let row = br; row < br + 3; row += 1) {
        for (let col = bc; col < bc + 3; col += 1) cells.push([row, col]);
      }
      if (placeHiddenSingle(cells)) return true;
    }
  }
  return false;
}

/** ペアの候補除去（推測なし・ふつう向け） */
function applyNakedPairEliminationCandidates(
  grid: SudokuGrid,
  candidates: number[][][],
): boolean {
  let changed = false;

  const scanUnit = (cells: [number, number][]) => {
    const empty = cells.filter(([row, col]) => grid[row][col] === 0);
    for (let i = 0; i < empty.length; i += 1) {
      for (let j = i + 1; j < empty.length; j += 1) {
        const [r1, c1] = empty[i];
        const [r2, c2] = empty[j];
        const pair = candidates[r1][c1];
        if (pair.length !== 2) continue;
        if (pair[0] !== candidates[r2][c2][0] || pair[1] !== candidates[r2][c2][1]) continue;
        for (const [row, col] of empty) {
          if (row === r1 && col === c1) continue;
          if (row === r2 && col === c2) continue;
          const before = candidates[row][col].length;
          candidates[row][col] = candidates[row][col].filter((d) => d !== pair[0] && d !== pair[1]);
          if (candidates[row][col].length < before) changed = true;
        }
      }
    }
  };

  for (let row = 0; row < 9; row += 1) {
    scanUnit(Array.from({ length: 9 }, (_, col) => [row, col] as [number, number]));
  }
  for (let col = 0; col < 9; col += 1) {
    scanUnit(Array.from({ length: 9 }, (_, row) => [row, col] as [number, number]));
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const cells: [number, number][] = [];
      for (let row = br; row < br + 3; row += 1) {
        for (let col = bc; col < bc + 3; col += 1) cells.push([row, col]);
      }
      scanUnit(cells);
    }
  }

  return changed;
}

function isSudokuGridFull(grid: SudokuGrid): boolean {
  return grid.every((row) => row.every((v) => v >= 1 && v <= 9));
}

/** 推測なしで盤面を埋められるか（難易度に応じた手筋のみ）。grid を書き換える */
function isSudokuHumanSolvable(grid: SudokuGrid, difficulty: SudokuDifficulty): boolean {
  const allowPairs = difficulty !== 'easy';

  while (true) {
    let candidates = buildSudokuCandidateGrid(grid);
    let progressed = false;

    while (applyHumanLogicStepFromCandidates(grid, candidates)) {
      progressed = true;
      candidates = buildSudokuCandidateGrid(grid);
    }

    if (!allowPairs) break;

    if (applyNakedPairEliminationCandidates(grid, candidates)) {
      progressed = true;
      while (applyHumanLogicStepFromCandidates(grid, candidates)) {
        candidates = buildSudokuCandidateGrid(grid);
      }
      continue;
    }

    if (!progressed) break;
  }

  return isSudokuGridFull(grid);
}

function gridsMatch(a: SudokuGrid, b: SudokuGrid): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/** 答え1通り・初期数字と整合・論理で解ける */
function isAcceptableSudokuPuzzle(
  puzzle: SudokuGrid,
  solution: SudokuGrid,
  difficulty: SudokuDifficulty,
  skipSolutionCount = false,
): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const clue = puzzle[r][c];
      if (clue !== 0 && clue !== solution[r][c]) return false;
    }
  }
  if (!skipSolutionCount && countSudokuSolutions(puzzle, 2) !== 1) return false;
  const logicGrid = copyGrid(puzzle);
  if (!isSudokuHumanSolvable(logicGrid, difficulty)) return false;
  return gridsMatch(logicGrid, solution);
}

function createPuzzleFromSolution(
  solution: SudokuGrid,
  givenCount: number,
  difficulty: SudokuDifficulty,
  rng: () => number,
): { puzzle: SudokuGrid; fixed: boolean[][] } {
  const puzzle = copyGrid(solution);
  const fixed = puzzle.map((row) => row.map(() => true));
  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) positions.push([r, c]);
  }
  shuffleInPlace(positions, rng);
  const targetRemove = Math.max(0, 81 - givenCount);
  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= targetRemove) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    fixed[r][c] = false;
    if (countSudokuSolutions(puzzle, 2) !== 1) {
      puzzle[r][c] = backup;
      fixed[r][c] = true;
    } else {
      removed += 1;
    }
  }
  return { puzzle, fixed };
}

function buildSudokuPuzzle(difficulty: SudokuDifficulty, seed: number): SudokuPuzzle | null {
  const rng = createRng(seed ^ difficulty.length);
  const solution = generateSolution(seed);
  const givenCount = SUDOKU_GIVEN_COUNT[difficulty];
  const { puzzle, fixed } = createPuzzleFromSolution(solution, givenCount, difficulty, rng);
  const pack: SudokuPuzzle = { puzzle, solution, fixed, difficulty, seed };
  return isAcceptableSudokuPuzzle(puzzle, solution, difficulty, true) ? pack : null;
}

export function generateSudokuPuzzle(difficulty: SudokuDifficulty, seed?: number): SudokuPuzzle {
  const baseSeed = seed ?? Math.floor(Math.random() * 1_000_000_000);
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const pack = buildSudokuPuzzle(difficulty, baseSeed + attempt);
    if (pack) return pack;
  }
  const fallback = buildSudokuPuzzle(difficulty, baseSeed);
  if (fallback) return fallback;
  return buildSudokuPuzzle('easy', baseSeed + 1)!;
}

export function sudokuCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** 重複しているマス（ユーザー入力含む） */
export function findSudokuConflictKeys(grid: SudokuGrid): Set<string> {
  const conflicts = new Set<string>();
  const markGroup = (cells: [number, number][]) => {
    const byValue = new Map<number, [number, number][]>();
    for (const [r, c] of cells) {
      const v = grid[r][c];
      if (v <= 0) continue;
      const list = byValue.get(v) ?? [];
      list.push([r, c]);
      byValue.set(v, list);
    }
    for (const list of byValue.values()) {
      if (list.length <= 1) continue;
      for (const [r, c] of list) conflicts.add(sudokuCellKey(r, c));
    }
  };

  for (let r = 0; r < 9; r += 1) {
    markGroup(Array.from({ length: 9 }, (_, c) => [r, c] as [number, number]));
  }
  for (let c = 0; c < 9; c += 1) {
    markGroup(Array.from({ length: 9 }, (_, r) => [r, c] as [number, number]));
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const cells: [number, number][] = [];
      for (let r = br; r < br + 3; r += 1) {
        for (let c = bc; c < bc + 3; c += 1) cells.push([r, c]);
      }
      markGroup(cells);
    }
  }
  return conflicts;
}

/** 全マス埋まり・行・列・3×3に重複なし */
export function isSudokuSolved(grid: SudokuGrid): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const v = grid[r][c];
      if (v < 1 || v > 9) return false;
    }
  }
  return findSudokuConflictKeys(grid).size === 0;
}

/** 空マスまたは誤りのマス1つ分のヒント */
export function pickSudokuHintCell(
  grid: SudokuGrid,
  solution: SudokuGrid,
  fixed: boolean[][],
): { row: number; col: number; value: number } | null {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (fixed[r][c]) continue;
      if (grid[r][c] !== solution[r][c]) {
        return { row: r, col: c, value: solution[r][c] };
      }
    }
  }
  return null;
}

export function initialUserGridFromPuzzle(puzzle: SudokuPuzzle): SudokuGrid {
  return copyGrid(puzzle.puzzle);
}
