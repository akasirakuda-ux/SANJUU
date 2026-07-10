const HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'.split('');
const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'.split('');
const DIGITS = '0123456789'.split('');
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const EMOJI = '🐫☕🌸🎵⭐🍙🔍💮🌙✨🎮📖🦙🍵🎨🧩'.split('');

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 牌種ごとに4枚 — 上海と同じく4枚組 */
export function buildSymbolDeck(tileCount: number, seed = Date.now()): string[] {
  const kinds = tileCount / 4;
  const pool: string[] = [];
  for (const ch of [...HIRAGANA, ...KATAKANA, ...DIGITS, ...ALPHA, ...EMOJI]) {
    pool.push(ch);
    if (pool.length >= kinds) break;
  }
  while (pool.length < kinds) {
    pool.push(`·${pool.length}`);
  }
  const deck: string[] = [];
  for (const sym of pool.slice(0, kinds)) {
    for (let i = 0; i < 4; i++) deck.push(sym);
  }
  return shuffle(deck, seed);
}
