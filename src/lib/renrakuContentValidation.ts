import type { User } from 'firebase/auth';
import { convertToHiragana, PROHIBITED_WORDS } from '../constants';
import {
  rakudaEmojiImpersonationMessage,
  rakudaNicknameImpersonationMessage,
  rakudaDisplayNameProhibitedWordMessage,
} from './rakudaDisplayNamePolicy';
import { hasRenrakuHardBannedPhrase, RENRAKU_HARD_BANNED_ERROR_MESSAGE } from './renrakuHardBanned';

/** 掲示板のクライアント側検証（NG 語・連絡先っぽい文字列など）を一時停止するとき true にする */
export const RENRAKU_POST_CLIENT_VALIDATION_DISABLED = true;

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

/** 半角「@」（掲示板案内の @ニックネーム）がメール誤検出しないよう ASCII @ を全角へ置換してから EMAIL_RE で見る */
const FULLWIDTH_COMMERCIAL_AT = '\uFF20';
/** @ の直後（全角／半角スペース許容）が日本語ならメンション扱い */
const ASCII_AT_BEFORE_JP_MENTION = /@(?=[\s\u3000　]*[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u30fc])/g;

function maskJpMentionAtForEmailCheck(raw: string): string {
  return raw.replace(ASCII_AT_BEFORE_JP_MENTION, FULLWIDTH_COMMERCIAL_AT);
}

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
 * 連絡帳投稿のクライアント側検証。公式名・しね系は常時。広い NG 語リストは `RENRAKU_POST_CLIENT_VALIDATION_DISABLED` で止められる。
 */
export function getRenrakuPostValidationError(
  message: string,
  nickname: string,
  userEmoji: string,
  authUser?: User | null,
  opts?: { forcePiiAndNgWords?: boolean },
): string | null {
  const nickMsg = rakudaNicknameImpersonationMessage(nickname, authUser);
  if (nickMsg) return nickMsg;

  const emojiMsg = rakudaEmojiImpersonationMessage(userEmoji, authUser);
  if (emojiMsg) return emojiMsg;

  const displayNg = rakudaDisplayNameProhibitedWordMessage(nickname);
  if (displayNg) return displayNg;

  if (hasRenrakuHardBannedPhrase(message)) {
    return RENRAKU_HARD_BANNED_ERROR_MESSAGE;
  }

  if (RENRAKU_POST_CLIENT_VALIDATION_DISABLED && !opts?.forcePiiAndNgWords) return null;

  const raw = `${message}\n${nickname}`;
  if (EMAIL_RE.test(maskJpMentionAtForEmailCheck(raw))) return RENRAKU_VALIDATION_ERROR_MESSAGE;
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (PHONE_JP_RE.test(half)) return RENRAKU_VALIDATION_ERROR_MESSAGE;

  const normalized = normalizeForMatch(message) + '\n' + normalizeForMatch(nickname);
  if (hasProhibitedWords(normalized)) return RENRAKU_VALIDATION_ERROR_MESSAGE;

  return null;
}

/**
 * 連絡帳投稿のクライアント側検証（NG 語・個人情報っぽいパターン）
 */
export function validateRenrakuPost(
  message: string,
  nickname: string,
  authUser?: User | null,
  userEmoji = ''
): boolean {
  return getRenrakuPostValidationError(message, nickname, userEmoji, authUser) === null;
}
