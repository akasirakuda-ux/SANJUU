export type OthelloColor = 'black' | 'white';
export type OthelloCell = OthelloColor | null;

export const OTHELLO_SIZE = 8;

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
] as const;

export const OTHELLO_CORNERS = [
  [0, 0],
  [0, OTHELLO_SIZE - 1],
  [OTHELLO_SIZE - 1, 0],
  [OTHELLO_SIZE - 1, OTHELLO_SIZE - 1],
] as const;

export function createInitialOthelloBoard(): OthelloCell[][] {
  const board: OthelloCell[][] = Array.from({ length: OTHELLO_SIZE }, () =>
    Array<OthelloCell>(OTHELLO_SIZE).fill(null),
  );
  const mid = OTHELLO_SIZE / 2;
  board[mid - 1]![mid - 1] = 'white';
  board[mid - 1]![mid] = 'black';
  board[mid]![mid - 1] = 'black';
  board[mid]![mid] = 'white';
  return board;
}

export function applyCornerHandicap(
  board: readonly (readonly OthelloCell[])[],
  beneficiary: OthelloColor,
  cornerCount: number,
): OthelloCell[][] {
  const next = board.map((r) => [...r]);
  let placed = 0;
  for (const [row, col] of OTHELLO_CORNERS) {
    if (placed >= cornerCount) break;
    if (next[row]![col] == null) {
      next[row]![col] = beneficiary;
      placed += 1;
    }
  }
  return next;
}

export function createReversiBoard(options?: {
  handicapCorners?: number;
  handicapBeneficiary?: OthelloColor;
}): OthelloCell[][] {
  let board = createInitialOthelloBoard();
  const corners = options?.handicapCorners ?? 0;
  if (corners > 0 && options?.handicapBeneficiary) {
    board = applyCornerHandicap(board, options.handicapBeneficiary, corners);
  }
  return board;
}

export function opponent(color: OthelloColor): OthelloColor {
  return color === 'black' ? 'white' : 'black';
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < OTHELLO_SIZE && col < OTHELLO_SIZE;
}

export function getOthelloFlips(
  board: readonly (readonly OthelloCell[])[],
  row: number,
  col: number,
  color: OthelloColor,
): { row: number; col: number }[] {
  if (board[row]?.[col] != null) return [];
  const flips: { row: number; col: number }[] = [];
  for (const [dr, dc] of DIRS) {
    const line: { row: number; col: number }[] = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[r]![c] === opponent(color)) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inBounds(r, c) && board[r]![c] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

export function isValidOthelloMove(
  board: readonly (readonly OthelloCell[])[],
  row: number,
  col: number,
  color: OthelloColor,
): boolean {
  return getOthelloFlips(board, row, col, color).length > 0;
}

export function getValidOthelloMoves(
  board: readonly (readonly OthelloCell[])[],
  color: OthelloColor,
): { row: number; col: number }[] {
  const moves: { row: number; col: number }[] = [];
  for (let row = 0; row < OTHELLO_SIZE; row += 1) {
    for (let col = 0; col < OTHELLO_SIZE; col += 1) {
      if (isValidOthelloMove(board, row, col, color)) moves.push({ row, col });
    }
  }
  return moves;
}

export function applyOthelloMove(
  board: readonly (readonly OthelloCell[])[],
  row: number,
  col: number,
  color: OthelloColor,
): { board: OthelloCell[][]; flips: { row: number; col: number }[] } {
  const flips = getOthelloFlips(board, row, col, color);
  const next = board.map((r) => [...r]);
  next[row]![col] = color;
  for (const cell of flips) {
    next[cell.row]![cell.col] = color;
  }
  return { board: next, flips };
}

export function countOthelloDiscs(board: readonly (readonly OthelloCell[])[]): {
  black: number;
  white: number;
} {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') black += 1;
      if (cell === 'white') white += 1;
    }
  }
  return { black, white };
}

export function isOthelloGameOver(board: readonly (readonly OthelloCell[])[]): boolean {
  return (
    getValidOthelloMoves(board, 'black').length === 0 &&
    getValidOthelloMoves(board, 'white').length === 0
  );
}

