import { MASTER, PROHIBITED_WORDS, convertToHiragana } from '../constants';
import { targetWordFitsBoard } from './boardDimensions';

const HIRAGANA_WORD = /^[ぁ-んー]+$/u;

/** おまかせモードで選べる文字数（盤面に収まるものだけ UI で有効化） */
export const HUNDRED_AUTO_WORD_LENGTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

export type HundredAutoWordLength = (typeof HUNDRED_AUTO_WORD_LENGTH_OPTIONS)[number];

const poolsByLength = new Map<number, string[]>();

function normalizeAutoWord(raw: string): string {
  return convertToHiragana(raw).replace(/[^ぁ-んー]/g, '');
}

function isAllowedAutoWord(normalized: string): boolean {
  if (!normalized || !HIRAGANA_WORD.test(normalized)) return false;
  return !PROHIBITED_WORDS.some((w) => normalized.includes(w));
}

function poolForLength(length: number): string[] {
  const cached = poolsByLength.get(length);
  if (cached) return cached;

  const seen = new Set<string>();
  const out: string[] = [];

  for (const cat of MASTER.categories) {
    for (const raw of cat.words) {
      const w = normalizeAutoWord(raw);
      if (w.length !== length) continue;
      if (!isAllowedAutoWord(w)) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }

  poolsByLength.set(length, out);
  return out;
}

/** 盤面に載せられる最大文字数（横または縦に1語が収まる） */
export function maxAutoTargetWordLengthForBoard(cols: number, rows: number): number {
  return Math.max(cols, rows);
}

export function isAutoWordLengthValidForBoard(
  length: number,
  cols: number,
  rows: number,
): boolean {
  if (length < 1) return false;
  return length <= maxAutoTargetWordLengthForBoard(cols, rows) && poolForLength(length).length > 0;
}

/**
 * MASTER 辞書から、指定文字数のひらがな名詞をランダムに1つ選ぶ。
 * exclude に含まれる語は避ける（候補が尽きれば全体から再抽選）。
 */
export function pickRandomAutoTargetWord(
  length: number,
  opts?: { exclude?: string[] },
): string | null {
  const pool = poolForLength(length);
  if (pool.length === 0) return null;

  const exclude = new Set((opts?.exclude ?? []).map((w) => normalizeAutoWord(w)).filter(Boolean));
  const preferred = exclude.size > 0 ? pool.filter((w) => !exclude.has(w)) : pool;
  const pickFrom = preferred.length > 0 ? preferred : pool;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? null;
}

/**
 * 盤面サイズ・文字数に合うおまかせの探すことばを選ぶ。
 * 直前に出した語（exclude）を避けて最大20回まで再抽選。
 */
export function pickAutoTargetWordForBoard(
  cols: number,
  rows: number,
  length: number,
  opts?: { exclude?: string[] },
): string | null {
  if (!isAutoWordLengthValidForBoard(length, cols, rows)) return null;

  const exclude = [...(opts?.exclude ?? [])];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const word = pickRandomAutoTargetWord(length, { exclude });
    if (!word) return null;
    if (targetWordFitsBoard(word, cols, rows)) return word;
    exclude.push(word);
  }
  return null;
}
