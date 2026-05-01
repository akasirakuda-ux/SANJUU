import type { Action } from './game';

export type Cell = {
  value: string;
  locked?: boolean;
  owner?: string;
  revealed?: boolean;
  highlight?: boolean;
  gameValue?: number;
};

// Legacy (current) board format
export type LegacyBoard = string[][];

// New board format for upcoming game logic
export type Board = LegacyBoard | Cell[][];

export const isCell = (v: unknown): v is Cell => {
  if (!v || typeof v !== 'object') return false;
  return typeof (v as any).value === 'string';
};

export const toCellBoard = (board: Board): Cell[][] => {
  if (board.length === 0) return [];
  const first = board[0]?.[0];
  if (isCell(first)) return board as Cell[][];
  return (board as LegacyBoard).map((row) =>
    row.map((value) => ({
      value,
      revealed: false,
      highlight: false,
      gameValue: 0,
    }))
  );
};

export const revealCell = (cell: Cell): Cell => {
  if (cell.locked) return cell;
  if (cell.revealed) return cell;
  return { ...cell, revealed: true };
};

export const toggleHighlight = (cell: Cell): Cell => {
  return { ...cell, highlight: !cell.highlight };
};

export const lockCell = (cell: Cell): Cell => {
  if (cell.locked) return cell;
  return { ...cell, locked: true };
};

export const applyActions = (board: Cell[][], actions: Action[]): Cell[][] => {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  for (const a of actions) {
    const row = next[a.r];
    const cell = row?.[a.c];
    if (!cell) continue;
    if (a.type === 'select') row[a.c] = revealCell(cell);
    if (a.type === 'reveal') row[a.c] = revealCell(cell);
    if (a.type === 'highlight') row[a.c] = { ...cell, highlight: true };
    if (a.type === 'lock') row[a.c] = lockCell(cell);
  }
  return next;
};

export const calculateTurnScore = (board: Cell[][], actions: Action[], targetValue?: number): number => {
  return calculateTurnScores(board, actions, targetValue)._total;
};

export const calculateTurnScores = (
  board: Cell[][],
  actions: Action[],
  targetValue?: number
): Record<string, number> & { _total: number } => {
  const scores: Record<string, number> & { _total: number } = { _total: 0 };

  for (const a of actions) {
    const who = a.user || '_unknown';
    if (!(who in scores)) scores[who] = 0;

    let delta = 0;
    if (a.type === 'select') {
      const gv = board[a.r]?.[a.c]?.gameValue ?? 0;
      if (typeof targetValue === 'number' && gv === targetValue) delta = 3;
      else delta = 1;
    }
    if (a.type === 'lock') delta = 2;

    scores[who] += delta;
    scores._total += delta;
  }

  return scores;
};

