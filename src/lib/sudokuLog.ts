import { SUDOKU_DIFFICULTY_LABEL, type SudokuDifficulty } from './sudokuLogic';

export type SudokuClearLog = {
  id: string;
  difficulty: SudokuDifficulty;
  clearedAtMs: number;
  timestamp: string;
  message: string;
};

const STORAGE_KEY = 'rk_sudoku_clear_logs_v1';
const MAX_LOGS = 50;

function formatLogTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function loadSudokuClearLogs(): SudokuClearLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SudokuClearLog =>
        item &&
        typeof item.id === 'string' &&
        typeof item.difficulty === 'string' &&
        typeof item.clearedAtMs === 'number' &&
        typeof item.timestamp === 'string' &&
        typeof item.message === 'string',
    );
  } catch {
    return [];
  }
}

export function appendSudokuClearLog(difficulty: SudokuDifficulty): SudokuClearLog {
  const clearedAtMs = Date.now();
  const entry: SudokuClearLog = {
    id: `${clearedAtMs}-${Math.random().toString(36).slice(2, 8)}`,
    difficulty,
    clearedAtMs,
    timestamp: formatLogTimestamp(clearedAtMs),
    message: `${SUDOKU_DIFFICULTY_LABEL[difficulty]} — クリア`,
  };
  const next = [entry, ...loadSudokuClearLogs()].slice(0, MAX_LOGS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return entry;
}
