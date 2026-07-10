import { targetWordFitsBoard } from './boardDimensions';
import {
  HUNDRED_PICKUP_TARGET_WORD_MAX_LEN,
  HUNDRED_PICKUP_TARGET_WORD_MIN_LEN,
  isManualPickupHiraganaWordAllowed,
  isPickupHiraganaReverseReadingRejected,
  isPickupHiraganaTargetWordProhibited,
  isPickupTargetWordHiraganaOnly,
  pickupTargetWordCharCount,
} from './hundredAutoTargetWord';
import {
  isPickupEmojiWordOnly,
  PICKUP_EMOJI_AUTO_SYMBOLS,
  pickupEmojiGraphemeCount,
  splitPickupEmojiGraphemes,
} from './pickupEmojiSymbols';

export {
  PICKUP_EMOJI_AUTO_SYMBOLS,
  PICKUP_EMOJI_GRID_CELL_SEP,
  pickupEmojiGraphemeCount,
  splitPickupEmojiGraphemes,
} from './pickupEmojiSymbols';

/** ひと言探しの文字種 */
export type PickupCharset = 'hiragana' | 'digit' | 'latin' | 'emoji';

/** ボタン・募集バッジ共通 */
export const PICKUP_CHARSET_LABELS: Record<PickupCharset, string> = {
  hiragana: 'あ',
  digit: '123',
  latin: 'ABC',
  emoji: '🎮',
};

const EMOJI_ALLOWED = new Set(PICKUP_EMOJI_AUTO_SYMBOLS);

export const PICKUP_CHARSET_OPTIONS: { id: PickupCharset; label: string; hint: string }[] = [
  { id: 'hiragana', label: PICKUP_CHARSET_LABELS.hiragana, hint: 'ひらがな（2〜4文字）' },
  { id: 'digit', label: PICKUP_CHARSET_LABELS.digit, hint: '数字 0〜9（2〜6桁）' },
  { id: 'latin', label: PICKUP_CHARSET_LABELS.latin, hint: '英語 A〜Z（3〜4文字・リストの単語）' },
];

export function normalizePickupCharset(raw: unknown): PickupCharset {
  if (raw === 'digit' || raw === 'latin' || raw === 'emoji') return raw;
  return 'hiragana';
}

/** 探すことばの形から文字種を推定（pickupCharset 欠損時のフォールバック） */
export function inferPickupCharsetFromWord(word: string): PickupCharset | null {
  const w = (word || '').trim();
  if (!w) return null;
  if (/^[0-9]+$/.test(w)) return 'digit';
  if (/^[A-Za-z]+$/.test(w)) return 'latin';
  if (isPickupEmojiWordOnly(w)) return 'emoji';
  if (isPickupTargetWordHiraganaOnly(w)) return 'hiragana';
  return null;
}

/** らくだロボでもう一回: 前のお題と同じ文字数帯で長さを決める */
export function robReplayTargetLength(charset: PickupCharset, previousTargetWord: string): number {
  const prevLen =
    charset === 'emoji'
      ? pickupEmojiGraphemeCount(previousTargetWord)
      : pickupTargetWordCharCount(previousTargetWord);
  const { min, max } = pickupLengthBounds(charset);
  return Math.min(max, Math.max(min, prevLen));
}

export function pickupCharsetBadge(charset: PickupCharset | undefined): string {
  return PICKUP_CHARSET_LABELS[normalizePickupCharset(charset)];
}

/** 作成画面の説明文（選択中の種類） */
export function pickupCharsetDescription(charset: PickupCharset): string {
  switch (charset) {
    case 'digit':
      return '123 — 数字だけ（0〜9）。言語不要';
    case 'latin':
      return 'ABC — 英語の単語（3〜4文字・リストから）。海外向け';
    default:
      return 'あ — ひらがな。いつもどおり';
  }
}

