import { HIRAGANA } from '../constants';

const HIRAGANA_CHARS = Array.from(HIRAGANA);

export function getRandomHiraganaChar() {
  return HIRAGANA_CHARS[Math.floor(Math.random() * HIRAGANA_CHARS.length)];
}

export function getRandomHiraganaCharWith(rngNext: () => number) {
  return HIRAGANA_CHARS[Math.floor(rngNext() * HIRAGANA_CHARS.length)];
}