export type OthelloWinner = OthelloColor | 'draw' | null;

export function getOthelloWinner(board: readonly (readonly OthelloCell[])[]): OthelloWinner {
  if (!isOthelloGameOver(board)) return null;
  const { black, white } = countOthelloDiscs(board);
  if (black > white) return 'black';
  if (white > black) return 'white';
  return 'draw';
}

export function serializeOthelloBoard(board: readonly (readonly OthelloCell[])[]): string {
  let out = '';
  for (const row of board) {
    for (const cell of row) {
      out += cell === 'black' ? 'b' : cell === 'white' ? 'w' : '.';
    }
  }
  return out;
}

export function deserializeOthelloBoard(raw: string): OthelloCell[][] {
  const chars = raw.padEnd(OTHELLO_SIZE * OTHELLO_SIZE, '.').slice(0, OTHELLO_SIZE * OTHELLO_SIZE);
  const board: OthelloCell[][] = [];
  for (let row = 0; row < OTHELLO_SIZE; row += 1) {
    const line: OthelloCell[] = [];
    for (let col = 0; col < OTHELLO_SIZE; col += 1) {
      const ch = chars[row * OTHELLO_SIZE + col];
      line.push(ch === 'b' ? 'black' : ch === 'w' ? 'white' : null);
    }
    board.push(line);
  }
  return board;
}

export type OthelloCpuDifficulty = 'easy' | 'normal' | 'hard' | 'very_hard' | 'master';

export const OTHELLO_CPU_DIFFICULTIES: readonly OthelloCpuDifficulty[] = [
  'easy',
  'normal',
  'hard',
  'very_hard',
  'master',
];

export function othelloCpuDifficultyLabelJa(level: OthelloCpuDifficulty): string {
  switch (level) {
    case 'easy':
      return '弱い';
    case 'normal':
      return '普通';
    case 'hard':
      return '強い';
    case 'very_hard':
      return 'めちゃ強い';
    case 'master':
      return '名人級';
  }
}

export function othelloCpuDifficultyHintJa(level: OthelloCpuDifficulty): string {
  switch (level) {
    case 'easy':
      return 'ゆるゆる。たまにミスします';
    case 'normal':
      return '角と石数を意識します';
    case 'hard':
      return '角と相手の手を読みます';
    case 'very_hard':
      return '数手先まで読みます';
    case 'master':
      return '本気。上級者向け';
  }
}

function isCorner(row: number, col: number): boolean {
  return OTHELLO_CORNERS.some(([r, c]) => r === row && c === col);
}

const POS_WEIGHTS: readonly (readonly number[])[] = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

function evaluateOthelloBoard(
  board: readonly (readonly OthelloCell[])[],
  color: OthelloColor,
): number {
  let score = 0;
  for (let row = 0; row < OTHELLO_SIZE; row += 1) {
    for (let col = 0; col < OTHELLO_SIZE; col += 1) {
      const cell = board[row]![col];
      if (cell == null) continue;
      const w = POS_WEIGHTS[row]![col]!;
      score += cell === color ? w : -w;
    }
  }
  const myMoves = getValidOthelloMoves(board, color).length;
  const oppMoves = getValidOthelloMoves(board, opponent(color)).length;
  score += (myMoves - oppMoves) * 8;
  return score;
}

function scoreOthelloMove(
  board: readonly (readonly OthelloCell[])[],
  move: { row: number; col: number },
  color: OthelloColor,
): number {
  const flips = getOthelloFlips(board, move.row, move.col, color).length;
  const { board: next } = applyOthelloMove(board, move.row, move.col, color);
  const oppMoves = getValidOthelloMoves(next, opponent(color)).length;
  let score = flips * 2 - oppMoves * 4;
  if (isCorner(move.row, move.col)) score += 120;
  score += POS_WEIGHTS[move.row]![move.col]!;
  return score;
}

function orderMoves(
  board: readonly (readonly OthelloCell[])[],
  moves: { row: number; col: number }[],
  color: OthelloColor,
): { row: number; col: number }[] {
  return [...moves].sort((a, b) => {
    const sa = scoreOthelloMove(board, a, color);
    const sb = scoreOthelloMove(board, b, color);
    return sb - sa;
  });
}

