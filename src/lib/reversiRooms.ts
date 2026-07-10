import {
  collection,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  applyOthelloMove,
  createReversiBoard,
  deserializeOthelloBoard,
  getOthelloWinner,
  getValidOthelloMoves,
  isOthelloGameOver,
  isValidOthelloMove,
  opponent,
  serializeOthelloBoard,
  type OthelloColor,
  type OthelloWinner,
} from './othelloLogic';
import type {
  ReversiOnlineStartMode,
  ReversiRoomSettings,
} from './reversiConfig';
import {
  REVERSI_ONLINE_TURN_TOTAL_MS,
  normalizeReversiOnlineStartMode,
  normalizeReversiRecruitComment,
  reversiHandicapLogLabelJa,
  reversiOnlineStartModeLabelJa,
} from './reversiConfig';
import { firestoreLikeToMillis } from './firestoreTime';

export type ReversiRoomStatus = 'waiting' | 'side_pick' | 'side_reveal' | 'playing' | 'finished';

export type ReversiSidePickMethod = 'coin';

export type ReversiEndReason = 'normal' | 'abandoned' | 'timeout';

/** 一手戻し用 — 着手前の盤面 */
export interface ReversiBoardSnapshot {
  board: string;
  turn: OthelloColor;
}

const REVERSI_BOARD_HISTORY_MAX = 120;

/** 終局後に相手へ送る固定メッセージ */
export const REVERSI_MATCH_THANKS_TEXT = 'ありがとうございました';

export function reversiOpponentPlayer(
  room: ReversiRoomDoc,
  myUid: string,
): ReversiRoomPlayer | null {
  if (!room.guest) return null;
  if (room.host.uid === myUid) return room.guest;
  if (room.guest.uid === myUid) return room.host;
  const otherUid = room.blackUid === myUid ? room.whiteUid : room.whiteUid === myUid ? room.blackUid : null;
  if (!otherUid) return null;
  if (room.host.uid === otherUid) return room.host;
  if (room.guest.uid === otherUid) return room.guest;
  return null;
}

export interface ReversiRoomPlayer {
  uid: string;
  name: string;
  emoji: string;
}

/** ルーム作成時に添付するホストの対戦記録スナップショット */
export interface ReversiHostRecord {
  wins: number;
  losses: number;
  draws: number;
  onlineWins: number;
  onlineLosses: number;
  onlineDraws: number;
}

export interface ReversiRoomDoc {
  roomCode: string;
  status: ReversiRoomStatus;
  host: ReversiRoomPlayer;
  guest?: ReversiRoomPlayer;
  settings: ReversiRoomSettings;
  /** ルーム作成時点のホスト戦績（ゲストの選択参考） */
  hostRecord?: ReversiHostRecord;
  /** 募集時に選んだ先後の決め方 */
  onlineStartMode: ReversiOnlineStartMode;
  /** ホストの募集コメント（任意） */
  recruitComment?: string;
  /** 先後決定の方法（コイン時） */
  sidePickMethod?: ReversiSidePickMethod;
  /** 先後決定アニメーション中（双方同期用） */
  sidePickAnimMethod?: ReversiSidePickMethod;
  board: string;
  turn: OthelloColor;
  blackUid: string;
  whiteUid: string;
  winner?: OthelloWinner;
  /** 終了理由（通常終局 / 中断 / 時間切れ） */
  endReason?: ReversiEndReason;
  /** 中断した uid（endReason === 'abandoned'） */
  endedBy?: string;
  /** 終局後の再戦 — 準備完了した uid 一覧（両者揃ったら新局開始） */
  rematchReady?: string[];
  /** 着手前の盤面履歴（末尾が直前） */
  boardHistory?: ReversiBoardSnapshot[];
  /** 一手戻し通知 — 相手ポップアップ用 */
  undoSeq?: number;
  lastUndoBy?: string;
  /** 終局後のお礼（uid → 送信済み）— 相手にトースト表示 */
  thanksByUid?: Record<string, boolean>;
  lastMoveAt?: unknown;
  createdAt?: unknown;
}

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createReversiRoom(
  host: ReversiRoomPlayer,
  settings: ReversiRoomSettings,
  hostRecord?: ReversiHostRecord,
  onlineStartMode: ReversiOnlineStartMode = 'default_black',
  recruitComment?: string,
): Promise<string> {
  const roomCode = randomRoomCode();
  const roomId = roomCode;
  const comment = recruitComment ? normalizeReversiRecruitComment(recruitComment) : '';

  const payload: ReversiRoomDoc = {
    roomCode,
    status: 'waiting',
    host,
    settings,
    ...(hostRecord ? { hostRecord } : {}),
    ...(comment ? { recruitComment: comment } : {}),
    onlineStartMode,
    board: serializeOthelloBoard(createReversiBoard()),
    turn: 'black',
    blackUid: '',
    whiteUid: '',
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'reversi_rooms', roomId), payload);
  return roomCode;
}

