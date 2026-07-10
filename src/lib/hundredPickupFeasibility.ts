import { targetWordFitsBoard } from './boardDimensions';
import { pickRandomAutoTargetWord } from './hundredAutoTargetWord';
import { runPickupGenerationSync } from './hundredPickupGenerate';
import {
  LATIN_AUTO_WORDS,
  pickRandomEmojiWord,
  pickupLengthBounds,
  PICKUP_EMOJI_AUTO_SYMBOLS,
  type PickupCharset,
} from './hundredPickupCharset';
import {
  countPlacedWordOccurrences,
  hundredPickupMinOccurrences,
} from './hundredPickupOccurrences';

export const PICKUP_TARGET_COVERAGE = 0.85;

const DEFAULT_PROBE_ATTEMPTS = 12;
const DEFAULT_GENERATE_ATTEMPTS = 48;

export type PickupGeneratedBoard = {
  grid: string[][];
  placedWords: unknown[];
  density?: number;
};

function isValidPlacedWords(placedWords: unknown): boolean {
  if (!Array.isArray(placedWords) || placedWords.length === 0) return false;
  return placedWords.some(
    (pw) =>
      pw &&
      typeof pw === 'object' &&
      typeof (pw as { word?: unknown }).word === 'string' &&
      Array.isArray((pw as { occurrences?: unknown }).occurrences) &&
      ((pw as { occurrences: unknown[] }).occurrences.length ?? 0) > 0,
  );
}

export function pickupGenerationMeetsTarget(
  cols: number,
  rows: number,
  targetWord: string,
  result: { density?: number; placedWords: unknown },
): boolean {
  const coverage = typeof result.density === 'number' ? result.density : 0;
  const occurrences = countPlacedWordOccurrences(result.placedWords);
  const minOccurrences = hundredPickupMinOccurrences(cols, targetWord, rows);
  return coverage >= PICKUP_TARGET_COVERAGE && occurrences >= minOccurrences;
}

function seedForAttempt(baseSeed: number, attempt: number): number {
  return (baseSeed + attempt * 7919 + 42) % 1_000_000;
}

/** 盤面×文字数の組み合わせで、実際に生成を試す */
export function generatePickupBoardReliable(
  cols: number,
  rows: number,
  targetWord: string,
  pickupCharset: PickupCharset,
  opts?: { maxAttempts?: number; baseSeed?: number },
): PickupGeneratedBoard | null {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_GENERATE_ATTEMPTS;
  const baseSeed = opts?.baseSeed ?? Math.floor(Math.random() * 1_000_000);
  let best: (PickupGeneratedBoard & { coverage: number; occurrences: number }) | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const r = runPickupGenerationSync({
      cols,
      rows,
      targetWord,
      seed: seedForAttempt(baseSeed, attempt),
      pickupCharset,
    });
    if (!r || !isValidPlacedWords(r.placedWords)) continue;

    const coverage = typeof r.density === 'number' ? r.density : 0;
    const occurrences = countPlacedWordOccurrences(r.placedWords);
    if (
      !best ||
      occurrences > best.occurrences ||
      (occurrences === best.occurrences && coverage > best.coverage)
    ) {
      best = { grid: r.grid, placedWords: r.placedWords, density: r.density, coverage, occurrences };
    }
    if (pickupGenerationMeetsTarget(cols, rows, targetWord, r)) {
      return { grid: r.grid, placedWords: r.placedWords, density: r.density };
    }
  }

  if (best && pickupGenerationMeetsTarget(cols, rows, targetWord, best)) {
    return { grid: best.grid, placedWords: best.placedWords, density: best.density };
  }
  return null;
}

function pickupProbeWordsForLength(
  length: number,
  charset: PickupCharset,
  cols: number,
  rows: number,
): string[] {
  const words = new Set<string>();

  if (charset === 'digit') {
    words.add('8'.repeat(length));
    words.add('1'.repeat(length));
    words.add(
      Array.from({ length }, (_, i) => String((i + 2) % 10)).join(''),
    );
  } else if (charset === 'latin') {
    for (const w of LATIN_AUTO_WORDS) {
      if (w.length === length) words.add(w);
    }
  } else if (charset === 'emoji') {
    words.add(PICKUP_EMOJI_AUTO_SYMBOLS.slice(0, Math.min(length, 4)).join(''));
    words.add(PICKUP_EMOJI_AUTO_SYMBOLS.slice(0, length).join(''));
    for (let i = 0; i < 8; i += 1) {
      const w = pickRandomEmojiWord(length);
      if (w && targetWordFitsBoard(w, cols, rows)) words.add(w);
    }
  } else {
    for (let i = 0; i < 16; i += 1) {
      const w = pickRandomAutoTargetWord(length);
      if (w && targetWordFitsBoard(w, cols, rows)) words.add(w);
    }
    const base = 'あいうえおかきくけこ';
    if (length <= base.length) {
      words.add([...base].slice(0, length).join(''));
    }
  }

  return [...words].filter((w) => targetWordFitsBoard(w, cols, rows));
}

/** 文字数帯が、この盤面で生成可能か（代表語でプローブ） */
export function isPickupLengthFeasible(
  cols: number,
  rows: number,
  length: number,
  charset: PickupCharset,
  probeAttempts = DEFAULT_PROBE_ATTEMPTS,
): boolean {
  if (length < 1) return false;
  if (!targetWordFitsBoard('0'.repeat(length), cols, rows)) return false;

  const probes = pickupProbeWordsForLength(length, charset, cols, rows);
  if (probes.length === 0) return false;

  return probes.some((word) =>
    isPickupBoardComboFeasible(cols, rows, word, charset, probeAttempts),
  );
}

/** 作成画面: 選べる文字数・桁数 */
export function pickupFeasibleWordLengthsForBoard(
  cols: number,
  rows: number,
  charset: PickupCharset,
): number[] {
  const { min, max } = pickupLengthBounds(charset);
  const out: number[] = [];
  for (let len = min; len <= max; len += 1) {
    if (isPickupLengthFeasible(cols, rows, len, charset)) out.push(len);
  }
  return out;
}

/** 指定のことば×盤面が生成可能か */
export function isPickupBoardComboFeasible(
  cols: number,
  rows: number,
  targetWord: string,
  charset: PickupCharset,
  probeAttempts = DEFAULT_PROBE_ATTEMPTS,
): boolean {
  const word = (targetWord || '').trim();
  if (!word) return false;
  if (!targetWordFitsBoard(word, cols, rows)) return false;
  return generatePickupBoardReliable(cols, rows, word, charset, {
    maxAttempts: probeAttempts,
    baseSeed: 17,
  }) !== null;
}

export function pickupBoardFeasibilityErrorMessage(
  cols: number,
  rows: number,
  targetWord: string,
  charset: PickupCharset,
): string {
  const len = Array.from((targetWord || '').trim()).length;
  const unit = charset === 'digit' ? '桁' : '文字';
  const feasible = pickupFeasibleWordLengthsForBoard(cols, rows, charset);
  const feasibleText =
    feasible.length > 0
      ? feasible.map((n) => `${n}${unit}`).join('・')
      : '（この盤面では該当なし）';

  return (
    `この組み合わせでは盤面を作れません。\n` +
    `探すことば: ${targetWord || '—'}（${len}${unit}）\n` +
    `盤面: ${cols}×${rows}\n\n` +
    `この盤面で作れるのは ${feasibleText} です。\n` +
    `ことばを短くするか、盤面を大きくしてお試しください。`
  );
}
