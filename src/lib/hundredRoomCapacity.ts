import { RAKUDA_CANONICAL_ORIGIN, RAKUDA_HUNDRED_CREATE_FRAGMENT, appendRakudaProfileQuery } from './sanjuuWebOrigin';

/** ひと言探し・みんなであそぶ：1部屋の同時参加上限（盤面・Firebase・体験のバランス） */
export const HUNDRED_MAX_PLAYERS = 20;

export const HUNDRED_ROOM_FULL_ERROR = 'hundred-room-full';

export function isHundredRoomAtCapacity(playerCount: number | undefined): boolean {
  return typeof playerCount === 'number' && playerCount >= HUNDRED_MAX_PLAYERS;
}

/** `https://rakuda.coffee/hundred#rk-hundred-create`（プロフィールクエリ付き可） */
export function rakudaHundredCreateUrlWithRakudaProfile(opts: {
  emoji?: string;
  nickname?: string;
}): string {
  const u = new URL(`${RAKUDA_CANONICAL_ORIGIN.replace(/\/+$/, '')}/hundred`);
  appendRakudaProfileQuery(u, opts);
  u.hash = RAKUDA_HUNDRED_CREATE_FRAGMENT;
  return u.toString();
}
