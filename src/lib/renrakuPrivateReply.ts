/** 伝言への返信（差出人だけが read 可能 — firestore.rules と対） */
export const RENRAKU_PRIVATE_REPLY_DOC_ID = 'sender';

export type RenrakuPrivateReplyPayload = {
  text: string;
  toUserUid: string;
  createdAt?: unknown;
};

/** 親 doc の legacy フィールドとサブコレクションの両方から表示用テキストを得る */
export function resolveRenrakuPrivateReplyText(
  parent: { replyMessage?: unknown; replyEmoji?: unknown } | null | undefined,
  sub: RenrakuPrivateReplyPayload | null | undefined
): string {
  const fromSub = String(sub?.text ?? '').trim();
  if (fromSub) return fromSub;
  const fromParent = String(parent?.replyMessage ?? '').trim();
  if (fromParent) return fromParent;
  const legacyEmoji = String(parent?.replyEmoji ?? '').trim();
  return legacyEmoji;
}
