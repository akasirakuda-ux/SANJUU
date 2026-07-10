import { MASTER, PROHIBITED_WORDS, convertToHiragana } from '../constants';
import { targetWordFitsBoard } from './boardDimensions';

const HIRAGANA_WORD = /^[ぁ-んー]+$/u;

/** ひと言探しのお題：2〜4文字 */
export const HUNDRED_PICKUP_TARGET_WORD_MIN_LEN = 2;
export const HUNDRED_PICKUP_TARGET_WORD_MAX_LEN = 4;

/** おまかせモードで選べる文字数（盤面に収まるものだけ UI で有効化） */
export const HUNDRED_AUTO_WORD_LENGTH_OPTIONS = [2, 3, 4] as const;

export function pickupTargetWordCharCount(word: string): number {
  return Array.from((word || '').trim()).length;
}

export function isPickupTargetWordLengthOk(word: string): boolean {
  const len = pickupTargetWordCharCount(word);
  return len >= HUNDRED_PICKUP_TARGET_WORD_MIN_LEN && len <= HUNDRED_PICKUP_TARGET_WORD_MAX_LEN;
}

/** 探すことばがひらがな（ぁ-ん・ー）のみか */
export function isPickupTargetWordHiraganaOnly(word: string): boolean {
  const trimmed = (word || '').trim();
  if (!trimmed) return true;
  return HIRAGANA_WORD.test(trimmed);
}

export function clampPickupTargetWordLength(length: number): number {
  return Math.min(
    HUNDRED_PICKUP_TARGET_WORD_MAX_LEN,
    Math.max(HUNDRED_PICKUP_TARGET_WORD_MIN_LEN, Math.floor(length)),
  );
}

export type HundredAutoWordLength = (typeof HUNDRED_AUTO_WORD_LENGTH_OPTIONS)[number];

const poolsByLength = new Map<number, string[]>();

/**
 * ことば探し辞書の語が、もともとひらがな（カタカナはひらがな化）だけか。
 * 漢字熟語を strip した断片（例: 忌憚のない → のない）はおまかせ候補にしない。
 */
export function isKotobaHiraganaSourceWord(raw: string): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return false;
  return HIRAGANA_WORD.test(convertToHiragana(trimmed));
}

function normalizeAutoWord(raw: string): string {
  return convertToHiragana((raw || '').trim());
}

/** ひらがなお題の文字順を逆にした文字列 */
export function reverseHiraganaGraphemes(word: string): string {
  return Array.from((word || '').trim()).reverse().join('');
}

/**
 * ひと言探し — 盤上の文字を逆順で読むと別の語（禁止語など）になるお題。
 * 例: 「かば」→「ばか」
 */
export function isPickupHiraganaReverseReadingRejected(word: string): boolean {
  const normalized = normalizeAutoWord(word);
  if (!normalized || normalized.length < 2) return false;
  const reversed = reverseHiraganaGraphemes(normalized);
  if (reversed === normalized) return false;
  return PROHIBITED_WORDS.some((w) => w.length >= 2 && reversed.includes(w));
}

function isAllowedAutoWord(normalized: string): boolean {
  if (!normalized || !HIRAGANA_WORD.test(normalized)) return false;
  if (PROHIBITED_WORDS.some((w) => normalized.includes(w))) return false;
  if (isPickupHiraganaReverseReadingRejected(normalized)) return false;
  return true;
}

/** 手入力のひらがなお題 — 公序良俗（PROHIBITED_WORDS）以外は自由 */
export function isManualPickupHiraganaWordAllowed(word: string): boolean {
  const normalized = normalizeAutoWord(word);
  if (!normalized || !isPickupTargetWordLengthOk(normalized)) return false;
  return isAllowedAutoWord(normalized);
}

/** 公序良俗リストに引っかかるか（手入力エラー表示用） */
export function isPickupHiraganaTargetWordProhibited(word: string): boolean {
  const normalized = normalizeAutoWord(word);
  if (!normalized || !HIRAGANA_WORD.test(normalized)) return false;
  if (PROHIBITED_WORDS.some((w) => normalized.includes(w))) return true;
  return isPickupHiraganaReverseReadingRejected(normalized);
}

function poolForLength(length: number): string[] {
  const cached = poolsByLength.get(length);
  if (cached) return cached;

  const seen = new Set<string>();
  const out: string[] = [];

  for (const cat of MASTER.categories) {
    for (const raw of cat.words) {
      if (!isKotobaHiraganaSourceWord(raw)) continue;
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
 * ことば探しと同じく辞書にひらがなで載っている語のみ（漢字語の断片は使わない）。
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
