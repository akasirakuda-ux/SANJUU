export type GomokuColor = 'black' | 'white';
export type GomokuCell = GomokuColor | null;
export type GomokuBoardSize = 13 | 15;
export type GomokuCpuDifficulty = 'easy' | 'normal' | 'hard';
export type GomokuOpponent = 'human' | 'cpu';
export type GomokuWinner = GomokuColor | 'draw' | null;
/** らくだ式 — 星（ホシ）に置くハンデ石の数 */
export type GomokuHandicapStones = 0 | 1 | 2 | 3 | 4;

export const GOMOKU_BOARD_SIZES: readonly GomokuBoardSize[] = [13, 15];
export const GOMOKU_HANDICAP_OPTIONS: readonly GomokuHandicapStones[] = [0, 1, 2, 3, 4];
export const GOMOKU_CPU_DIFFICULTIES: readonly GomokuCpuDifficulty[] = ['easy', 'normal', 'hard'];

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export function gomokuOpponent(color: GomokuColor): GomokuColor {
  return color === 'black' ? 'white' : 'black';
}

export function gomokuColorLabelJa(color: GomokuColor): string {
  return color === 'black' ? '黒' : '白';
}

export function gomokuCpuDifficultyLabelJa(level: GomokuCpuDifficulty): string {
  switch (level) {
    case 'easy':
      return '初心者';
    case 'normal':
      return '中級';
    case 'hard':
      return '上級';
  }
}

export function gomokuBoardSizeLabelJa(size: GomokuBoardSize): string {
  return `${size}×${size}`;
}

export function gomokuHandicapLabelJa(stones: GomokuHandicapStones): string {
  if (stones === 0) return 'なし';
  return `星${stones}`;
}

export function gomokuHandicapHintJa(): string {
  return '星（ホシ）にだけ置く、らくだ式のハンデです。黒番先攻のまま。';
}

export function gomokuCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** 配信用 — 列A・行1 形式（例: H8） */
export function gomokuCoordLabel(col: number, row: number, columnLabel: (i: number) => string): string {
  return `${columnLabel(col)}${row + 1}`;
}

export function createEmptyGomokuBoard(size: GomokuBoardSize): GomokuCell[][] {
  return Array.from({ length: size }, () => Array<GomokuCell>(size).fill(null));
}

/** ハンデ配置順 — 天元 → 四隅の星 */
export function gomokuHandicapPlacementOrder(size: GomokuBoardSize): Array<{ row: number; col: number }> {
  const stars = gomokuStarPoints(size);
  const centerRow = Math.floor(size / 2);
  const centerCol = Math.floor(size / 2);
  const center = stars.find((s) => s.row === centerRow && s.col === centerCol);
  const rest = stars.filter((s) => s.row !== centerRow || s.col !== centerCol);
  return center ? [center, ...rest] : [...stars];
}

export function createGomokuStartBoard(
  size: GomokuBoardSize,
  handicapStones: GomokuHandicapStones,
  handicapBeneficiary: GomokuColor,
): { board: GomokuCell[][]; handicapKeys: string[] } {
  const board = createEmptyGomokuBoard(size);
  const handicapKeys: string[] = [];
  const order = gomokuHandicapPlacementOrder(size);
  const count = Math.min(handicapStones, order.length);
  for (let i = 0; i < count; i += 1) {
    const { row, col } = order[i]!;
    board[row]![col] = handicapBeneficiary;
    handicapKeys.push(gomokuCellKey(row, col));
  }
  return { board, handicapKeys };
}

function inBounds(row: number, col: number, size: number): boolean {
  return row >= 0 && col >= 0 && row < size && col < size;
}

export function isValidGomokuMove(
  board: readonly (readonly GomokuCell[])[],
  row: number,
  col: number,
): boolean {
  return inBounds(row, col, board.length) && board[row]?.[col] == null;
}

export function applyGomokuMove(
  board: readonly (readonly GomokuCell[])[],
  row: number,
  col: number,
  color: GomokuColor,
): GomokuCell[][] {
  const next = board.map((r) => [...r]);
  next[row]![col] = color;
  return next;
}

function countDirection(
  board: readonly (readonly GomokuCell[])[],
  row: number,
  col: number,
  dr: number,
  dc: number,
  color: GomokuColor,
): number {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  const size = board.length;
  while (inBounds(r, c, size) && board[r]![c] === color) {
    count += 1;
    r += dr;
    c += dc;
  }
  return count;
}

/** 直前の手で五連ができたか */
export function getGomokuWinnerAfterMove(
  board: readonly (readonly GomokuCell[])[],
  row: number,
  col: number,
  color: GomokuColor,
): GomokuWinner {
  if (board[row]?.[col] !== color) return null;
  for (const [dr, dc] of DIRS) {
    const total =
      1 +
      countDirection(board, row, col, dr, dc, color) +
      countDirection(board, row, col, -dr, -dc, color);
    if (total >= 5) return color;
  }
  return null;
}

