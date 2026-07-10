import { convertToHiragana } from '../constants';

/** 掲示板で常に拒否する最低限の語（しね系のみ） */
const RENRAKU_HARD_BANNED_CORE = ['しね', '死ね'] as const;

export const RENRAKU_HARD_BANNED_ERROR_MESSAGE =
  'この言葉は投稿できません。内容を見直してください。';

function normalizeForHardBan(s: string): string {
  return convertToHiragana(
    String(s ?? '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
  ).replace(/\s+/g, '');
}

/** 投稿本文にしね系が含まれるか（ニックネームは対象外） */
export function hasRenrakuHardBannedPhrase(message: string): boolean {
  const normalized = normalizeForHardBan(message);
  if (!normalized) return false;
  return RENRAKU_HARD_BANNED_CORE.some((word) => normalized.includes(word));
}
