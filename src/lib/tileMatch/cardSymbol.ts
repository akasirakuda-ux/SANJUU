/** トランプ型の色分け（記号の種類ごと） */
export type TileCardSuit = 'ruby' | 'sapphire' | 'onyx' | 'joker';

const HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const DIGITS = '0123456789';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function tileCardSuitForSymbol(symbol: string): TileCardSuit {
  const s = (symbol || '').trim();
  if (!s) return 'onyx';
  if (s.length > 2 || /\p{Extended_Pictographic}/u.test(s)) return 'joker';
  const ch = s[0];
  if (HIRAGANA.includes(ch)) return 'ruby';
  if (KATAKANA.includes(ch)) return 'sapphire';
  if (DIGITS.includes(ch)) return 'onyx';
  if (ALPHA.includes(ch)) return 'onyx';
  return 'joker';
}

export function tileCardSuitLabelJa(suit: TileCardSuit): string {
  switch (suit) {
    case 'ruby':
      return 'ひらがな';
    case 'sapphire':
      return 'カタカナ';
    case 'joker':
      return '絵文字';
    default:
      return '記号';
  }
}