function axisScore(
  board: readonly (readonly GomokuCell[])[],
  row: number,
  col: number,
  dr: number,
  dc: number,
  color: GomokuColor,
): number {
  const size = board.length;
  let forward = 0;
  let r = row + dr;
  let c = col + dc;
  while (inBounds(r, c, size) && board[r]![c] === color) {
    forward += 1;
    r += dr;
    c += dc;
  }
  const forwardOpen = inBounds(r, c, size) && board[r]![c] == null;

  let backward = 0;
  r = row - dr;
  c = col - dc;
  while (inBounds(r, c, size) && board[r]![c] === color) {
    backward += 1;
    r -= dr;
    c -= dc;
  }
  const backwardOpen = inBounds(r, c, size) && board[r]![c] == null;

  const len = forward + backward + 1;
  const openEnds = (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0);

  if (len >= 5) return 100_000;
  if (len === 4 && openEnds === 2) return 12_000;
  if (len === 4 && openEnds === 1) return 4_000;
  if (len === 3 && openEnds === 2) return 900;
  if (len === 3 && openEnds === 1) return 120;
  if (len === 2 && openEnds === 2) return 40;
  if (len === 2 && openEnds === 1) return 8;
  return len >= 1 ? 2 : 0;
}

function evaluateGomokuPoint(
  board: readonly (readonly GomokuCell[])[],
  row: number,
  col: number,
  color: GomokuColor,
): number {
  if (!isValidGomokuMove(board, row, col)) return -1;
  const size = board.length;
  const next = applyGomokuMove(board, row, col, color);
  let score = 0;
  for (const [dr, dc] of DIRS) {
    score += axisScore(next, row, col, dr, dc, color);
  }
  const center = (size - 1) / 2;
  score += Math.max(0, 8 - Math.abs(row - center) - Math.abs(col - center));
  return score;
}

function candidateMoves(
  board: readonly (readonly GomokuCell[])[],
  size: GomokuBoardSize,
): Array<{ row: number; col: number }> {
  let hasStone = false;
  const moves: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row]?.[col] != null) hasStone = true;
    }
  }
  if (!hasStone) {
    const center = Math.floor(size / 2);
    return [{ row: center, col: center }];
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row]?.[col] != null) continue;
      let near = false;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (inBounds(nr, nc, size) && board[nr]?.[nc] != null) near = true;
        }
      }
      if (near) moves.push({ row, col });
    }
  }
  return moves.length > 0 ? moves : [{ row: Math.floor(size / 2), col: Math.floor(size / 2) }];
}

function findImmediateWin(
  board: readonly (readonly GomokuCell[])[],
  color: GomokuColor,
  moves: Array<{ row: number; col: number }>,
): { row: number; col: number } | null {
  for (const move of moves) {
    const next = applyGomokuMove(board, move.row, move.col, color);
    if (getGomokuWinnerAfterMove(next, move.row, move.col, color) === color) {
      return move;
    }
  }
  return null;
}

function pickByScore(
  board: readonly (readonly GomokuCell[])[],
  color: GomokuColor,
  moves: Array<{ row: number; col: number }>,
  difficulty: GomokuCpuDifficulty,
): { row: number; col: number } {
  const scored = moves.map((move) => {
    const attack = evaluateGomokuPoint(board, move.row, move.col, color);
    const defend = evaluateGomokuPoint(board, move.row, move.col, gomokuOpponent(color));
    return { move, score: attack + defend * 0.95 };
  });
  scored.sort((a, b) => b.score - a.score);

  if (difficulty === 'easy') {
    if (Math.random() < 0.35) {
      return moves[Math.floor(Math.random() * moves.length)]!;
    }
    const top = scored.slice(0, Math.min(5, scored.length));
    return top[Math.floor(Math.random() * top.length)]!.move;
  }

  if (difficulty === 'normal') {
    const top = scored.slice(0, Math.min(3, scored.length));
    return top[Math.floor(Math.random() * top.length)]!.move;
  }

  return scored[0]!.move;
}

export function pickGomokuCpuMove(
  board: readonly (readonly GomokuCell[])[],
  color: GomokuColor,
  difficulty: GomokuCpuDifficulty,
  size: GomokuBoardSize,
): { row: number; col: number } {
  const moves = candidateMoves(board, size);
  const win = findImmediateWin(board, color, moves);
  if (win) return win;

  const block = findImmediateWin(board, gomokuOpponent(color), moves);
  if (block) return block;

  return pickByScore(board, color, moves, difficulty);
}

export function gomokuWinnerMessage(
  winner: GomokuWinner,
  opponentKind: GomokuOpponent,
  humanColor: GomokuColor,
): string {
  if (winner == null) return '';
  if (winner === 'draw') return '引き分けです。';
  if (opponentKind === 'cpu') {
    if (winner === humanColor) return 'あなたの勝ちです。';
    return 'コンピューターに負けました。';
  }
  return `${gomokuColorLabelJa(winner)}の勝ちです。`;
}

/** 五目盤の星（天元・四隅付近） */
export function gomokuStarPoints(size: GomokuBoardSize): Array<{ row: number; col: number }> {
  if (size === 13) {
    return [
      { row: 3, col: 3 },
      { row: 3, col: 9 },
      { row: 6, col: 6 },
      { row: 9, col: 3 },
      { row: 9, col: 9 },
    ];
  }
  return [
    { row: 3, col: 3 },
    { row: 3, col: 11 },
    { row: 7, col: 7 },
    { row: 11, col: 3 },
    { row: 11, col: 11 },
  ];
}