export function pickupLengthBounds(charset: PickupCharset): { min: number; max: number } {
  switch (charset) {
    case 'digit':
      return { min: 2, max: 6 };
    case 'latin':
      return { min: 3, max: 4 };
    case 'emoji':
      return { min: 3, max: 4 };
    default:
      return { min: HUNDRED_PICKUP_TARGET_WORD_MIN_LEN, max: HUNDRED_PICKUP_TARGET_WORD_MAX_LEN };
  }
}

export function isPickupTargetWordEmojiOnly(word: string): boolean {
  return isPickupEmojiWordOnly(word);
}

export function pickRandomEmojiWord(length: number): string {
  const len = Math.max(3, Math.min(4, Math.floor(length)));
  let out = '';
  for (let i = 0; i < len; i += 1) {
    const sym = PICKUP_EMOJI_AUTO_SYMBOLS[Math.floor(Math.random() * PICKUP_EMOJI_AUTO_SYMBOLS.length)];
    out += sym ?? '🌸';
  }
  return out;
}

const DIGIT_WORD = /^[0-9]+$/u;
const LATIN_WORD = /^[A-Z]+$/u;

/**
 * 英語おまかせ — 3〜4文字の名詞（中学英語程度・らくだロボと手入力共通）
 * 和訳一覧: docs/rakuda-product-ideas-backlog.md
 */
export const LATIN_AUTO_WORDS: readonly string[] = [
  // 3文字（63）
  'ANT', 'ART', 'BAT', 'BEE', 'BOY', 'BUS', 'CAB', 'CAP', 'CAR', 'CAT', 'COW', 'CUP', 'DAY', 'DEW', 'DOG',
  'EAR', 'EGG', 'ELF', 'EYE', 'FAN', 'FOG', 'FOX', 'FUN', 'HAT', 'HEN', 'HUB', 'HUG', 'ICE', 'JAM',
  'JET', 'KEY', 'KID', 'LAW', 'LOG', 'MAP', 'MUD', 'NET', 'OWL', 'PAN', 'PAW', 'PEN', 'PET', 'PIE', 'PIG',
  'PIN', 'POD', 'POT', 'PUP', 'RAT', 'RAY', 'RED', 'ROD', 'RUG', 'SKY', 'SON', 'SUN', 'TEA', 'TEN', 'TOY',
  'TUB', 'VAN', 'WEB', 'ZOO',
  // 4文字（154）
  'BABY', 'BACK', 'BALL', 'BAND', 'BANK', 'BEAR', 'BEAN', 'BELL', 'BIRD', 'BLUE', 'BOAT', 'BOOK', 'BOWL',
  'CAKE', 'CAMP', 'CITY', 'CLUB', 'COAL', 'COAT', 'COIN', 'COMB', 'CORN', 'CRAB', 'CUBE', 'DAWN',
  'DEER', 'DESK', 'DOCK', 'DOOR', 'DOVE', 'DUCK', 'DUST', 'FACE', 'FACT', 'FARM', 'FISH', 'FLAG',
  'FOAM', 'FOOT', 'FROG', 'GAME', 'GATE', 'GIFT', 'GIRL', 'GOAT', 'GOLD', 'GRAY', 'HALL', 'HAND', 'HARE',
  'HAWK', 'HEAD', 'HILL', 'HOLE', 'HOME', 'HOPE', 'HORN', 'HOUR', 'IDEA', 'IRIS', 'JAZZ', 'JEEP', 'KITE',
  'KNEE', 'LADY', 'LAKE', 'LAMB', 'LAMP', 'LAND', 'LEAF', 'LIFE', 'LION', 'LOFT', 'LOVE', 'LUCK', 'MAIL',
  'MEAL', 'MEAT', 'MILK', 'MIND', 'MOLE', 'MOON', 'MOSS', 'NECK', 'NEWS', 'NOON', 'NOSE', 'NOTE', 'OATS',
  'PARK', 'PATH', 'PEAR', 'PINE', 'PINK', 'PLUM', 'POEM', 'POET', 'POLE', 'POND', 'POOL', 'RAIN', 'RICE',
  'RING', 'ROAD', 'ROCK', 'ROOF', 'ROOM', 'ROPE', 'ROSE', 'RUBY', 'RULE', 'SAIL', 'SALT', 'SAND',
  'SEAL', 'SEAT', 'SEED', 'SHIP', 'SHOE', 'SHOP', 'SILK', 'SIZE', 'SKIN', 'SNOW', 'SOFA', 'SOIL',
  'SOUP', 'STAR', 'STEM', 'SWAN', 'TEAM', 'TEAR', 'TENT', 'TIME', 'TOOL', 'TOWN', 'TREE', 'TRIP',
  'TUBE', 'TUNE', 'TWIN', 'VINE', 'WALL', 'WAVE', 'WIFE', 'WIND', 'WING', 'WOLF', 'WOOD', 'WOOL', 'WORD',
  'WORM', 'YARN', 'ZERO',
];

