import { pickAutoTargetWordForBoard } from './hundredAutoTargetWord';
import { generatePickupBoardReliable } from './hundredPickupFeasibility';
import { inferPickupCharsetFromWord, pickAutoTargetWordForPickupCharset, type PickupCharset } from './hundredPickupCharset';
import { firestoreSafeJson, gridToFirestoreRows } from './hundredRoomBoard';
import {
  ROBO_PICKUP_LOUNGE_COLS,
  ROBO_PICKUP_LOUNGE_MAX_LEN,
  ROBO_PICKUP_LOUNGE_MIN_LEN,
  ROBO_PICKUP_LOUNGE_ROWS,
  type RoboPickupLoungeProfile,
} from './roboPickupLoungeConfig';

const CHARSETS: PickupCharset[] = ['hiragana', 'digit', 'latin'];

export function pickRoboLoungeCharset(previous?: PickupCharset | null): PickupCharset {
  if (!previous) {
    return CHARSETS[Math.floor(Math.random() * CHARSETS.length)] ?? 'hiragana';
  }
  const others = CHARSETS.filter((c) => c !== previous);
  return others[Math.floor(Math.random() * others.length)] ?? previous;
}

export function pickRoboLoungeWordLength(): number {
  return Math.random() < 0.5 ? ROBO_PICKUP_LOUNGE_MIN_LEN : ROBO_PICKUP_LOUNGE_MAX_LEN;
}

export function pickRoboLoungeTargetWord(
  pickupCharset: PickupCharset,
  cols: number,
  rows: number,
  exclude: string[],
): string | null {
  const length = pickRoboLoungeWordLength();
  if (pickupCharset === 'hiragana') {
    return pickAutoTargetWordForBoard(cols, rows, length, { exclude });
  }
  return pickAutoTargetWordForPickupCharset(pickupCharset, cols, rows, length, { exclude });
}

export function generateRoboLoungeBoard(
  cols: number,
  rows: number,
  targetWord: string,
  pickupCharset: PickupCharset,
): { grid: string[][]; placedWords: unknown[] } | null {
  const r = generatePickupBoardReliable(cols, rows, targetWord, pickupCharset, {
    maxAttempts: 48,
  });
  if (!r) return null;
  return { grid: r.grid, placedWords: r.placedWords };
}

export type RoboLoungeRefreshPayload = {
  targetWord: string;
  pickupCharset: PickupCharset;
  gridRows: string[];
  words: unknown[];
  boardCols: number;
  boardRows: number;
};

export function buildRoboLoungeRefreshPayload(params: {
  previousTargetWord?: string;
  previousCharset?: PickupCharset | null;
  exclude?: string[];
  profile?: RoboPickupLoungeProfile;
}): RoboLoungeRefreshPayload | null {
  const cols = ROBO_PICKUP_LOUNGE_COLS;
  const rows = ROBO_PICKUP_LOUNGE_ROWS;
  const prev = (params.previousTargetWord || '').trim();
  const exclude = [...(params.exclude ?? []), prev].filter(Boolean);
  const forcedCharset = params.profile?.forcedCharset ?? null;
  const pickupCharset =
    forcedCharset ??
    pickRoboLoungeCharset(params.previousCharset ?? inferCharset(prev));

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const charset =
      forcedCharset ??
      (attempt === 0 ? pickupCharset : pickRoboLoungeCharset(pickupCharset));
    const targetWord = pickRoboLoungeTargetWord(charset, cols, rows, exclude);
    if (!targetWord) continue;
    const board = generateRoboLoungeBoard(cols, rows, targetWord, charset);
    if (!board) {
      exclude.push(targetWord);
      continue;
    }
    const gridRows = gridToFirestoreRows(board.grid, charset);
    if (gridRows.length === 0 || gridRows.some((row) => !row || row.length === 0)) continue;
    return {
      targetWord,
      pickupCharset: charset,
      gridRows,
      words: firestoreSafeJson(board.placedWords ?? []),
      boardCols: cols,
      boardRows: rows,
    };
  }
  return null;
}

function inferCharset(word: string): PickupCharset | null {
  const w = word.trim();
  if (!w) return null;
  return inferPickupCharsetFromWord(w);
}
