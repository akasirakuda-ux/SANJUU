import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getPublicUrl } from '../constants';
import { db } from '../firebase';
import { RENRAKU_STATUS_ACTIVE } from './rakudaHubShell';

export type BoardGameRecruitKind = 'reversi' | 'gomoku';

const RECRUIT_ID_KEY: Record<BoardGameRecruitKind, string> = {
  reversi: 'rk_reversi_renraku_recruit_id_v1',
  gomoku: 'rk_gomoku_renraku_recruit_id_v1',
};

const PENDING_JOIN_KEY: Record<BoardGameRecruitKind, string> = {
  reversi: 'rk_pending_join_reversi_v1',
  gomoku: 'rk_pending_join_gomoku_v1',
};

const ROOM_COLLECTION: Record<BoardGameRecruitKind, string> = {
  reversi: 'reversi_rooms',
  gomoku: 'gomoku_rooms',
};

const URL_PARAM: Record<BoardGameRecruitKind, string> = {
  reversi: 'reversi',
  gomoku: 'gomoku',
};

const GAME_LABEL: Record<BoardGameRecruitKind, string> = {
  reversi: 'リバーシ',
  gomoku: '五目並べ',
};

export function buildBoardGameRecruitShareUrl(kind: BoardGameRecruitKind, roomCode: string): string {
  const code = roomCode.trim().toUpperCase();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const param = URL_PARAM[kind];
  return `${getPublicUrl()}${path}${path.endsWith('/') ? '' : '/'}?${param}=${code}`;
}

export function parseBoardGameRecruitFromUrl(url: string): { kind: BoardGameRecruitKind; roomCode: string } | null {
  try {
    const urlObj = new URL(url);
    for (const kind of ['reversi', 'gomoku'] as const) {
      const code = urlObj.searchParams.get(URL_PARAM[kind]);
      if (code?.trim()) {
        return { kind, roomCode: code.trim().toUpperCase() };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function boardGameRecruitRoomCollection(kind: BoardGameRecruitKind): string {
  return ROOM_COLLECTION[kind];
}

export function saveBoardGamePendingJoinRoomCode(kind: BoardGameRecruitKind, roomCode: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(PENDING_JOIN_KEY[kind], roomCode.trim().toUpperCase());
}

export function consumeBoardGamePendingJoinRoomCode(kind: BoardGameRecruitKind): string {
  if (typeof sessionStorage === 'undefined') return '';
  const code = sessionStorage.getItem(PENDING_JOIN_KEY[kind]) || '';
  if (code) sessionStorage.removeItem(PENDING_JOIN_KEY[kind]);
  return code;
}

function saveLocalRecruitMessageId(kind: BoardGameRecruitKind, docId: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (!docId) {
    sessionStorage.removeItem(RECRUIT_ID_KEY[kind]);
    return;
  }
  sessionStorage.setItem(RECRUIT_ID_KEY[kind], docId);
}

function loadLocalRecruitMessageId(kind: BoardGameRecruitKind): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(RECRUIT_ID_KEY[kind]);
}

function roomCodesMatch(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export async function publishBoardGameRenrakuRecruit(params: {
  kind: BoardGameRecruitKind;
  roomCode: string;
  nickname: string;
  uid: string;
  recruitComment?: string;
}): Promise<string> {
  const { kind, roomCode, nickname, uid, recruitComment } = params;
  const code = roomCode.trim().toUpperCase();
  const label = GAME_LABEL[kind];
  let message = `【募集】${label}で一緒に遊びませんか？\n締め切り：5分以内`;
  const comment = recruitComment?.trim();
  if (comment) message += `\n${comment}`;

  const docRef = await addDoc(collection(db, 'renraku_public'), {
    message,
    fromUser: nickname,
    fromUserUid: uid,
    createdAt: serverTimestamp(),
    status: RENRAKU_STATUS_ACTIVE,
    type: 'recruit',
    roomInfo: {
      category: label,
      difficulty: '',
      url: buildBoardGameRecruitShareUrl(kind, code),
      game: kind,
      roomCode: code,
    },
  });

  saveLocalRecruitMessageId(kind, docRef.id);
  try {
    await setDoc(doc(db, ROOM_COLLECTION[kind], code), { recruitMessageId: docRef.id }, { merge: true });
  } catch (e) {
    console.warn('[boardGameRenrakuRecruit] recruitMessageId merge failed', kind, code, e);
  }
  return docRef.id;
}

/** 待機中ホスト: 掲示板募集が無ければ1件だけ補完（作成直後の race や旧ルーム復帰用） */
export async function ensureBoardGameRenrakuRecruit(params: {
  kind: BoardGameRecruitKind;
  roomCode: string;
  nickname: string;
  uid: string;
  recruitComment?: string;
}): Promise<string | null> {
  const code = params.roomCode.trim().toUpperCase();
  const kind = params.kind;

  const localId = loadLocalRecruitMessageId(kind);
  if (localId) return localId;

  try {
    const roomSnap = await getDoc(doc(db, ROOM_COLLECTION[kind], code));
    if (!roomSnap.exists()) return null;
    const room = roomSnap.data() as {
      recruitMessageId?: string | null;
      status?: string;
      guest?: { uid?: string };
    };
    if (room.recruitMessageId) {
      saveLocalRecruitMessageId(kind, room.recruitMessageId);
      return room.recruitMessageId;
    }
    if (room.status !== 'waiting' || room.guest?.uid) return null;
  } catch {
    return null;
  }

  return publishBoardGameRenrakuRecruit(params);
}

export function shouldClearBoardGameRenrakuRecruit(
  roomCode: string,
  onlineRoom: { roomCode?: string; host: { uid: string }; status?: string; guest?: { uid?: string } } | null,
  hostUid: string,
): boolean {
  if (!roomCode || !onlineRoom) return false;
  if (!roomCodesMatch(onlineRoom.roomCode ?? '', roomCode)) return false;
  if (onlineRoom.host.uid !== hostUid) return false;
  if (onlineRoom.status === 'waiting' && !onlineRoom.guest?.uid) return false;
  return true;
}

export async function clearBoardGameRenrakuRecruit(
  kind: BoardGameRecruitKind,
  roomCode?: string,
): Promise<void> {
  let recruitMessageId = loadLocalRecruitMessageId(kind);

  if (!recruitMessageId && roomCode) {
    try {
      const snap = await getDoc(doc(db, ROOM_COLLECTION[kind], roomCode.trim().toUpperCase()));
      const data = snap.data() as { recruitMessageId?: string } | undefined;
      if (data?.recruitMessageId) recruitMessageId = data.recruitMessageId;
    } catch {
      /* ignore */
    }
  }

  if (recruitMessageId) {
    try {
      await deleteDoc(doc(db, 'renraku_public', recruitMessageId));
    } catch {
      /* ignore */
    }
  }

  saveLocalRecruitMessageId(kind, null);

  if (roomCode) {
    try {
      await setDoc(
        doc(db, ROOM_COLLECTION[kind], roomCode.trim().toUpperCase()),
        { recruitMessageId: null },
        { merge: true },
      );
    } catch {
      /* ignore */
    }
  }
}