/** ゲスト参加と同時に対局開始（ホスト・ゲストの操作タイミングを揃えない） */
function guestJoinStartPlayingUpdate(
  cur: ReversiRoomDoc,
  guest: ReversiRoomPlayer,
  startMode: ReversiOnlineStartMode,
): Record<string, unknown> {
  const playingBase = {
    guest,
    status: 'playing' as const,
    boardHistory: [] as ReversiBoardSnapshot[],
    lastMoveAt: serverTimestamp(),
  };

  if (startMode === 'default_black') {
    const board = createReversiBoard({
      handicapCorners: cur.settings.handicapCorners,
      handicapBeneficiary: 'white',
    });
    return {
      ...playingBase,
      blackUid: cur.host.uid,
      whiteUid: guest.uid,
      board: serializeOthelloBoard(board),
      turn: 'black',
    };
  }

  if (startMode === 'guest_black') {
    const board = createReversiBoard({
      handicapCorners: cur.settings.handicapCorners,
      handicapBeneficiary: 'white',
    });
    return {
      ...playingBase,
      blackUid: guest.uid,
      whiteUid: cur.host.uid,
      board: serializeOthelloBoard(board),
      turn: 'black',
    };
  }

  const hostIsBlack = Math.random() < 0.5;
  const guestColor: OthelloColor = hostIsBlack ? 'white' : 'black';
  const board = createReversiBoard({
    handicapCorners: cur.settings.handicapCorners,
    handicapBeneficiary: guestColor,
  });
  return {
    ...playingBase,
    blackUid: hostIsBlack ? cur.host.uid : guest.uid,
    whiteUid: hostIsBlack ? guest.uid : cur.host.uid,
    board: serializeOthelloBoard(board),
    turn: 'black',
    sidePickMethod: 'coin' as ReversiSidePickMethod,
  };
}

export async function joinReversiRoom(
  roomCode: string,
  guest: ReversiRoomPlayer,
): Promise<'ok' | 'not_found' | 'full' | 'self'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return 'not_found';

  const data = snap.data() as ReversiRoomDoc;
  if (data.host.uid === guest.uid) return 'self';
  if (data.guest?.uid || data.status !== 'waiting') return 'full';

  try {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('room gone');
      const cur = fresh.data() as ReversiRoomDoc;
      if (cur.guest?.uid || cur.status !== 'waiting') throw new Error('room full');

      const startMode = normalizeReversiOnlineStartMode(cur.onlineStartMode);
      tx.update(ref, guestJoinStartPlayingUpdate(cur, guest, startMode));
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'room gone') return 'not_found';
    if (msg === 'room full') return 'full';
    return 'full';
  }
}

