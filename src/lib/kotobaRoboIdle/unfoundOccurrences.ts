import { canonicalOccurrenceKey } from '../hundredPickupOccurrences';
import type { FoundWord, PlacedWord, Point } from '../../types';

export type UnfoundOccurrence = { word: string; start: Point; end: Point };

function occurrencesFromPlacedWords(placedWords: PlacedWord[]): Array<{ word: string; start: Point; end: Point }> {
  const out: Array<{ word: string; start: Point; end: Point }> = [];
  for (const pw of placedWords) {
    const word = typeof pw.word === 'string' ? pw.word : '';
    if (!word) continue;
    for (const occ of pw.occurrences ?? []) {
      if (!occ?.start || !occ?.end) continue;
      out.push({ word, start: occ.start, end: occ.end });
    }
  }
  return out;
}

function foundOccurrenceKeys(foundWords: FoundWord[]): Set<string> {
  const seen = new Set<string>();
  for (const fw of foundWords) {
    if (!fw?.start || !fw?.end) continue;
    const k = canonicalOccurrenceKey(fw.start, fw.end);
    if (k) seen.add(k);
  }
  return seen;
}

function foundWordNames(foundWords: FoundWord[]): Set<string> {
  return new Set(foundWords.map((fw) => fw.word).filter(Boolean));
}

/**
 * 残りの正解一覧。
 * - countByOccurrence: ひと言探し（出現座標単位）
 * - それ以外: 単語単位（各語の最初の occurrence を代表に）
 */
export function listUnfoundOccurrences(
  placedWords: PlacedWord[],
  foundWords: FoundWord[],
  countByOccurrence: boolean,
): UnfoundOccurrence[] {
  if (!placedWords?.length) return [];

  if (countByOccurrence) {
    const foundKeys = foundOccurrenceKeys(foundWords);
    const seen = new Set<string>();
    const out: UnfoundOccurrence[] = [];
    for (const item of occurrencesFromPlacedWords(placedWords)) {
      const k = canonicalOccurrenceKey(item.start, item.end);
      if (!k || foundKeys.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  }

  const found = foundWordNames(foundWords);
  const out: UnfoundOccurrence[] = [];
  const seenWords = new Set<string>();
  for (const item of occurrencesFromPlacedWords(placedWords)) {
    if (found.has(item.word) || seenWords.has(item.word)) continue;
    seenWords.add(item.word);
    out.push(item);
  }
  return out;
}
