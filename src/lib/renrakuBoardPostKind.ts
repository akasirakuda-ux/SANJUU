/** public_messages の投稿種別（掲示板タブ分離） */
import { isProtectedRenrakuAdminUid } from '../constants/renrakuAdmin';

export type RenrakuBoardPostKind = 'announcement' | 'chat';

export const RENRAKU_BOARD_POST_KIND_ANNOUNCEMENT: RenrakuBoardPostKind = 'announcement';
export const RENRAKU_BOARD_POST_KIND_CHAT: RenrakuBoardPostKind = 'chat';

export function getPublicMessagePostKind(data: { postKind?: unknown } | null | undefined): RenrakuBoardPostKind {
  return data?.postKind === RENRAKU_BOARD_POST_KIND_ANNOUNCEMENT
    ? RENRAKU_BOARD_POST_KIND_ANNOUNCEMENT
    : RENRAKU_BOARD_POST_KIND_CHAT;
}

/** 機能追加前: 管理者投稿で postKind 未設定 → 連絡事項扱い */
export function isLegacyRenrakuAnnouncement(
  data: { postKind?: unknown; fromUserUid?: unknown } | null | undefined,
): boolean {
  if (!data) return false;
  if (data.postKind === RENRAKU_BOARD_POST_KIND_ANNOUNCEMENT) return false;
  if (data.postKind === RENRAKU_BOARD_POST_KIND_CHAT) return false;
  const uid = typeof data.fromUserUid === 'string' ? data.fromUserUid.trim() : '';
  return isProtectedRenrakuAdminUid(uid);
}

export function isPublicMessageAnnouncement(
  data: { postKind?: unknown; fromUserUid?: unknown } | null | undefined,
): boolean {
  return (
    getPublicMessagePostKind(data) === RENRAKU_BOARD_POST_KIND_ANNOUNCEMENT ||
    isLegacyRenrakuAnnouncement(data)
  );
}

/** 掲示板タイムラインタブ */
export type RenrakuBoardTimelineTab = 'announcements' | 'chat';

export const RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS: RenrakuBoardTimelineTab = 'announcements';
export const RENRAKU_BOARD_TIMELINE_TAB_CHAT: RenrakuBoardTimelineTab = 'chat';

export const RENRAKU_ANNOUNCEMENTS_TIMELINE_ELEMENT_ID = 'renraku-announcements-timeline';
export const RENRAKU_CHAT_TIMELINE_ELEMENT_ID = 'renraku-public-timeline';