/** ホストがコイン開始 — 双方にアニメーションを同期 */
export async function signalReversiSidePickAnim(
  roomCode: string,
  uid: string,
  method: ReversiSidePickMethod,
): Promise<'ok' | 'forbidden' | 'not_ready' | 'not_found'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('not_found');
      const cur = fresh.data() as ReversiRoomDoc;
      if (cur.status !== 'side_pick') throw new Error('not_ready');
      if (cur.host.uid !== uid) throw new Error('forbidden');
      if (!cur.guest) throw new Error('not_ready');
      tx.update(ref, { sidePickAnimMethod: method });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    if (msg === 'not_ready') return 'not_ready';
    return 'not_found';
  }
}

/** 先後を決定 — 結果表示フェーズ（side_reveal）へ */
export async function commitReversiSidePick(
  roomCode: string,
  uid: string,
  method: ReversiSidePickMethod,
): Promise<
  | { ok: true; hostColor: OthelloColor }
  | { ok: false; reason: 'forbidden' | 'not_ready' | 'not_found' }
> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    let hostColor: OthelloColor = 'black';
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('not_found');
      const cur = fresh.data() as ReversiRoomDoc;
      if (cur.status !== 'side_pick') throw new Error('not_ready');
      if (cur.host.uid !== uid) throw new Error('forbidden');
      if (!cur.guest) throw new Error('not_ready');

      const hostIsBlack = Math.random() < 0.5;
      hostColor = hostIsBlack ? 'black' : 'white';
      const blackUid = hostIsBlack ? cur.host.uid : cur.guest.uid;
      const whiteUid = hostIsBlack ? cur.guest.uid : cur.host.uid;
      const guestColor: OthelloColor = hostIsBlack ? 'white' : 'black';
      const board = createReversiBoard({
        handicapCorners: cur.settings.handicapCorners,
        handicapBeneficiary: guestColor,
      });

      tx.update(ref, {
        status: 'side_reveal',
        blackUid,
        whiteUid,
        board: serializeOthelloBoard(board),
        turn: 'black',
        sidePickMethod: method,
        sidePickAnimMethod: deleteField(),
      });
    });
    return { ok: true, hostColor };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return { ok: false, reason: 'forbidden' };
    if (msg === 'not_ready') return { ok: false, reason: 'not_ready' };
    return { ok: false, reason: 'not_found' };
  }
}

/** 結果表示後 — 対局開始（ホスト・ゲストどちらでも可） */
export async function beginReversiRoomPlay(
  roomCode: string,
  uid: string,
): Promise<'ok' | 'forbidden' | 'not_ready' | 'not_found'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) throw new Error('not_found');
      const cur = fresh.data() as ReversiRoomDoc;
      if (cur.status === 'playing') return;
      if (cur.status !== 'side_reveal') throw new Error('not_ready');
      const isMember = cur.host.uid === uid || cur.guest?.uid === uid;
      if (!isMember) throw new Error('forbidden');
      tx.update(ref, {
        status: 'playing',
        boardHistory: [],
        undoSeq: deleteField(),
        lastUndoBy: deleteField(),
        lastMoveAt: serverTimestamp(),
      });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    if (msg === 'not_ready') return 'not_ready';
    return 'not_found';
  }
}

export function subscribeReversiRoom(
  roomCode: string,
  onChange: (room: ReversiRoomDoc | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'reversi_rooms', roomCode.toUpperCase()),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(snap.data() as ReversiRoomDoc);
    },
    (err) => onError?.(err),
  );
}

const OPEN_ROOM_MAX_AGE_MS = 45 * 60 * 1000;
const OPEN_ROOM_LIST_LIMIT = 24;