function advanceTurn(board: OthelloCell[][], color: OthelloColor): OthelloColor {
  const next = opponent(color);
  if (getValidOthelloMoves(board, next).length > 0) return next;
  if (getValidOthelloMoves(board, color).length > 0) return color;
  return next;
}

function minimax(
  board: OthelloCell[][],
  depth: number,
  alpha: number,
  beta: number,
  current: OthelloColor,
  maximizing: OthelloColor,
  nodeBudget: { left: number },
): number {
  if (nodeBudget.left <= 0 || depth <= 0 || isOthelloGameOver(board)) {
    return evaluateOthelloBoard(board, maximizing);
  }

  nodeBudget.left -= 1;
  const moves = getValidOthelloMoves(board, current);
  if (moves.length === 0) {
    const passTurn = advanceTurn(board, current);
    if (passTurn === current) return evaluateOthelloBoard(board, maximizing);
    return minimax(board, depth - 1, alpha, beta, passTurn, maximizing, nodeBudget);
  }

  const ordered = orderMoves(board, moves, current);
  if (current === maximizing) {
    let value = -Infinity;
    for (const move of ordered) {
      const { board: next } = applyOthelloMove(board, move.row, move.col, current);
      const nextTurn = advanceTurn(next, current);
      value = Math.max(
        value,
        minimax(next, depth - 1, alpha, beta, nextTurn, maximizing, nodeBudget),
      );
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
      if (nodeBudget.left <= 0) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of ordered) {
    const { board: next } = applyOthelloMove(board, move.row, move.col, current);
    const nextTurn = advanceTurn(next, current);
    value = Math.min(
      value,
      minimax(next, depth - 1, alpha, beta, nextTurn, maximizing, nodeBudget),
    );
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
    if (nodeBudget.left <= 0) break;
  }
  return value;
}

function pickMinimaxMove(
  board: readonly (readonly OthelloCell[])[],
  color: OthelloColor,
  depth: number,
  nodeBudget: number,
): { row: number; col: number } | null {
  const moves = getValidOthelloMoves(board, color);
  if (moves.length === 0) return null;
  const budget = { left: nodeBudget };
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const move of orderMoves(board, moves, color)) {
    const { board: next } = applyOthelloMove(board, move.row, move.col, color);
    const nextTurn = advanceTurn(next, color);
    const score = minimax(next, depth - 1, -Infinity, Infinity, nextTurn, color, budget);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
    if (budget.left <= 0) break;
  }
  return best;
}

/** らくだロボ（🤖）— 難易度5段 */
export function pickOthelloCpuMove(
  board: readonly (readonly OthelloCell[])[],
  color: OthelloColor,
  difficulty: OthelloCpuDifficulty = 'normal',
): { row: number; col: number } | null {
  const moves = getValidOthelloMoves(board, color);
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    if (Math.random() < 0.45) {
      return moves[Math.floor(Math.random() * moves.length)]!;
    }
    let worst = moves[0]!;
    let worstFlips = Infinity;
    for (const move of moves) {
      const flips = getOthelloFlips(board, move.row, move.col, color).length;
      if (flips < worstFlips) {
        worstFlips = flips;
        worst = move;
      }
    }
    return worst;
  }

  if (difficulty === 'normal') {
    for (const [cr, cc] of OTHELLO_CORNERS) {
      const corner = moves.find((m) => m.row === cr && m.col === cc);
      if (corner) return corner;
    }
    let best = moves[0]!;
    let bestScore = -1;
    for (const move of moves) {
      const score = getOthelloFlips(board, move.row, move.col, color).length;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  if (difficulty === 'hard') {
    let best = moves[0]!;
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = scoreOthelloMove(board, move, color);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  if (difficulty === 'very_hard') {
    return pickMinimaxMove(board, color, 3, 3500);
  }

  return pickMinimaxMove(board, color, 4, 9000);
}

export function othelloColorLabelJa(color: OthelloColor): string {
  return color === 'black' ? '黒' : '白';
}