const LATIN_ALLOWED = new Set(LATIN_AUTO_WORDS);

export const DIGIT_AUTO_WORD_LENGTH_OPTIONS = [2, 3, 4, 5, 6] as const;
export type DigitAutoWordLength = (typeof DIGIT_AUTO_WORD_LENGTH_OPTIONS)[number];

export function isPickupTargetWordLengthOk(word: string, charset: PickupCharset = 'hiragana'): boolean {
  const len =
    charset === 'emoji' ? pickupEmojiGraphemeCount(word) : pickupTargetWordCharCount(word);
  const { min, max } = pickupLengthBounds(charset);
  return len >= min && len <= max;
}

export function isPickupTargetWordCharsetOk(word: string, charset: PickupCharset = 'hiragana'): boolean {
  const trimmed = (word || '').trim();
  if (!trimmed) return charset === 'hiragana';

  switch (charset) {
    case 'digit':
      return DIGIT_WORD.test(trimmed);
    case 'latin': {
      const upper = trimmed.toUpperCase();
      return LATIN_WORD.test(upper);
    }
    case 'emoji':
      return isPickupTargetWordEmojiOnly(trimmed);
    default:
      return isPickupTargetWordHiraganaOnly(trimmed);
  }
}

export function normalizePickupTargetWord(word: string, charset: PickupCharset): string {
  const trimmed = (word || '').trim();
  if (charset === 'digit') return trimmed.replace(/[^0-9]/g, '');
  if (charset === 'latin') return trimmed.toUpperCase().replace(/[^A-Z]/g, '');
  if (charset === 'emoji') {
    return splitPickupEmojiGraphemes(trimmed)
      .filter((g) => EMOJI_ALLOWED.has(g))
      .join('');
  }
  return trimmed;
}

export function isPickupTargetWordValid(
  word: string,
  charset: PickupCharset,
  cols: number,
  rows: number,
): boolean {
  const normalized = normalizePickupTargetWord(word, charset);
  if (!normalized) return false;
  if (!isPickupTargetWordLengthOk(normalized, charset)) return false;
  if (!isManualPickupTargetWordAllowed(normalized, charset)) return false;
  if (!targetWordFitsBoard(normalized, cols, rows)) return false;
  return true;
}

/** 手入力の探すことば — 文字種・文字数・公序良俗（ひらがな）を満たすか */
export function isManualPickupTargetWordAllowed(word: string, charset: PickupCharset): boolean {
  const normalized = normalizePickupTargetWord(word, charset);
  if (!normalized) return false;
  if (!isPickupTargetWordLengthOk(normalized, charset)) return false;
  switch (charset) {
    case 'digit':
      return DIGIT_WORD.test(normalized);
    case 'latin':
      return LATIN_WORD.test(normalized);
    case 'emoji':
      return isPickupTargetWordEmojiOnly(normalized);
    default:
      return isManualPickupHiraganaWordAllowed(normalized);
  }
}