/** 募集中（waiting）ルーム一覧 — ゲストが選んで参加する用 */
export function subscribeOpenReversiRooms(
  onChange: (rooms: ReversiRoomDoc[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'reversi_rooms'),
    where('status', '==', 'waiting'),
    limit(OPEN_ROOM_LIST_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const rooms = snap.docs
        .map((d) => d.data() as ReversiRoomDoc)
        .filter((room) => {
          const createdMs = firestoreLikeToMillis(room.createdAt);
          if (createdMs == null) return true;
          return now - createdMs < OPEN_ROOM_MAX_AGE_MS;
        })
        .sort((a, b) => {
          const am = firestoreLikeToMillis(a.createdAt) ?? 0;
          const bm = firestoreLikeToMillis(b.createdAt) ?? 0;
          return bm - am;
        });
      onChange(rooms);
    },
    (err) => onError?.(err),
  );
}

export function reversiHostRecordSummaryJa(record: ReversiHostRecord | undefined): string {
  if (!record) return '戦績不明';
  const { wins, losses, draws, onlineWins, onlineLosses, onlineDraws } = record;
  const allTotal = wins + losses + draws;
  const onlineTotal = onlineWins + onlineLosses + onlineDraws;
  if (allTotal === 0) return '記録なし';
  if (onlineTotal === 0) return `全体 ${wins}勝${losses}敗${draws > 0 ? `${draws}分` : ''}（オンライン未プレイ）`;
  return `全体 ${wins}勝${losses}敗 · オンライン ${onlineWins}勝${onlineLosses}敗`;
}

export function reversiHostStrengthHintJa(record: ReversiHostRecord | undefined): string {
  if (!record) return '';
  const onlineTotal = record.onlineWins + record.onlineLosses + record.onlineDraws;
  if (onlineTotal === 0) {
    const all = record.wins + record.losses + record.draws;
    if (all === 0) return 'はじめての方かも';
    return 'オンラインは未記録';
  }
  if (onlineTotal < 3) return 'オンライン少なめ';
  const rate = record.onlineWins / onlineTotal;
  if (rate >= 0.65) return 'やや強め';
  if (rate <= 0.35) return 'ゆったり';
  return '普通';
}

export function reversiOpenRoomRulesJa(room: ReversiRoomDoc): string {
  const handicap = reversiHandicapLogLabelJa(room.settings.handicapCorners);
  return `${handicap} · ${reversiOnlineStartModeLabelJa(room.onlineStartMode)} · 一手戻し可`;
}

export function reversiWaitingAgeJa(createdAt: unknown, nowMs = Date.now()): string {
  const createdMs = firestoreLikeToMillis(createdAt);
  if (createdMs == null) return 'たった今';
  const sec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
  if (sec < 60) return 'たった今';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

export async function submitReversiRoomMove(
  roomCode: string,
  uid: string,
  row: number,
  col: number,
): Promise<'ok' | 'forbidden' | 'invalid'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('missing');
      const room = snap.data() as ReversiRoomDoc;
      if (room.status !== 'playing') throw new Error('not playing');

      const myColor: OthelloColor | null =
        room.blackUid === uid ? 'black' : room.whiteUid === uid ? 'white' : null;
      if (!myColor || room.turn !== myColor) throw new Error('forbidden');

      const board = deserializeOthelloBoard(room.board);
      if (!isValidOthelloMove(board, row, col, myColor)) throw new Error('invalid');

      const history = [...(room.boardHistory ?? []), { board: room.board, turn: room.turn }];
      if (history.length > REVERSI_BOARD_HISTORY_MAX) {
        history.splice(0, history.length - REVERSI_BOARD_HISTORY_MAX);
      }

      const { board: nextBoard } = applyOthelloMove(board, row, col, myColor);
      let nextTurn = opponent(myColor);
      let status: ReversiRoomStatus = 'playing';
      let winner: OthelloWinner | undefined;

      const oppMoves = getValidOthelloMoves(nextBoard, nextTurn);
      if (oppMoves.length === 0) {
        const passTurn = opponent(nextTurn);
        const passMoves = getValidOthelloMoves(nextBoard, passTurn);
        if (passMoves.length === 0) {
          winner = getOthelloWinner(nextBoard) ?? 'draw';
          status = 'finished';
        } else {
          nextTurn = passTurn;
        }
      }

      if (winner == null && isOthelloGameOver(nextBoard)) {
        winner = getOthelloWinner(nextBoard) ?? 'draw';
        status = 'finished';
      }

      tx.update(ref, {
        board: serializeOthelloBoard(nextBoard),
        turn: nextTurn,
        status,
        boardHistory: history,
        ...(winner != null ? { winner, endReason: 'normal' as const } : {}),
        lastMoveAt: serverTimestamp(),
      });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    return 'invalid';
  }
}

