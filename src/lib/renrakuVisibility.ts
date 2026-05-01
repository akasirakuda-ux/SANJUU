/** 通常投稿の表示用 status（新規 addDoc 時に付与） */
export const RENRAKU_STATUS_ACTIVE = 'active' as const;

/** 管理者による論理削除で付与される status 値 */
export const RENRAKU_STATUS_DELETED = 'deleted' as const;

/** 管理者による通報対応・非表示で付与される status 値 */
export const RENRAKU_STATUS_BLOCKED = 'blocked' as const;

/** Firestore ドキュメントがタイムライン・一覧に表示してよいか（論理削除・通報非表示を除外） */
export function isRenrakuEntryVisible(data: {
  status?: unknown;
  deletedByAdmin?: unknown;
  blockedByAdmin?: unknown;
}): boolean {
  if (data.deletedByAdmin === true) return false;
  if (data.blockedByAdmin === true) return false;
  return data.status !== RENRAKU_STATUS_DELETED && data.status !== RENRAKU_STATUS_BLOCKED;
}

/** 管理者が「削除」ボタンで書き込むフィールド（updateDoc 用） */
export function renrakuAdminSoftDeleteFields(): { status: typeof RENRAKU_STATUS_DELETED; deletedByAdmin: true } {
  return { status: RENRAKU_STATUS_DELETED, deletedByAdmin: true };
}

/** 管理者が「投稿者をブロック（一括非表示）」で書き込むフィールド（updateDoc / batch.update 用） */
export function renrakuAdminBlockedFields(): {
  status: typeof RENRAKU_STATUS_BLOCKED;
  blockedByAdmin: true;
} {
  return { status: RENRAKU_STATUS_BLOCKED, blockedByAdmin: true };
}
