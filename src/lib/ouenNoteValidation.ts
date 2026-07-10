import type { User } from 'firebase/auth';
import { getRakudaDisplayNameValidationError } from './rakudaDisplayNamePolicy';
import { getRenrakuPostValidationError } from './renrakuContentValidation';
import { OUEN_NOTE_COMMENT_MAX_CHARS, OUEN_NOTE_TOPIC_MAX_CHARS } from './ouenNoteConfig';
import {
  composeOuenNoteBody,
  type OuenNoteTopicDraft,
} from './ouenNoteTopicFormat';

/** ノート専用 — メール・電話・NG語チェックを常に ON */
export function getOuenNoteBodyValidationError(
  body: string,
  nickname: string,
  userEmoji: string,
  authUser?: User | null,
  maxChars = OUEN_NOTE_TOPIC_MAX_CHARS,
): string | null {
  const trimmed = body.trim();
  if (!trimmed) return '内容を書いてください';
  if (trimmed.length > maxChars) return `${maxChars}文字以内にしてください`;
  return getRenrakuPostValidationError(trimmed, nickname, userEmoji, authUser, {
    forcePiiAndNgWords: true,
  });
}

export function getOuenNoteTopicDraftValidationError(
  draft: OuenNoteTopicDraft,
  authUser?: User | null,
): string | null {
  const title = draft.title.trim();
  if (!title) return '相談のタイトルを書いてください';

  const nick = draft.postNick.trim();
  const emoji = (draft.postEmoji || '').trim() || '🐫';
  const nameErr = getRakudaDisplayNameValidationError(nick, emoji, authUser);
  if (nameErr) return nameErr;

  const hasDetail =
    draft.consultantProfile.trim() ||
    draft.goal.trim() ||
    draft.situation.trim() ||
    draft.feelings.trim() ||
    draft.triedResearch.trim();
  if (!hasDetail) {
    return 'タイトル以外に、1つ以上の項目を書いてください';
  }

  const body = composeOuenNoteBody(draft);
  return getOuenNoteBodyValidationError(body, nick, emoji, authUser);
}

export function getOuenNoteCommentValidationError(
  text: string,
  nickname: string,
  userEmoji: string,
  authUser?: User | null,
): string | null {
  return getOuenNoteBodyValidationError(text, nickname, userEmoji, authUser, OUEN_NOTE_COMMENT_MAX_CHARS);
}