/** 一手戻す — 双方の盤面を同期し、相手に undoSeq を通知 */
export async function undoReversiRoomMove(
  roomCode: string,
  uid: string,
): Promise<'ok' | 'forbidden' | 'nothing' | 'not_playing'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('missing');
      const room = snap.data() as ReversiRoomDoc;

      const isMember =
        room.host.uid === uid ||
        room.guest?.uid === uid ||
        room.blackUid === uid ||
        room.whiteUid === uid;
      if (!isMember) throw new Error('forbidden');

      const canUndoBoard =
        room.status === 'playing' ||
        (room.status === 'finished' && room.endReason === 'normal');
      if (!canUndoBoard) throw new Error('not_playing');

      const history = [...(room.boardHistory ?? [])];
      if (history.length === 0) throw new Error('nothing');

      const prev = history.pop()!;
      const undoSeq = (room.undoSeq ?? 0) + 1;

      tx.update(ref, {
        status: 'playing',
        board: prev.board,
        turn: prev.turn,
        boardHistory: history,
        undoSeq,
        lastUndoBy: uid,
        thanksByUid: deleteField(),
        winner: deleteField(),
        endReason: deleteField(),
        endedBy: deleteField(),
        lastMoveAt: serverTimestamp(),
      });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    if (msg === 'nothing') return 'nothing';
    if (msg === 'not_playing') return 'not_playing';
    return 'nothing';
  }
}

export function colorForReversiUid(room: ReversiRoomDoc, uid: string | null): OthelloColor | null {
  if (!uid) return null;
  if (room.blackUid === uid) return 'black';
  if (room.whiteUid === uid) return 'white';
  return null;
}

function buildRematchBoard(room: ReversiRoomDoc): string {
  if (!room.guest) throw new Error('no guest');
  const guestColor: OthelloColor =
    room.guest.uid === room.blackUid ? 'black' : 'white';
  return serializeOthelloBoard(
    createReversiBoard({
      handicapCorners: room.settings.handicapCorners,
      handicapBeneficiary: guestColor,
    }),
  );
}

/** 終局後のお礼 — 勝敗問わず1回（相手にトースト） */
export async function sendReversiMatchThanks(
  roomCode: string,
  uid: string,
): Promise<'ok' | 'forbidden' | 'not_finished' | 'already'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('missing');
      const room = snap.data() as ReversiRoomDoc;
      if (room.status !== 'finished') throw new Error('not_finished');
      if (!room.guest) throw new Error('forbidden');
      if (room.blackUid !== uid && room.whiteUid !== uid) throw new Error('forbidden');
      if (room.thanksByUid?.[uid]) throw new Error('already');

      tx.update(ref, {
        thanksByUid: { ...(room.thanksByUid ?? {}), [uid]: true },
      });
    });
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'not_finished') return 'not_finished';
    if (msg === 'already') return 'already';
    return 'forbidden';
  }
}

