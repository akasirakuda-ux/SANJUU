import type { Unsubscribe } from 'firebase/firestore';
import type { Message } from '../components/Renrakucho/types';
import { buildBoardGameRecruitShareUrl, type BoardGameRecruitKind } from './boardGameRenrakuRecruit';
import { subscribeOpenGomokuRooms, type GomokuRoomDoc } from './gomokuRooms';
import {
  collectOpenBoardGameRecruitKeys,
  isRenrakuRecruitPastTtl,
  shouldShowRenrakuRecruitOnBoard,
} from './renrakuRecruitVisibility';
import { subscribeOpenReversiRooms, type ReversiRoomDoc } from './reversiRooms';

function boardGameRecruitMessage(
  kind: BoardGameRecruitKind,
  room: { roomCode: string; host: { uid: string; name: string }; createdAt?: unknown; recruitComment?: string },
): Message {
  const code = room.roomCode.trim().toUpperCase();
  const label = kind === 'reversi' ? 'リバーシ' : '五目並べ';
  let message = `【募集】${label}で一緒に遊びませんか？\n締め切り：5分以内`;
  const comment = room.recruitComment?.trim();
  if (comment) message += `\n${comment}`;

  return {
    id: `${kind}-open-${code}`,
    message,
    fromUser: room.host.name,
    fromUserUid: room.host.uid,
    createdAt: room.createdAt,
    type: 'recruit',
    roomInfo: {
      category: label,
      difficulty: '',
      url: buildBoardGameRecruitShareUrl(kind, code),
      game: kind,
      roomCode: code,
    },
  };
}

function waitingHostRecruitMessages(
  kind: BoardGameRecruitKind,
  rooms: Array<GomokuRoomDoc | ReversiRoomDoc>,
): Message[] {
  return rooms
    .filter((room) => room.status === 'waiting' && !room.guest?.uid)
    .map((room) => boardGameRecruitMessage(kind, room));
}

/** 募集中のリバーシ・五目並べ待機ルーム → 掲示板募集カード用 Message */
export function subscribeBoardGameOpenRecruitMessages(
  onChange: (messages: Message[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  let gomokuRooms: GomokuRoomDoc[] = [];
  let reversiRooms: ReversiRoomDoc[] = [];

  const emit = () => {
    const messages = [
      ...waitingHostRecruitMessages('gomoku', gomokuRooms),
      ...waitingHostRecruitMessages('reversi', reversiRooms),
    ];
    onChange(messages);
  };

  const unsubGomoku = subscribeOpenGomokuRooms(
    (rooms) => {
      gomokuRooms = rooms;
      emit();
    },
    onError,
  );
  const unsubReversi = subscribeOpenReversiRooms(
    (rooms) => {
      reversiRooms = rooms;
      emit();
    },
    onError,
  );

  return () => {
    unsubGomoku();
    unsubReversi();
  };
}

export function mergeBoardGameRecruitMessages(
  renrakuRecruits: Message[],
  liveBoardGameRecruits: Message[],
  nowMs: number = Date.now(),
): Message[] {
  const openBoardGameKeys = collectOpenBoardGameRecruitKeys(liveBoardGameRecruits);
  const byKey = new Map<string, Message>();

  for (const msg of renrakuRecruits) {
    if (!shouldShowRenrakuRecruitOnBoard(msg, nowMs, openBoardGameKeys)) continue;
    const game = msg.roomInfo?.game;
    const code = msg.roomInfo?.roomCode?.trim().toUpperCase();
    const key = game && code ? `bg:${game}:${code}` : `renraku:${msg.id}`;
    byKey.set(key, msg);
  }

  for (const msg of liveBoardGameRecruits) {
    if (isRenrakuRecruitPastTtl(msg, nowMs)) continue;
    const game = msg.roomInfo?.game;
    const code = msg.roomInfo?.roomCode?.trim().toUpperCase();
    if (!game || !code) continue;
    byKey.set(`bg:${game}:${code}`, msg);
  }

  return [...byKey.values()];
}
