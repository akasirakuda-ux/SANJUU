import { convertToHiragana, PROHIBITED_WORDS } from '../constants';

/** 連絡帳でユーザーに見せる統一メッセージ */
export const RENRAKU_VALIDATION_ERROR_MESSAGE =
  '不適切な表現が含まれている可能性があるので、内容を見直して再度投稿をしてください。';

/** 半角英数字に寄せて比較しやすくする */
function normalizeForMatch(s: string): string {
  return convertToHiragana(s.trim().toLowerCase())
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '');
}

/** メール形式 */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** 日本の電話番号っぽい表記（0XX-XXX-XXXX 等） */
const PHONE_JP_RE =
  /0\d{1,4}[\s\-ー－]*\d{1,4}[\s\-ー－]*\d{3,5}|0[5789]0[\s\-ー－]*\d{4}[\s\-ー－]*\d{4}/;

function hasProhibitedWords(normalized: string): boolean {
  return PROHIBITED_WORDS.some((word) => {
    const w = word.trim().toLowerCase();
    if (!w) return false;
    return normalized.includes(w);
  });
}

/**
 * 連絡帳投稿のクライアント側検証（NG 語・個人情報っぽいパターン）
 */
export function validateRenrakuPost(message: string, nickname: string): boolean {
  const raw = `${message}\n${nickname}`;
  if (EMAIL_RE.test(raw)) return false;
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (PHONE_JP_RE.test(half)) return false;

  const normalized = normalizeForMatch(message) + '\n' + normalizeForMatch(nickname);
  if (hasProhibitedWords(normalized)) return false;

  return true;
}
