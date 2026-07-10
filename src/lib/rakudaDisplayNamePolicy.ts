import type { User } from 'firebase/auth';
import { convertToHiragana, PROHIBITED_WORDS } from '../constants';
import { isRenrakuAdmin } from './renrakuAdmin';

/** 比較用：カタカナ→ひらがな、空白・不可視文字除去、NFKC */
function compactNicknameKey(raw: string): string {
  const n = String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  return convertToHiragana(n).replace(/\s+/g, '');
}

/** 禁止語照合（表示名・ニックネーム用） */
export function normalizeDisplayNameForNgCheck(raw: string): string {
  return compactNicknameKey(raw);
}

function hasProhibitedDisplayNameWord(normalized: string): boolean {
  if (!normalized) return false;
  return PROHIBITED_WORDS.some((word) => {
    const w = word.trim().toLowerCase();
    return w.length > 0 && normalized.includes(w);
  });
}

/** 表示名（ニックネーム）に禁止語が含まれるか。管理者も対象。 */
export function rakudaDisplayNameProhibitedWordMessage(nickname: string): string | null {
  const t = String(nickname ?? '').trim();
  if (!t) return null;
  const key = normalizeDisplayNameForNgCheck(t);
  if (!key) return null;
  if (hasProhibitedDisplayNameWord(key)) {
    return '表示名に使えない言葉が含まれています。別の名前にしてください';
  }
  return null;
}

/**
 * 表示名の統合検証（なりすまし防止＋禁止語）。
 * 絵文字は公式マークのなりすましのみチェック（禁止語はニックネーム側）。
 */
export function getRakudaDisplayNameValidationError(
  nickname: string,
  emoji = '',
  authUser?: User | null,
): string | null {
  const nickImperson = rakudaNicknameImpersonationMessage(nickname, authUser);
  if (nickImperson) return nickImperson;

  const emojiImperson = rakudaEmojiImpersonationMessage(emoji, authUser);
  if (emojiImperson) return emojiImperson;

  const prohibited = rakudaDisplayNameProhibitedWordMessage(nickname);
  if (prohibited) return prohibited;

  return null;
}

/** 公式表示名（管理者のみ利用可） */
export const RAKUDA_OFFICIAL_DISPLAY_NICKNAME = 'らくだ珈琲🐫☕';
export const RAKUDA_OFFICIAL_DISPLAY_EMOJI = '🐫';

const BRAND_CORE = compactNicknameKey('らくだ珈琲');

/** 公式ニックの近似（絵文字の有無・順序のゆらぎ） */
const OFFICIAL_NICK_VARIANT_KEYS = [
  compactNicknameKey('らくだ珈琲🐫☕'),
  compactNicknameKey('らくだ珈琲🐫'),
  compactNicknameKey('らくだ珈琲☕'),
  compactNicknameKey('らくだ珈琲'),
  BRAND_CORE,
].filter(Boolean);

/** 公式絵文字の近似（らくだマーク） */
const RESERVED_EMOJI_CHARS = new Set(['🐫', '🐪']);

function isReservedOfficialNicknameKey(key: string): boolean {
  if (!key) return false;
  if (OFFICIAL_NICK_VARIANT_KEYS.some((variant) => key === variant || key.includes(BRAND_CORE))) {
    return true;
  }
  return false;
}

/** ニックネームが「らくだ珈琲」公式と紛らわしいか（なりすまし防止）。連絡帳管理者のみ公式名の利用を許可 */
export function rakudaNicknameImpersonationMessage(nickname: string, authUser?: User | null): string | null {
  if (authUser && isRenrakuAdmin(authUser)) return null;

  const t = String(nickname ?? '').trim();
  if (!t) return null;
  const key = compactNicknameKey(t);
  if (!key) return null;

  if (isReservedOfficialNicknameKey(key)) {
    return '「らくだ珈琲」と紛らわしいニックネームは使えません（なりすまし防止のため別の名前にしてください）';
  }

  const ascii = t
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\u200B-\u200D\uFEFF._-]/g, '');
  if (ascii.includes('rakuda') && ascii.includes('coffee')) {
    return '「らくだ珈琲」と紛らわしいニックネームは使えません（なりすまし防止のため別の名前にしてください）';
  }

  return null;
}

/** 絵文字が公式マーク（🐫）と紛らわしいか。連絡帳管理者のみ利用可 */
export function rakudaEmojiImpersonationMessage(emoji: string, authUser?: User | null): string | null {
  if (authUser && isRenrakuAdmin(authUser)) return null;

  const chars = Array.from(String(emoji ?? '').trim());
  if (!chars.length) return null;

  if (chars.some((ch) => RESERVED_EMOJI_CHARS.has(ch))) {
    return '「🐫」は公式マークのため、別の絵文字を選んでください';
  }

  return null;
}