export function manualPickupTargetWordError(charset: PickupCharset, word?: string): string {
  switch (charset) {
    case 'digit':
      return '数字（0〜9）で入力してください';
    case 'latin':
      return '英字（3〜4文字・A〜Z）で入力してください';
    case 'emoji':
      return 'リストにある絵文字（3〜4個）で入力してください';
    default:
      if (word && isPickupHiraganaReverseReadingRejected(word)) {
        return '逆さ読みでも別の語になる言葉は使えません';
      }
      if (word && isPickupHiraganaTargetWordProhibited(word)) {
        return '公序良俗に反する語は使えません';
      }
      return 'ひらがな2〜4文字で入力してください';
  }
}

export function digitAutoLengthOptionsForBoard(cols: number, rows: number): DigitAutoWordLength[] {
  const maxLen = Math.min(6, Math.max(cols, rows));
  return DIGIT_AUTO_WORD_LENGTH_OPTIONS.filter((len) => len <= maxLen);
}

export function latinAutoLengthOptionsForBoard(cols: number, rows: number): number[] {
  const maxLen = Math.min(4, Math.max(cols, rows));
  const seen = new Set<number>();
  for (const w of LATIN_AUTO_WORDS) {
    if (w.length < 3 || w.length > maxLen) continue;
    if (!targetWordFitsBoard(w, cols, rows)) continue;
    seen.add(w.length);
  }
  return [...seen].sort((a, b) => a - b);
}

export function pickRandomDigitWord(length: number): string {
  const len = Math.max(2, Math.min(6, Math.floor(length)));
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

export function pickRandomLatinWord(length: number, opts?: { exclude?: string[] }): string | null {
  const len = Math.floor(length);
  if (len < 3 || len > 4) return null;
  const exclude = new Set((opts?.exclude ?? []).map((w) => w.toUpperCase()));
  const pool = LATIN_AUTO_WORDS.filter((w) => w.length === len && !exclude.has(w));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function pickAutoTargetWordForPickupCharset(
  charset: PickupCharset,
  cols: number,
  rows: number,
  length: number,
  opts?: { exclude?: string[] },
): string | null {
  if (charset === 'digit') {
    if (!digitAutoLengthOptionsForBoard(cols, rows).includes(length as DigitAutoWordLength)) return null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const word = pickRandomDigitWord(length);
      if (targetWordFitsBoard(word, cols, rows)) return word;
    }
    return null;
  }
  if (charset === 'latin') {
    if (!latinAutoLengthOptionsForBoard(cols, rows).includes(length)) return null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const word = pickRandomLatinWord(length, opts);
      if (!word) return null;
      if (targetWordFitsBoard(word, cols, rows)) return word;
      opts = { exclude: [...(opts?.exclude ?? []), word] };
    }
    return null;
  }
  if (charset === 'emoji') {
    if (length < 3 || length > 4) return null;
    const exclude = new Set((opts?.exclude ?? []).map((w) => w.trim()).filter(Boolean));
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const word = pickRandomEmojiWord(length);
      if (exclude.has(word)) continue;
      if (targetWordFitsBoard(word, cols, rows)) return word;
    }
    return null;
  }
  return null;
}

export function manualInputPlaceholder(charset: PickupCharset): string {
  switch (charset) {
    case 'digit':
      return '例：2026';
    case 'latin':
      return '例：CAT';
    case 'emoji':
      return '例：🐫☕🌸';
    default:
      return '例：らくだ';
  }
}

export function manualInputHint(charset: PickupCharset): string {
  const { min, max } = pickupLengthBounds(charset);
  switch (charset) {
    case 'digit':
      return `${min}〜${max}桁（0〜9）`;
    case 'latin':
      return `${min}〜${max}文字（英字 A〜Z）`;
    case 'emoji':
      return `${min}〜${max}個（リストの絵文字）`;
    default:
      return `${min}〜${max}文字（ひらがな・自由入力）`;
  }
}

export function charsetValidationError(charset: PickupCharset): string {
  switch (charset) {
    case 'digit':
      return '数字（0〜9）で入力してください';
    case 'latin':
      return '英字（A〜Z）で入力してください';
    case 'emoji':
      return 'リストにある絵文字（3〜4個）で入力してください';
    default:
      return 'ひらがなで入力してください';
  }
}