/** 終局後の同ルーム再戦。両者が押すと新局を開始する */
export async function requestReversiRematch(
  roomCode: string,
  uid: string,
): Promise<'started' | 'waiting' | 'forbidden' | 'not_finished'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    let outcome: 'started' | 'waiting' = 'waiting';
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('missing');
      const room = snap.data() as ReversiRoomDoc;
      if (room.status !== 'finished') throw new Error('not_finished');
      if (!room.guest) throw new Error('forbidden');
      if (room.blackUid !== uid && room.whiteUid !== uid) throw new Error('forbidden');

      const ready = new Set(room.rematchReady ?? []);
      ready.add(uid);

      if (ready.has(room.blackUid) && ready.has(room.whiteUid)) {
        tx.update(ref, {
          status: 'playing',
          board: buildRematchBoard(room),
          turn: 'black',
          winner: deleteField(),
          endReason: deleteField(),
          endedBy: deleteField(),
          rematchReady: deleteField(),
          boardHistory: [],
          undoSeq: deleteField(),
          lastUndoBy: deleteField(),
          lastMoveAt: serverTimestamp(),
        });
        outcome = 'started';
      } else {
        tx.update(ref, { rematchReady: Array.from(ready) });
      }
    });
    return outcome;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'not_finished') return 'not_finished';
    return 'forbidden';
  }
}

/** 自発中断・ロビー離脱 — 相手に通知してルームを終了または削除 */
export async function abandonReversiRoom(
  roomCode: string,
  uid: string,
): Promise<'ok' | 'forbidden' | 'not_found'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    let outcome: 'ok' | 'not_found' = 'not_found';
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as ReversiRoomDoc;
      const isMember =
        room.host.uid === uid ||
        room.guest?.uid === uid ||
        room.blackUid === uid ||
        room.whiteUid === uid;
      if (!isMember) throw new Error('forbidden');

      if (room.status === 'waiting' && room.host.uid === uid) {
        tx.delete(ref);
        outcome = 'ok';
        return;
      }

      if (room.status === 'side_pick' || room.status === 'side_reveal' || room.status === 'playing') {
        tx.update(ref, {
          status: 'finished',
          endReason: 'abandoned',
          endedBy: uid,
          winner: deleteField(),
          rematchReady: deleteField(),
        });
        outcome = 'ok';
        return;
      }

      if (room.status === 'finished') {
        const ready = (room.rematchReady ?? []).filter((id) => id !== uid);
        tx.update(ref, {
          rematchReady: ready.length > 0 ? ready : deleteField(),
        });
        outcome = 'ok';
      }
    });
    return outcome;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'forbidden') return 'forbidden';
    return 'not_found';
  }
}

/** 手番4分超 — 時間切れで終了（先着1クライアントが確定） */
export async function finalizeReversiTurnTimeout(
  roomCode: string,
): Promise<'ok' | 'ignored'> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());

  try {
    let applied = false;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('missing');
      const room = snap.data() as ReversiRoomDoc;
      if (room.status !== 'playing') throw new Error('ignored');

      const lastMs = firestoreLikeToMillis(room.lastMoveAt);
      if (lastMs == null) throw new Error('ignored');
      if (Date.now() - lastMs < REVERSI_ONLINE_TURN_TOTAL_MS) throw new Error('ignored');

      tx.update(ref, {
        status: 'finished',
        endReason: 'timeout',
        endedBy: deleteField(),
        winner: deleteField(),
        rematchReady: deleteField(),
      });
      applied = true;
    });
    return applied ? 'ok' : 'ignored';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'ignored') return 'ignored';
    return 'ignored';
  }
}

/** メニュー離脱など — 再戦待ちの投票を取り消す */
export async function clearReversiRematchVote(roomCode: string, uid: string): Promise<void> {
  const ref = doc(db, 'reversi_rooms', roomCode.toUpperCase());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const room = snap.data() as ReversiRoomDoc;
      if (room.status !== 'finished') return;
      const ready = (room.rematchReady ?? []).filter((id) => id !== uid);
      if (ready.length === (room.rematchReady ?? []).length) return;
      tx.update(ref, {
        rematchReady: ready.length > 0 ? ready : deleteField(),
      });
    });
  } catch {
    // ignore — 離脱時のベストエフォート
  }
}
