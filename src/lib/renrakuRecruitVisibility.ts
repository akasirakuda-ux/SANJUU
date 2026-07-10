import type { Message } from '../components/Renrakucho/types';
import { firestoreLikeToMillis, RENRAKU_RECRUIT_TTL_MS } from './rakudaHubShell';

export function boardGameRecruitKey(game: string, roomCode: string): string {
  return `bg:${game}:${roomCode.trim().toUpperCase()}`;
}

export function collectOpenBoardGameRecruitKeys(messages: Message[]): Set<string> {
  const keys = new Set<string>();
  for (const msg of messages) {
    const game = msg.roomInfo?.game;
    const code = msg.roomInfo?.roomCode?.trim().toUpperCase();
    if (game && code) keys.add(boardGameRecruitKey(game, code));
  }
  return keys;
}

export function isRenrakuRecruitPastTtl(msg: Message, nowMs: number): boolean {
  const createdMs = firestoreLikeToMillis(msg.createdAt);
  if (createdMs == null) return false;
  return nowMs > createdMs + RENRAKU_RECRUIT_TTL_MS;
}

export function isBoardGameRecruitMessage(msg: Message): boolean {
  const game = msg.roomInfo?.game;
  return game === 'reversi' || game === 'gomoku';
}

/** ことば探しのオンライン募集（掲示板・5分TTLの対象外） */
export function isKotobaRecruitMessage(msg: Message): boolean {
  if (isBoardGameRecruitMessage(msg)) return false;
  const url = msg.roomInfo?.url;
  if (!url) return false;
  try {
    return !!new URL(url).searchParams.get('room');
  } catch {
    return false;
  }
}

/** 掲示板タイムラインに載せる renraku_public 募集か（期限切れ・対局終了は載せない） */
export function shouldShowRenrakuRecruitOnBoard(
  msg: Message,
  nowMs: number,
  openBoardGameKeys: Set<string>,
): boolean {
  if (!isKotobaRecruitMessage(msg) && isRenrakuRecruitPastTtl(msg, nowMs)) return false;
  if (!isBoardGameRecruitMessage(msg)) return true;
  const game = msg.roomInfo?.game;
  const code = msg.roomInfo?.roomCode?.trim().toUpperCase();
  if (!game || !code) return false;
  return openBoardGameKeys.has(boardGameRecruitKey(game, code));
}
