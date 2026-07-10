/** 絵文字ひと言 — ホワイトリスト32（増やさない） */
export const PICKUP_EMOJI_AUTO_SYMBOLS: readonly string[] = [
  '🐫', '☕', '🌸', '⭐', '🌙', '☀️', '🌈', '🍙', '🍵', '🍎',
  '🐱', '🐶', '🐟', '🦁', '🦙', '🐸', '🐧', '🐻', '🎮', '🧩',
  '🎵', '✨', '💮', '🌊', '🍀', '🎨', '📖', '🎁', '🏠', '🌳',
  '🔍', '💫', '🎈',
];

/** Firestore gridRows 行内のセル区切り（絵文字連結の分解用） */
export const PICKUP_EMOJI_GRID_CELL_SEP = '\u2063';

const EMOJI_ALLOWED = new Set(PICKUP_EMOJI_AUTO_SYMBOLS);

const emojiSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

/** 絵文字お題・盤面セルを表示単位（grapheme）に分解 */
export function splitPickupEmojiGraphemes(word: string): string[] {
  const trimmed = (word || '').trim();
  if (!trimmed) return [];
  if (emojiSegmenter) {
    return [...emojiSegmenter.segment(trimmed)].map((s) => s.segment);
  }
  const out: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    let matched = '';
    for (const sym of PICKUP_EMOJI_AUTO_SYMBOLS) {
      if (trimmed.startsWith(sym, i)) {
        matched = sym;
        break;
      }
    }
    if (!matched) {
      matched = trimmed[i] ?? '';
    }
    out.push(matched);
    i += matched.length;
  }
  return out;
}

export function pickupEmojiGraphemeCount(word: string): number {
  return splitPickupEmojiGraphemes(word).length;
}

export function isPickupEmojiWordOnly(word: string): boolean {
  const graphemes = splitPickupEmojiGraphemes(word);
  if (graphemes.length === 0) return false;
  return graphemes.every((g) => EMOJI_ALLOWED.has(g));
}
