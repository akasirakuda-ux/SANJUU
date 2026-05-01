import { getPublicUrl } from '../constants';

/** 共有リンク・表示用の参加コード（syncShareRoomId を優先） */
export function inviteRoomCodeForShare(
  syncShareRoomId: string | null | undefined,
  roomId: string | null | undefined
): string {
  return (syncShareRoomId ?? roomId) || '';
}

/** マルチ参加用の共有 URL（SelectScreen と同一の組み立て） */
export function buildRoomJoinShareUrl(
  syncShareRoomId: string | null | undefined,
  roomId: string | null | undefined
): string {
  const code = inviteRoomCodeForShare(syncShareRoomId, roomId);
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${getPublicUrl()}${path}${path.endsWith('/') ? '' : '/'}?room=${code}`;
}
