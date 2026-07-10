import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME } from './reversiConfig';

/** 常設らくだロボひと言探し — 固定 room / public ドキュメント ID */
export const ROBO_PICKUP_LOUNGE_ROOM_ID = 'robo-pickup-lounge';
export const ROBO_PICKUP_LOUNGE_PUBLIC_ID = 'robo-pickup-lounge';

/** 常設絵文字ロボひと言探し */
export const ROBO_PICKUP_EMOJI_LOUNGE_ROOM_ID = 'robo-pickup-lounge-emoji';
export const ROBO_PICKUP_EMOJI_LOUNGE_PUBLIC_ID = 'robo-pickup-lounge-emoji';

export const ROBO_PICKUP_LOUNGE_COLS = 10;
export const ROBO_PICKUP_LOUNGE_ROWS = 10;

/** Firestore の盤面が常設の想定サイズと違う（旧10×15など） */
export function roboLoungeBoardSizeMismatch(d: Record<string, unknown>): boolean {
  const cols = Number(d.boardCols ?? d.boardSize ?? 0);
  const rows = Number(d.boardRows ?? 0);
  const gridRows = d.gridRows;
  const gridRowCount = Array.isArray(gridRows) ? gridRows.length : 0;
  if (cols > 0 && cols !== ROBO_PICKUP_LOUNGE_COLS) return true;
  if (rows > 0 && rows !== ROBO_PICKUP_LOUNGE_ROWS) return true;
  if (gridRowCount > 0 && gridRowCount !== ROBO_PICKUP_LOUNGE_ROWS) return true;
  return false;
}

/** クライアントに読み込んだ grid[][] が常設想定と違う */
export function roboLoungeLoadedGridMismatch(grid: string[][] | null | undefined): boolean {
  if (!grid?.length) return false;
  const rowCount = grid.length;
  const colCount = grid.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
  if (rowCount > 0 && rowCount !== ROBO_PICKUP_LOUNGE_ROWS) return true;
  if (colCount > 0 && colCount !== ROBO_PICKUP_LOUNGE_COLS) return true;
  return false;
}

/** ロボ常設は 3〜4 文字のみ */
export const ROBO_PICKUP_LOUNGE_MIN_LEN = 3;
export const ROBO_PICKUP_LOUNGE_MAX_LEN = 4;

/** Firestore `hostUid` プレースホルダ（人間ホストではない） */
export const ROBO_PICKUP_LOUNGE_HOST_UID = '__robo_pickup_lounge__';
export const ROBO_PICKUP_EMOJI_LOUNGE_HOST_UID = '__robo_pickup_lounge_emoji__';

export const ROBO_PICKUP_LOUNGE_PUBLIC_FLAG = 'roboPickupLounge' as const;

export const EMOJI_ROBO_EMOJI = '🎮';
export const EMOJI_ROBO_NAME = '絵文字ロボ';

export const ROBO_PICKUP_LOUNGE_TITLE = `${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}のひと言探し`;
export const ROBO_PICKUP_EMOJI_LOUNGE_TITLE = `${EMOJI_ROBO_EMOJI} ${EMOJI_ROBO_NAME}のひと言探し`;

/** 誰も見つけない放置 — 10分でヒント、15分でお題差し替え */
export const ROBO_PICKUP_STALE_HINT_MS = 10 * 60 * 1000;
export const ROBO_PICKUP_STALE_REPLACE_MS = 15 * 60 * 1000;

export const ROBO_PICKUP_LOUNGE_GUIDE_LINES = [
  'いつでも入れる常設の部屋です',
  'いくつ見つけてもOK',
  'いつやめてもいい',
  '疲れたら休んでね',
  'みんなで全部見つけたら結果が出ます',
  '全部見つけたら、自動で次のお題を準備します',
  '10分新しいことばが誰も見つけないと、ヒントボタンが出ます',
  '15分新しいことばが誰も見つけないと、新しいお題に差し替えます',
  'みんなで協力して遊ぶ場所です',
] as const;

export function isRoboPickupEmojiLoungeRoomId(roomId: string | null | undefined): boolean {
  return (roomId || '').trim() === ROBO_PICKUP_EMOJI_LOUNGE_ROOM_ID;
}

export function isRoboPickupLoungeRoomId(roomId: string | null | undefined): boolean {
  const id = (roomId || '').trim();
  return id === ROBO_PICKUP_LOUNGE_ROOM_ID || id === ROBO_PICKUP_EMOJI_LOUNGE_ROOM_ID;
}

export function isRoboPickupLoungeRecruit(
  item: { roboPickupLounge?: boolean; roomId?: string } | null | undefined,
): boolean {
  if (!item) return false;
  if (item.roboPickupLounge === true) return true;
  return isRoboPickupLoungeRoomId(item.roomId);
}

export function roboPickupLoungeTitleForRoom(roomId: string | null | undefined): string {
  return isRoboPickupEmojiLoungeRoomId(roomId)
    ? ROBO_PICKUP_EMOJI_LOUNGE_TITLE
    : ROBO_PICKUP_LOUNGE_TITLE;
}

export function roboPickupLoungeHostEmojiForRoom(roomId: string | null | undefined): string {
  return isRoboPickupEmojiLoungeRoomId(roomId) ? EMOJI_ROBO_EMOJI : RAKUDA_ROBO_EMOJI;
}

export function roboPickupLoungeHostNameForRoom(roomId: string | null | undefined): string {
  return isRoboPickupEmojiLoungeRoomId(roomId) ? EMOJI_ROBO_NAME : RAKUDA_ROBO_NAME;
}

export type RoboPickupLoungeProfile = {
  roomId: string;
  publicId: string;
  hostUid: string;
  hostNickname: string;
  hostEmoji: string;
  forcedCharset: 'hiragana' | 'emoji' | null;
};

export const RAKUDA_ROBO_PICKUP_LOUNGE_PROFILE: RoboPickupLoungeProfile = {
  roomId: ROBO_PICKUP_LOUNGE_ROOM_ID,
  publicId: ROBO_PICKUP_LOUNGE_PUBLIC_ID,
  hostUid: ROBO_PICKUP_LOUNGE_HOST_UID,
  hostNickname: RAKUDA_ROBO_NAME,
  hostEmoji: RAKUDA_ROBO_EMOJI,
  forcedCharset: null,
};

export const EMOJI_ROBO_PICKUP_LOUNGE_PROFILE: RoboPickupLoungeProfile = {
  roomId: ROBO_PICKUP_EMOJI_LOUNGE_ROOM_ID,
  publicId: ROBO_PICKUP_EMOJI_LOUNGE_PUBLIC_ID,
  hostUid: ROBO_PICKUP_EMOJI_LOUNGE_HOST_UID,
  hostNickname: EMOJI_ROBO_NAME,
  hostEmoji: EMOJI_ROBO_EMOJI,
  forcedCharset: 'emoji',
};

export function resolveRoboPickupLoungeProfile(roomId?: string | null): RoboPickupLoungeProfile {
  if (isRoboPickupEmojiLoungeRoomId(roomId)) return EMOJI_ROBO_PICKUP_LOUNGE_PROFILE;
  return RAKUDA_ROBO_PICKUP_LOUNGE_PROFILE;
}
