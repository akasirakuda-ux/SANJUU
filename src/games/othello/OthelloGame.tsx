import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  RotateCcw,
  Settings2,
  Sparkles,
  Swords,
  Undo2,
} from 'lucide-react';
import type { LogEntry } from '../../types';
import {
  OTHELLO_CPU_DIFFICULTIES,
  OTHELLO_SIZE,
  applyOthelloMove,
  countOthelloDiscs,
  createReversiBoard,
  getOthelloWinner,
  getValidOthelloMoves,
  isOthelloGameOver,
  othelloColorLabelJa,
  othelloCpuDifficultyHintJa,
  othelloCpuDifficultyLabelJa,
  opponent,
  pickOthelloCpuMove,
  deserializeOthelloBoard,
  type OthelloCell,
  type OthelloColor,
  type OthelloCpuDifficulty,
  type OthelloWinner,
} from '../../lib/othelloLogic';
import {
  RAKUDA_ROBO_EMOJI,
  RAKUDA_ROBO_NAME,
  REVERSI_DEFAULT_ROOM_DEFAULTS,
  REVERSI_DEFAULT_LOCAL_VIEW_PREFS,
  REVERSI_BOARD_THEMES,
  getReversiBoardTheme,
  loadReversiRoomDefaults,
  saveReversiRoomDefaults,
  loadReversiLocalViewPrefs,
  saveReversiLocalViewPrefs,
  resolveReversiStoneVisual,
  reversiHandicapLogLabelJa,
  reversiOnlineStartModeLabelJa,
  reversiOnlineStartModeHintJa,
  normalizeReversiOnlineStartMode,
  isReversiPresetSideAssignMode,
  resolveReversiTurnPickColor,
  reversiTurnPickModeLabelJa,
  reversiTurnPickModeHintJa,
  REVERSI_ONLINE_TURN_FINAL_MS,
  REVERSI_ONLINE_TURN_IDLE_MS,
  REVERSI_ONLINE_TURN_TOTAL_MS,
  loadReversiPendingHostRoomCode,
  saveReversiPendingHostRoomCode,
  REVERSI_RECRUIT_BADGE_CLASS,
  REVERSI_RECRUIT_HOST_BADGE_CLASS,
  REVERSI_RECRUIT_COMMENT_MAX,
  normalizeReversiRecruitComment,
  type ReversiRoomDefaults,
  type ReversiRoomSettings,
  type ReversiOnlineStartMode,
  type ReversiLocalViewPrefs,
  type ReversiBoardThemeId,
  type ReversiStoneVisual,
} from '../../lib/reversiConfig';
import { boardGridColumnLabel, measureCoordGutter, type CoordGutterMetrics } from '../../lib/boardGridCoordinates';
import {
  clearBoardGameRenrakuRecruit,
  consumeBoardGamePendingJoinRoomCode,
  ensureBoardGameRenrakuRecruit,
  publishBoardGameRenrakuRecruit,
  shouldClearBoardGameRenrakuRecruit,
} from '../../lib/boardGameRenrakuRecruit';
import {
  colorForReversiUid,
  createReversiRoom,
  joinReversiRoom,
  requestReversiRematch,
  clearReversiRematchVote,
  abandonReversiRoom,
  beginReversiRoomPlay,
  commitReversiSidePick,
  finalizeReversiTurnTimeout,
  signalReversiSidePickAnim,
  subscribeReversiRoom,
  subscribeOpenReversiRooms,
  reversiHostRecordSummaryJa,
  reversiHostStrengthHintJa,
  reversiOpenRoomRulesJa,
  reversiWaitingAgeJa,
  submitReversiRoomMove,
  sendReversiMatchThanks,
  REVERSI_MATCH_THANKS_TEXT,
  reversiOpponentPlayer,
  type ReversiHostRecord,
  type ReversiRoomDoc,
} from '../../lib/reversiRooms';
import {
  RK02PrimaryTouchButton,
  RK03GhostTouchButton,
  RK05ImmersiveScreen,
  RK06ImmersiveHeader,
  RK15HubMenuRowHalfW,
} from '../../ui/baselineParts';
import { hubMenuBtnHalfWFill } from '../../ui/policy';
import { firestoreLikeToMillis } from '../../lib/firestoreTime';
import { vibrate } from '../../lib/utils';
import LiveClearReportSoloPanel from '../../components/LiveClearReportSoloPanel';
import { audioService } from '../../services/audioService';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';
import { markSocialPlayAdSessionActive } from '../../lib/socialPlayAdSession';

const CPU_DELAY_MS = 520;

/** 募集作成・ルーム一覧（150% から 3 割縮小 ≒ 105%） */
const REVERSI_ONLINE_UI_TEXT = 'text-[105%]';
/** 自分の設定 — 通常比 3 割大 */
const REVERSI_SETTINGS_UI_TEXT = 'text-[130%]';
const REVERSI_MENU_PRIMARY_BORDER = 'border border-rk-indigo-400/55';
const REVERSI_MENU_GHOST_BORDER = 'border border-rk-slate-300/80';
/** ゴースト行 — 横幅を 2 文字分狭く（中央寄せ） */
const REVERSI_MENU_GHOST_NARROW = 'w-[calc(100%-2ch)] mx-auto self-center';
/** オンライン1対1 と 自分の設定 の間だけ少し広げる */
const REVERSI_MENU_SETTINGS_TOP_GAP = 'mt-2';

const SIDE_PICK_ANIM_MS = 2200;
const SIDE_PICK_REVEAL_MS = 3000;

const REVERSI_THEME =
  'bg-gradient-to-b from-rk-success-100 via-rk-white to-rk-success-100 text-rk-slate-800';
const REVERSI_KICKER = 'text-rk-success-900/75';
const REVERSI_TITLE = 'text-rk-success-950 !text-[1.725em]';
const REVERSI_SUB = 'text-rk-success-900/70';

type ReversiView = 'menu' | 'my-settings' | 'logs' | 'cpu-difficulty' | 'online-lobby' | 'play';
type PlayKind = 'cpu' | 'online';

interface SideProfile {
  label: string;
  emoji: string;
}

interface OthelloGameProps {
  onBack: () => void;
  nickname: string;
  userEmoji: string;
  firebaseUser: { uid: string } | null;
  addLog: (
    type: LogEntry['type'],
    tag: string,
    message: string,
    details?: unknown,
    emoji?: string,
  ) => void;
  logs: LogEntry[];
  onGoogleLogin: () => void;
  /** 2分アーム済みの「自然な区切り」で全面広告（CPU ソロなど） */
  onInterstitialNaturalBreak?: () => Promise<void>;
  /** オンライン対戦をやめて席に戻る — セッション清算広告 */
  onSocialSessionEndInterstitial?: () => Promise<void>;
  /** 対局終了時のしゅっせき簿加算 */
  onRecordShussekiGamePlay?: () => number;
  /** 配信モード — 盤面座標レイヤ */
  streamMode?: boolean;
  /** 盤面の座標表示（配信モードと別） */
  coordOverlayEnabled?: boolean;
}

const OTHELLO_GRID_PAD_PX = 4;
const OTHELLO_GRID_GAP_PX = 2;

function othelloCellSize(boardPx: number): number {
  const inner = boardPx - OTHELLO_GRID_PAD_PX * 2;
  return (inner - OTHELLO_GRID_GAP_PX * (OTHELLO_SIZE - 1)) / OTHELLO_SIZE;
}

function measureOthelloBoardPx(
  area: number,
  showCoordLayer: boolean,
): { boardPx: number; gutter: CoordGutterMetrics } {
  const areaFloor = Math.floor(area);
  if (!showCoordLayer) {
    return { boardPx: areaFloor, gutter: { left: 0, top: 0, fontSize: 12 } };
  }
  let boardPx = areaFloor;
  let gutter = measureCoordGutter(othelloCellSize(boardPx));
  boardPx = Math.max(OTHELLO_SIZE * 8, areaFloor - Math.max(gutter.left, gutter.top));
  gutter = measureCoordGutter(othelloCellSize(boardPx));
  boardPx = Math.max(OTHELLO_SIZE * 8, areaFloor - Math.max(gutter.left, gutter.top));
  return { boardPx, gutter };
}

function winnerMessage(winner: OthelloWinner, black: number, white: number): string {
  if (winner === 'draw') return `引き分け（黒${black} · 白${white}）`;
  if (winner === 'black') return `黒の勝ち ${black}対${white}`;
  if (winner === 'white') return `白の勝ち ${white}対${black}`;
  return '';
}

function advanceTurnAfterMove(board: OthelloCell[][], color: OthelloColor): {
  turn: OthelloColor;
  passNotice: string | null;
} {
  const nextTurn = opponent(color);
  const nextMoves = getValidOthelloMoves(board, nextTurn);
  if (nextMoves.length > 0) {
    return { turn: nextTurn, passNotice: null };
  }
  const passTurn = opponent(nextTurn);
  const passMoves = getValidOthelloMoves(board, passTurn);
  if (passMoves.length > 0) {
    return {
      turn: passTurn,
      passNotice: `${othelloColorLabelJa(nextTurn)}は置けないのでパス`,
    };
  }
  return { turn: passTurn, passNotice: '両者パスで終了' };
}

type LocalPlaySnapshot = {
  board: OthelloCell[][];
  turn: OthelloColor;
  passNotice: string | null;
};

function cloneOthelloBoard(board: OthelloCell[][]): OthelloCell[][] {
  return board.map((row) => [...row]);
}

type OnlineSessionNotice =
  | 'opponent_left'
  | 'interrupted'
  | 'timeout';

function formatRemainingMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function computeOnlineTurnTimer(
  room: ReversiRoomDoc | null,
  nowMs: number,
): { phase: 'idle' } | { phase: 'final'; remainingMs: number } | { phase: 'expired' } | null {
  if (!room || room.status !== 'playing') return null;
  const lastMs = firestoreLikeToMillis(room.lastMoveAt);
  if (lastMs == null) return null;
  const elapsed = nowMs - lastMs;
  if (elapsed < REVERSI_ONLINE_TURN_IDLE_MS) return { phase: 'idle' };
  if (elapsed < REVERSI_ONLINE_TURN_TOTAL_MS) {
    return { phase: 'final', remainingMs: REVERSI_ONLINE_TURN_TOTAL_MS - elapsed };
  }
  return { phase: 'expired' };
}

function deriveOnlineSessionNotice(
  playKind: PlayKind,
  view: ReversiView,
  room: ReversiRoomDoc | null,
  roomCode: string,
  myUid: string | undefined,
): OnlineSessionNotice | null {
  if (playKind !== 'online' || !roomCode) return null;
  if (view !== 'play' && view !== 'online-lobby') return null;
  if (room == null) return view === 'play' ? 'opponent_left' : null;
  if (room.status !== 'finished') return null;
  if (room.endReason === 'abandoned' && room.endedBy !== myUid) return 'interrupted';
  if (room.endReason === 'timeout') return 'timeout';
  return null;
}

/** オンライン対局中 — 中断ボタンを出す（status 同期前もホスト/ゲストで揃える） */
function isOnlineActiveMatch(
  playKind: PlayKind,
  view: ReversiView,
  gameOver: boolean,
  room: ReversiRoomDoc | null,
  roomCode: string,
): boolean {
  if (playKind !== 'online' || view !== 'play' || gameOver || !roomCode) return false;
  if (room == null) return true;
  return room.status === 'playing' || room.status === 'waiting';
}

const OthelloGame: React.FC<OthelloGameProps> = ({
  onBack,
  nickname,
  userEmoji,
  firebaseUser,
  addLog,
  logs,
  onGoogleLogin,
  onInterstitialNaturalBreak,
  onSocialSessionEndInterstitial,
  onRecordShussekiGamePlay,
  streamMode = false,
  coordOverlayEnabled = false,
}) => {
  const showCoordLayer = streamMode || coordOverlayEnabled;
  const [view, setView] = useState<ReversiView>('menu');
  const [roomDefaults, setRoomDefaults] = useState<ReversiRoomDefaults>(() => loadReversiRoomDefaults());
  const [roomDraft, setRoomDraft] = useState<ReversiRoomDefaults>(() => loadReversiRoomDefaults());
  const [localViewPrefs, setLocalViewPrefs] = useState<ReversiLocalViewPrefs>(() =>
    loadReversiLocalViewPrefs(),
  );
  const [playKind, setPlayKind] = useState<PlayKind>('cpu');
  const [cpuDifficulty, setCpuDifficulty] = useState<OthelloCpuDifficulty>('normal');
  const [humanColor, setHumanColor] = useState<OthelloColor>('black');
  const [blackSide, setBlackSide] = useState<SideProfile>({ label: nickname, emoji: userEmoji });
  const [whiteSide, setWhiteSide] = useState<SideProfile>({
    label: RAKUDA_ROBO_NAME,
    emoji: RAKUDA_ROBO_EMOJI,
  });
  const [board, setBoard] = useState<OthelloCell[][]>(() => createReversiBoard());
  const [turn, setTurn] = useState<OthelloColor>('black');
  const [passNotice, setPassNotice] = useState<string | null>(null);
  const [lastFlips, setLastFlips] = useState<Set<string>>(new Set());
  const [cpuThinking, setCpuThinking] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [composingRecruit, setComposingRecruit] = useState(false);
  const [sidePickBusy, setSidePickBusy] = useState(false);
  const [onlineRoom, setOnlineRoom] = useState<ReversiRoomDoc | null>(null);
  const [openWaitingRooms, setOpenWaitingRooms] = useState<ReversiRoomDoc[]>([]);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [loggedOnce, setLoggedOnce] = useState(false);
  const [showInterruptConfirm, setShowInterruptConfirm] = useState(false);
  const [localCanUndo, setLocalCanUndo] = useState(false);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const cpuTimerRef = useRef<number | null>(null);
  const localHistoryRef = useRef<LocalPlaySnapshot[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const onlineStartBreakDoneRef = useRef(false);
  const coinAutoStartedRef = useRef<string | null>(null);
  const defaultRevealStartedRef = useRef<string | null>(null);
  const prevOnlineStatusRef = useRef<string | null>(null);
  const timeoutFinalizeSentRef = useRef(false);
  const didRecordShussekiRef = useRef(false);
  const matchThanksSentRef = useRef(false);
  const cpuMatchThanksDoneRef = useRef(false);
  const seenOpponentThanksRef = useRef<Set<string>>(new Set());
  const prevDiscCountRef = useRef<number | null>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(280);
  const [coordGutter, setCoordGutter] = useState<CoordGutterMetrics>({ left: 0, top: 0, fontSize: 12 });
  const boardTheme = useMemo(
    () => getReversiBoardTheme(localViewPrefs.boardThemeId),
    [localViewPrefs.boardThemeId],
  );

  const clearLocalHistory = useCallback(() => {
    localHistoryRef.current = [];
    setLocalCanUndo(false);
  }, []);

  /** CPU ソロなど — 2分アーム済みの自然な区切り */
  const runMatchInterstitial = useCallback(async () => {
    await onInterstitialNaturalBreak?.();
  }, [onInterstitialNaturalBreak]);

  /** オンライン対戦：相手がいるあいだはセッション登録（途中広告抑止） */
  useEffect(() => {
    if (playKind !== 'online') return;
    if (!onlineRoom?.guest) return;
    markSocialPlayAdSessionActive();
  }, [onlineRoom?.guest, playKind]);

  const beginMatch = useCallback(
    async (start: () => void) => {
      await runMatchInterstitial();
      start();
    },
    [runMatchInterstitial],
  );

  const counts = useMemo(() => countOthelloDiscs(board), [board]);

  useEffect(() => {
    if (view !== 'play') {
      prevDiscCountRef.current = null;
      return;
    }
    const total = counts.black + counts.white;
    const prev = prevDiscCountRef.current;
    if (prev !== null && total > prev) {
      audioService.playReversiStoneSound();
      vibrate(8);
    }
    if (prev !== null && total < prev) {
      prevDiscCountRef.current = total;
      return;
    }
    prevDiscCountRef.current = total;
  }, [counts.black, counts.white, view]);

  const gameOver = useMemo(() => isOthelloGameOver(board), [board]);
  const winner = useMemo(() => getOthelloWinner(board), [board]);

  const myOnlineColor = useMemo(
    () => (onlineRoom ? colorForReversiUid(onlineRoom, firebaseUser?.uid ?? null) : null),
    [firebaseUser?.uid, onlineRoom],
  );

  const myColorForView = useMemo((): OthelloColor | null => {
    if (view !== 'play') return null;
    if (playKind === 'cpu') return humanColor;
    if (playKind === 'online') return myOnlineColor;
    return null;
  }, [humanColor, myOnlineColor, playKind, view]);

  const canInteract = useMemo(() => {
    if (view !== 'play' || gameOver || cpuThinking) return false;
    if (playKind === 'cpu') return turn === humanColor;
    if (playKind === 'online') {
      return (
        onlineRoom?.status === 'playing' &&
        myOnlineColor != null &&
        turn === myOnlineColor
      );
    }
    return false;
  }, [cpuThinking, gameOver, humanColor, myOnlineColor, onlineRoom?.status, playKind, turn, view]);

  const validMoves = useMemo(
    () => (canInteract ? getValidOthelloMoves(board, turn) : []),
    [board, canInteract, turn],
  );

  const validKeySet = useMemo(
    () => new Set(validMoves.map((m) => `${m.row},${m.col}`)),
    [validMoves],
  );

  const reversiLogs = useMemo(
    () => logs.filter((l) => l.tag === 'REVERSI').slice(0, 40),
    [logs],
  );

  const clearCpuTimer = useCallback(() => {
    if (cpuTimerRef.current != null) {
      window.clearTimeout(cpuTimerRef.current);
      cpuTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCpuTimer(), [clearCpuTimer]);

  useEffect(() => {
    const pending = loadReversiPendingHostRoomCode();
    if (!pending) return;
    setPlayKind('online');
    setRoomCode(pending);
  }, []);

  useEffect(() => {
    if (view !== 'menu' && view !== 'online-lobby') return;
    if (roomCode) return;
    const unsub = subscribeOpenReversiRooms(setOpenWaitingRooms);
    return unsub;
  }, [roomCode, view]);

  useEffect(() => {
    onlineStartBreakDoneRef.current = false;
    coinAutoStartedRef.current = null;
    defaultRevealStartedRef.current = null;
  }, [roomCode]);

  useEffect(() => {
    if (playKind !== 'online' || !onlineRoom) return;
    const prev = prevOnlineStatusRef.current;
    if (prev === 'finished' && onlineRoom.status === 'playing') {
      setLoggedOnce(false);
      setLastFlips(new Set());
    }
    prevOnlineStatusRef.current = onlineRoom.status;
  }, [onlineRoom, playKind]);

  useEffect(() => {
    if (playKind !== 'online' || view !== 'play' || onlineRoom?.status !== 'playing') return;
    const id = window.setInterval(() => setClockNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [onlineRoom?.status, playKind, view]);

  const onlineTurnTimer = useMemo(
    () =>
      playKind === 'online' && view === 'play'
        ? computeOnlineTurnTimer(onlineRoom, clockNowMs)
        : null,
    [clockNowMs, onlineRoom, playKind, view],
  );

  useEffect(() => {
    if (onlineRoom?.status === 'playing') {
      timeoutFinalizeSentRef.current = false;
    }
  }, [onlineRoom?.lastMoveAt, onlineRoom?.status]);

  useEffect(() => {
    if (onlineTurnTimer?.phase !== 'expired' || !roomCode) return;
    if (timeoutFinalizeSentRef.current) return;
    timeoutFinalizeSentRef.current = true;
    void finalizeReversiTurnTimeout(roomCode);
  }, [onlineTurnTimer, roomCode]);

  const onlineSessionNotice = useMemo(
    () =>
      deriveOnlineSessionNotice(
        playKind,
        view,
        onlineRoom,
        roomCode,
        firebaseUser?.uid,
      ),
    [firebaseUser?.uid, onlineRoom, playKind, roomCode, view],
  );

  useEffect(() => {
    if (playKind !== 'online' || !roomCode) {
      setOnlineRoom(null);
      return;
    }
    setOnlineRoom(null);
    const unsub = subscribeReversiRoom(roomCode, (room) => {
      setOnlineRoom(room);
      if (room) {
        setBoard(deserializeOthelloBoard(room.board));
        setTurn(room.turn);
        setBlackSide({
          label: room.blackUid === room.host.uid ? room.host.name : room.guest?.name ?? '黒',
          emoji: room.blackUid === room.host.uid ? room.host.emoji : room.guest?.emoji ?? '⚫',
        });
        setWhiteSide({
          label: room.whiteUid === room.host.uid ? room.host.name : room.guest?.name ?? '白',
          emoji: room.whiteUid === room.host.uid ? room.host.emoji : room.guest?.emoji ?? '⚪',
        });
        const myUid = firebaseUser?.uid;
        const isMember =
          !!myUid && (room.host.uid === myUid || room.guest?.uid === myUid);
        if (isMember && room.guest) {
          setPlayKind('online');
          if (room.status === 'playing') {
            onlineStartBreakDoneRef.current = true;
            saveReversiPendingHostRoomCode('');
            if (viewRef.current !== 'play') {
              setView('play');
            }
          } else if (
            room.status !== 'waiting' &&
            (viewRef.current === 'menu' || viewRef.current === 'online-lobby')
          ) {
            if (room.host.uid === myUid && viewRef.current === 'menu') {
              window.dispatchEvent(
                new CustomEvent('SHOW_TOAST', {
                  detail: '相手が参加しました！対局をはじめます',
                }),
              );
            }
            setView('online-lobby');
          }
        }
      } else {
        saveReversiPendingHostRoomCode('');
      }
    });
    return unsub;
  }, [firebaseUser?.uid, playKind, roomCode]);

  useEffect(() => {
    if (!firebaseUser || !onlineRoom || !roomCode) return;
    if (onlineRoom.host.uid !== firebaseUser.uid) return;
    if (onlineRoom.status === 'waiting') {
      saveReversiPendingHostRoomCode(roomCode);
      return;
    }
    saveReversiPendingHostRoomCode('');
  }, [firebaseUser, onlineRoom, roomCode]);

  const recordMatch = useCallback(
    (result: 'win' | 'lose' | 'draw', detail: Record<string, unknown>) => {
      if (!firebaseUser || loggedOnce) return;
      setLoggedOnce(true);
      const resultJa = result === 'win' ? '勝ち' : result === 'lose' ? '負け' : '引き分け';
      const endNoteJa = typeof detail.endNoteJa === 'string' ? detail.endNoteJa : '';
      const noteSuffix = endNoteJa ? ` · ${endNoteJa}` : '';
      addLog(
        'LIVE_REPORT',
        'REVERSI',
        `${detail.modeLabel ?? 'リバーシ'} — ${resultJa}（${detail.score ?? ''}）${noteSuffix}`,
        { ...detail, result },
        (detail.emoji as string) ?? '♟️',
      );
    },
    [addLog, firebaseUser, loggedOnce],
  );

  useEffect(() => {
    if (view !== 'play' || !gameOver || winner == null) return;

    const handicapCorners =
      playKind === 'online'
        ? (onlineRoom?.settings.handicapCorners ?? roomDefaults.handicapCorners)
        : roomDefaults.handicapCorners;
    const handicapLabel = reversiHandicapLogLabelJa(handicapCorners);

    if (playKind === 'cpu') {
      const humanWon =
        winner === 'draw' ? 'draw' : winner === humanColor ? 'win' : 'lose';
      recordMatch(humanWon, {
        modeLabel: `${RAKUDA_ROBO_NAME}(${othelloCpuDifficultyLabelJa(cpuDifficulty)})`,
        emoji: humanWon === 'win' ? userEmoji : RAKUDA_ROBO_EMOJI,
        score: `${counts.black}-${counts.white}`,
        playKind: 'cpu',
        difficulty: cpuDifficulty,
        humanColor,
        handicapCorners,
        handicapLabel,
      });
    } else if (playKind === 'online' && myOnlineColor) {
      if (
        onlineRoom?.endReason === 'abandoned' ||
        onlineRoom?.endReason === 'timeout'
      ) {
        return;
      }
      const humanWon =
        winner === 'draw' ? 'draw' : winner === myOnlineColor ? 'win' : 'lose';
      recordMatch(humanWon, {
        modeLabel: 'オンライン1対1',
        emoji: humanWon === 'win' ? userEmoji : '🌐',
        score: `${counts.black}-${counts.white}`,
        playKind: 'online',
        roomCode,
        myColor: myOnlineColor,
        handicapCorners,
        handicapLabel,
      });
    }
  }, [
    counts.black,
    counts.white,
    cpuDifficulty,
    gameOver,
    roomDefaults.handicapCorners,
    humanColor,
    myOnlineColor,
    onlineRoom?.endReason,
    onlineRoom?.settings.handicapCorners,
    playKind,
    recordMatch,
    roomCode,
    userEmoji,
    view,
    winner,
  ]);

  useEffect(() => {
    if (
      playKind !== 'online' ||
      (view !== 'play' && view !== 'online-lobby') ||
      !firebaseUser ||
      !myOnlineColor
    ) {
      return;
    }

    const handicapCorners = onlineRoom?.settings.handicapCorners ?? roomDefaults.handicapCorners;
    const handicapLabel = reversiHandicapLogLabelJa(handicapCorners);
    const baseDetail = {
      modeLabel: 'オンライン1対1',
      score: `${counts.black}-${counts.white}`,
      playKind: 'online',
      roomCode,
      myColor: myOnlineColor,
      handicapCorners,
      handicapLabel,
    };

    if (onlineRoom?.status === 'finished' && onlineRoom.endReason === 'timeout') {
      const timedOutUid =
        onlineRoom.turn === 'black' ? onlineRoom.blackUid : onlineRoom.whiteUid;
      const result = timedOutUid === firebaseUser.uid ? 'lose' : 'win';
      recordMatch(result, {
        ...baseDetail,
        emoji: result === 'win' ? userEmoji : '🌐',
        endNoteJa: '時間切れ',
        endKind: 'timeout',
      });
      return;
    }

    if (
      onlineRoom?.status === 'finished' &&
      onlineRoom.endReason === 'abandoned' &&
      onlineRoom.endedBy !== firebaseUser.uid
    ) {
      recordMatch('win', {
        ...baseDetail,
        emoji: userEmoji,
        endNoteJa: '相手中断',
        endKind: 'abandoned',
      });
      return;
    }

    if (onlineSessionNotice === 'opponent_left') {
      recordMatch('win', {
        ...baseDetail,
        emoji: userEmoji,
        endNoteJa: '相手退出',
        endKind: 'opponent_left',
      });
    }
  }, [
    counts.black,
    counts.white,
    firebaseUser,
    roomDefaults.handicapCorners,
    myOnlineColor,
    onlineRoom,
    onlineSessionNotice,
    playKind,
    recordMatch,
    roomCode,
    userEmoji,
    view,
  ]);

  const startCpuGame = useCallback(
    (level: OthelloCpuDifficulty) => {
      audioService.noteUserGesture();
      clearCpuTimer();
      const side = resolveReversiTurnPickColor(localViewPrefs.cpuTurnPickMode);
      setPlayKind('cpu');
      setCpuDifficulty(level);
      setHumanColor(side);
      if (side === 'black') {
        setBlackSide({ label: nickname, emoji: userEmoji });
        setWhiteSide({ label: RAKUDA_ROBO_NAME, emoji: RAKUDA_ROBO_EMOJI });
      } else {
        setBlackSide({ label: RAKUDA_ROBO_NAME, emoji: RAKUDA_ROBO_EMOJI });
        setWhiteSide({ label: nickname, emoji: userEmoji });
      }
      setBoard(
        createReversiBoard({
          handicapCorners: roomDefaults.handicapCorners,
          handicapBeneficiary: side,
        }),
      );
      setTurn('black');
      setPassNotice(null);
      setLastFlips(new Set());
      setCpuThinking(false);
      setLoggedOnce(false);
      clearLocalHistory();
      setView('play');
      vibrate(8);
    },
    [
      clearCpuTimer,
      clearLocalHistory,
      localViewPrefs.cpuTurnPickMode,
      roomDefaults.handicapCorners,
      nickname,
      userEmoji,
    ],
  );

  const pushCpuUndoSnapshot = useCallback(() => {
    localHistoryRef.current.push({
      board: cloneOthelloBoard(board),
      turn,
      passNotice,
    });
    setLocalCanUndo(true);
  }, [board, passNotice, turn]);

  const executeLocalMove = useCallback((row: number, col: number, color: OthelloColor) => {
    setBoard((current) => {
      const { board: nextBoard, flips } = applyOthelloMove(current, row, col, color);
      setLastFlips(new Set(flips.map((c) => `${c.row},${c.col}`)));
      const { turn: nextTurn, passNotice: notice } = advanceTurnAfterMove(nextBoard, color);
      setTurn(nextTurn);
      setPassNotice(notice);
      return nextBoard;
    });
  }, []);

  const handleLocalUndo = useCallback(() => {
    if (localHistoryRef.current.length === 0) return;
    clearCpuTimer();
    setCpuThinking(false);
    const prev = localHistoryRef.current.pop()!;
    setBoard(prev.board);
    setTurn(prev.turn);
    setPassNotice(prev.passNotice);
    setLastFlips(new Set());
    setLocalCanUndo(localHistoryRef.current.length > 0);
    audioService.noteUserGesture();
    vibrate(8);
  }, [clearCpuTimer]);

  const canUndoLocal = localCanUndo && playKind === 'cpu';

  const handleCpuUndo = useCallback(() => {
    if (!canUndoLocal || cpuThinking) return;
    if (gameOver && localHistoryRef.current.length === 0) return;
    vibrate(8);
    handleLocalUndo();
  }, [canUndoLocal, cpuThinking, gameOver, handleLocalUndo]);

  const handleCellTap = useCallback(
    async (row: number, col: number) => {
      if (!canInteract) return;
      if (!validKeySet.has(`${row},${col}`)) return;

      if (playKind === 'online' && roomCode && firebaseUser) {
        audioService.noteUserGesture();
        const res = await submitReversiRoomMove(roomCode, firebaseUser.uid, row, col);
        if (res !== 'ok') {
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: '手番ではないか、通信に失敗しました' }),
          );
        }
        return;
      }

      pushCpuUndoSnapshot();
      audioService.noteUserGesture();
      executeLocalMove(row, col, turn);
    },
    [canInteract, executeLocalMove, firebaseUser, playKind, pushCpuUndoSnapshot, roomCode, turn, validKeySet],
  );

  useEffect(() => {
    if (view !== 'play' || playKind !== 'cpu' || gameOver) return;
    const cpuColor = opponent(humanColor);
    if (turn !== cpuColor) return;
    if (getValidOthelloMoves(board, cpuColor).length === 0) return;

    setCpuThinking(true);
    cpuTimerRef.current = window.setTimeout(() => {
      const move = pickOthelloCpuMove(board, cpuColor, cpuDifficulty);
      if (move) executeLocalMove(move.row, move.col, cpuColor);
      setCpuThinking(false);
      cpuTimerRef.current = null;
    }, CPU_DELAY_MS);

    return () => {
      clearCpuTimer();
      setCpuThinking(false);
    };
  }, [
    board,
    clearCpuTimer,
    cpuDifficulty,
    executeLocalMove,
    gameOver,
    humanColor,
    playKind,
    turn,
    view,
  ]);

  const handleCreateOnlineRoom = useCallback(async () => {
    if (!firebaseUser) {
      onGoogleLogin();
      return;
    }
    setOnlineBusy(true);
    try {
      const hostRecord = buildReversiHostRecord(reversiLogs);
      const settings: ReversiRoomSettings = {
        handicapCorners: roomDraft.handicapCorners,
      };
      const code = await createReversiRoom(
        { uid: firebaseUser.uid, name: nickname, emoji: userEmoji },
        settings,
        hostRecord,
        roomDraft.onlineStartMode,
        roomDraft.recruitComment,
      );
      setPlayKind('online');
      setRoomCode(code);
      saveReversiPendingHostRoomCode(code);
      setLoggedOnce(false);
      setComposingRecruit(false);
      setView('online-lobby');
      vibrate(10);
      try {
        await publishBoardGameRenrakuRecruit({
          kind: 'reversi',
          roomCode: code,
          nickname,
          uid: firebaseUser.uid,
          recruitComment: roomDraft.recruitComment,
        });
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '掲示板に募集を出しました！' }));
      } catch (e) {
        console.warn('[OthelloGame] renraku recruit failed', e);
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: '掲示板への募集に失敗しました（Googleログインを確認）' }),
        );
      }
    } catch {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ルーム作成に失敗しました' }));
    } finally {
      setOnlineBusy(false);
    }
  }, [
    firebaseUser,
    nickname,
    onGoogleLogin,
    roomDraft,
    reversiLogs,
    userEmoji,
  ]);

  const openRecruitComposer = useCallback(() => {
    if (!firebaseUser) {
      onGoogleLogin();
      return;
    }
    vibrate(8);
    setRoomDraft(loadReversiRoomDefaults());
    setComposingRecruit(true);
  }, [firebaseUser, onGoogleLogin]);

  const handleJoinOnlineRoomByCode = useCallback(
    async (codeRaw: string) => {
      if (!firebaseUser) {
        onGoogleLogin();
        return;
      }
      const code = codeRaw.trim().toUpperCase();
      if (code.length < 4) return;
      setOnlineBusy(true);
      try {
        const res = await joinReversiRoom(code, {
          uid: firebaseUser.uid,
          name: nickname,
          emoji: userEmoji,
        });
        if (res === 'ok') {
          setPlayKind('online');
          setRoomCode(code);
          setLoggedOnce(false);
          onlineStartBreakDoneRef.current = true;
          setView('play');
          vibrate(10);
        } else if (res === 'not_found') {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ルームが見つかりません' }));
        } else if (res === 'self') {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '自分のルームには参加できません' }));
        } else {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ルームは満席です' }));
        }
      } catch {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '参加に失敗しました' }));
      } finally {
        setOnlineBusy(false);
      }
    },
    [firebaseUser, nickname, onGoogleLogin, userEmoji],
  );

  useEffect(() => {
    if (!firebaseUser) return;
    const pendingCode = consumeBoardGamePendingJoinRoomCode('reversi');
    if (!pendingCode) return;
    void handleJoinOnlineRoomByCode(pendingCode);
  }, [firebaseUser, handleJoinOnlineRoomByCode]);

  useEffect(() => {
    if (!roomCode || !onlineRoom || !firebaseUser) return;
    if (!shouldClearBoardGameRenrakuRecruit(roomCode, onlineRoom, firebaseUser.uid)) return;
    void clearBoardGameRenrakuRecruit('reversi', roomCode);
  }, [firebaseUser, onlineRoom, roomCode]);

  useEffect(() => {
    if (playKind !== 'online' || !roomCode || !onlineRoom || !firebaseUser) return;
    if (onlineRoom.roomCode?.toUpperCase() !== roomCode.toUpperCase()) return;
    if (onlineRoom.host.uid !== firebaseUser.uid) return;
    if (onlineRoom.status !== 'waiting' || onlineRoom.guest?.uid) return;
    void ensureBoardGameRenrakuRecruit({
      kind: 'reversi',
      roomCode,
      nickname,
      uid: firebaseUser.uid,
      recruitComment: onlineRoom.recruitComment,
    });
  }, [firebaseUser, nickname, onlineRoom, playKind, roomCode]);

  const runCoinSidePickFlow = useCallback(async () => {
      if (!roomCode || !firebaseUser || sidePickBusy) return;
      setSidePickBusy(true);
      onlineStartBreakDoneRef.current = true;
      vibrate(12);
      try {
        const signal = await signalReversiSidePickAnim(roomCode, firebaseUser.uid, 'coin');
        if (signal !== 'ok') {
          onlineStartBreakDoneRef.current = false;
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: '先後決定の開始に失敗しました' }),
          );
          return;
        }
        await new Promise((r) => window.setTimeout(r, SIDE_PICK_ANIM_MS));
        const res = await commitReversiSidePick(roomCode, firebaseUser.uid, 'coin');
        if (!res.ok) {
          onlineStartBreakDoneRef.current = false;
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: '先後の決定に失敗しました' }),
          );
          return;
        }
        await new Promise((r) => window.setTimeout(r, SIDE_PICK_REVEAL_MS));
        const begin = await beginReversiRoomPlay(roomCode, firebaseUser.uid);
        if (begin !== 'ok') {
          onlineStartBreakDoneRef.current = false;
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: '対局開始に失敗しました' }),
          );
          return;
        }
        setView('play');
      } finally {
        setSidePickBusy(false);
      }
    },
    [firebaseUser, roomCode, sidePickBusy],
  );

  const resetCurrentGame = useCallback(() => {
    if (playKind === 'cpu') startCpuGame(cpuDifficulty);
  }, [cpuDifficulty, playKind, startCpuGame]);

  const requestOnlineRematch = useCallback(async () => {
    if (!roomCode || !firebaseUser) return;
    setOnlineBusy(true);
    try {
      const res = await requestReversiRematch(roomCode, firebaseUser.uid);
      if (res === 'waiting') {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: '相手の「もう一局」を待っています' }),
        );
      } else if (res === 'started') {
        setLoggedOnce(false);
        vibrate(10);
      } else if (res === 'not_finished') {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'まだ終局していません' }));
      } else {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '再戦できませんでした' }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '再戦の通信に失敗しました' }));
    } finally {
      setOnlineBusy(false);
    }
  }, [firebaseUser, roomCode]);

  const handlePlayRestart = useCallback(async () => {
    vibrate(8);
    if (gameOver && playKind !== 'online') {
      await runMatchInterstitial();
    }
    if (playKind === 'online') {
      await requestOnlineRematch();
      return;
    }
    resetCurrentGame();
  }, [gameOver, playKind, requestOnlineRematch, resetCurrentGame, runMatchInterstitial]);

  const handleBack = useCallback(() => {
    vibrate(10);
    clearCpuTimer();
    setCpuThinking(false);
    void (async () => {
      if (playKind === 'online' && onlineRoom?.guest) {
        await onSocialSessionEndInterstitial?.();
      } else {
        await onInterstitialNaturalBreak?.();
      }
      onBack();
    })();
  }, [
    clearCpuTimer,
    onBack,
    onInterstitialNaturalBreak,
    onSocialSessionEndInterstitial,
    onlineRoom?.guest,
    playKind,
  ]);

  const handleBackToMenu = useCallback(() => {
    vibrate(8);
    clearCpuTimer();
    setCpuThinking(false);
    setShowInterruptConfirm(false);
    clearLocalHistory();
    if (playKind === 'online' && roomCode && firebaseUser) {
      void clearReversiRematchVote(roomCode, firebaseUser.uid);
    }
    saveReversiPendingHostRoomCode('');
    setRoomCode('');
    setComposingRecruit(false);
    setOnlineRoom(null);
    onlineStartBreakDoneRef.current = false;
    prevOnlineStatusRef.current = null;
    timeoutFinalizeSentRef.current = false;
    setView('menu');
  }, [clearCpuTimer, clearLocalHistory, firebaseUser, playKind, roomCode]);

  const isMyHostWaiting = useMemo(
    () =>
      !!firebaseUser &&
      !!roomCode &&
      onlineRoom?.status === 'waiting' &&
      onlineRoom.host.uid === firebaseUser.uid,
    [firebaseUser, onlineRoom, roomCode],
  );

  const isOnlineSidePick = useMemo(
    () =>
      playKind === 'online' &&
      (onlineRoom?.status === 'side_pick' || onlineRoom?.status === 'side_reveal'),
    [onlineRoom?.status, playKind],
  );

  const sidePickOverlayMode = useMemo((): 'anim' | 'reveal' | null => {
    if (playKind !== 'online' || !onlineRoom) return null;
    if (onlineRoom.status === 'side_pick' && onlineRoom.sidePickAnimMethod) return 'anim';
    if (onlineRoom.status === 'side_reveal') return 'reveal';
    return null;
  }, [onlineRoom, playKind]);

  const mySidePickColor = useMemo(
    () => (onlineRoom ? colorForReversiUid(onlineRoom, firebaseUser?.uid ?? null) : null),
    [firebaseUser?.uid, onlineRoom],
  );

  const isMyHostSidePick = useMemo(
    () =>
      playKind === 'online' &&
      onlineRoom?.status === 'side_pick' &&
      !!firebaseUser &&
      onlineRoom.host.uid === firebaseUser.uid,
    [firebaseUser, onlineRoom, playKind],
  );

  const isGuestSidePick = useMemo(
    () =>
      playKind === 'online' &&
      onlineRoom?.status === 'side_pick' &&
      !!firebaseUser &&
      onlineRoom?.guest?.uid === firebaseUser.uid,
    [firebaseUser, onlineRoom, playKind],
  );

  const isOnlineSideReveal = useMemo(
    () => playKind === 'online' && onlineRoom?.status === 'side_reveal',
    [onlineRoom?.status, playKind],
  );

  useEffect(() => {
    if (playKind !== 'online' || !roomCode || !firebaseUser || !onlineRoom) return;
    if (onlineRoom.status !== 'side_pick') return;
    if (normalizeReversiOnlineStartMode(onlineRoom.onlineStartMode) !== 'coin') return;
    if (onlineRoom.host.uid !== firebaseUser.uid) return;
    if (onlineRoom.sidePickAnimMethod || sidePickBusy) return;
    const key = `${roomCode}:${onlineRoom.guest?.uid ?? ''}`;
    if (coinAutoStartedRef.current === key) return;
    coinAutoStartedRef.current = key;
    void runCoinSidePickFlow();
  }, [
    firebaseUser,
    onlineRoom,
    playKind,
    roomCode,
    runCoinSidePickFlow,
    sidePickBusy,
  ]);

  useEffect(() => {
    if (playKind !== 'online' || !roomCode || !firebaseUser || !onlineRoom) return;
    if (
      onlineRoom.status !== 'side_reveal' ||
      !isReversiPresetSideAssignMode(onlineRoom.onlineStartMode)
    )
      return;
    const isMember =
      onlineRoom.host.uid === firebaseUser.uid ||
      onlineRoom.guest?.uid === firebaseUser.uid;
    if (!isMember) return;
    const key = `${roomCode}:${onlineRoom.guest?.uid ?? ''}`;
    if (defaultRevealStartedRef.current === key) return;
    defaultRevealStartedRef.current = key;
    onlineStartBreakDoneRef.current = true;
    void (async () => {
      await new Promise((r) => window.setTimeout(r, SIDE_PICK_REVEAL_MS));
      const begin = await beginReversiRoomPlay(roomCode, firebaseUser.uid);
      if (begin !== 'ok' && begin !== 'not_ready') {
        onlineStartBreakDoneRef.current = false;
        defaultRevealStartedRef.current = null;
        if (begin === 'forbidden') {
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', { detail: '対局開始に失敗しました' }),
          );
        }
        return;
      }
      setView('play');
    })();
  }, [firebaseUser, onlineRoom, playKind, roomCode]);

  const joinableOpenRooms = useMemo(() => {
    const myUid = firebaseUser?.uid;
    return openWaitingRooms.filter((room) => !myUid || room.host.uid !== myUid);
  }, [firebaseUser?.uid, openWaitingRooms]);

  const retreatFromOnlineLobby = useCallback(() => {
    vibrate(8);
    if (isMyHostWaiting && roomCode) {
      saveReversiPendingHostRoomCode(roomCode);
      setView('menu');
      return;
    }
    handleBackToMenu();
  }, [handleBackToMenu, isMyHostWaiting, roomCode]);

  const cancelHostRecruitment = useCallback(async () => {
    if (!roomCode || !firebaseUser) {
      handleBackToMenu();
      return;
    }
    setOnlineBusy(true);
    try {
      await clearBoardGameRenrakuRecruit('reversi', roomCode);
      await abandonReversiRoom(roomCode, firebaseUser.uid);
      saveReversiPendingHostRoomCode('');
      handleBackToMenu();
    } catch {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '募集の取り消しに失敗しました' }));
    } finally {
      setOnlineBusy(false);
    }
  }, [firebaseUser, handleBackToMenu, roomCode]);

  const leaveOnlineLobby = useCallback(async () => {
    if (isMyHostWaiting) {
      retreatFromOnlineLobby();
      return;
    }
    if (roomCode && firebaseUser) {
      await abandonReversiRoom(roomCode, firebaseUser.uid);
    }
    handleBackToMenu();
  }, [firebaseUser, handleBackToMenu, isMyHostWaiting, retreatFromOnlineLobby, roomCode]);

  const promptOnlineInterrupt = useCallback(() => {
    vibrate(8);
    setShowInterruptConfirm(true);
  }, []);

  const confirmOnlineInterrupt = useCallback(async () => {
    if (!roomCode || !firebaseUser) return;
    setOnlineBusy(true);
    try {
      const result = await abandonReversiRoom(roomCode, firebaseUser.uid);
      if (result !== 'ok') {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '中断の送信に失敗しました' }));
        return;
      }
      if (myOnlineColor) {
        const handicapCorners =
          onlineRoom?.settings.handicapCorners ?? roomDefaults.handicapCorners;
        recordMatch('lose', {
          modeLabel: 'オンライン1対1',
          emoji: userEmoji,
          score: `${counts.black}-${counts.white}`,
          playKind: 'online',
          roomCode,
          myColor: myOnlineColor,
          handicapCorners,
          handicapLabel: reversiHandicapLogLabelJa(handicapCorners),
          endNoteJa: '中断',
          endKind: 'abandoned',
        });
      }
      handleBackToMenu();
    } catch {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '中断の送信に失敗しました' }));
    } finally {
      setOnlineBusy(false);
      setShowInterruptConfirm(false);
    }
  }, [
    counts.black,
    counts.white,
    firebaseUser,
    handleBackToMenu,
    roomDefaults.handicapCorners,
    myOnlineColor,
    onlineRoom?.settings.handicapCorners,
    recordMatch,
    roomCode,
    userEmoji,
  ]);

  const onlineActiveMatch = useMemo(
    () => isOnlineActiveMatch(playKind, view, gameOver, onlineRoom, roomCode),
    [gameOver, onlineRoom, playKind, roomCode, view],
  );

  const handlePlayExitToMenu = useCallback(async () => {
    if (onlineActiveMatch) {
      promptOnlineInterrupt();
      return;
    }
    if (gameOver && playKind !== 'online') {
      await runMatchInterstitial();
    }
    handleBackToMenu();
  }, [
    gameOver,
    handleBackToMenu,
    onlineActiveMatch,
    playKind,
    promptOnlineInterrupt,
    runMatchInterstitial,
  ]);

  const handleClearModalMenu = useCallback(async () => {
    vibrate(8);
    if (playKind !== 'online') {
      await runMatchInterstitial();
    }
    handleBackToMenu();
  }, [handleBackToMenu, playKind, runMatchInterstitial]);

  const reversiLogSummary = useMemo(() => summarizeReversiMatchResults(reversiLogs), [reversiLogs]);

  const headerTitle = useMemo(() => {
    if (view === 'my-settings') return '自分の設定';
    if (view === 'online-lobby' && composingRecruit) return 'ルームを作成（ホスト）';
    return 'リバーシ';
  }, [composingRecruit, view]);

  const headerNote = useMemo(() => {
    switch (view) {
      case 'menu':
        return 'ひとり・オンラインで遊べます';
      case 'my-settings':
        return '盤面の色（あなたの画面だけ）';
      case 'logs':
        if (firebaseUser) {
          const { wins, losses, draws } = reversiLogSummary;
          return `ログイン中の対戦記録【${wins}勝/${losses}敗/${draws}引き分け】`;
        }
        return 'ログインすると記録が残ります';
      case 'cpu-difficulty':
        return `${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}の強さ`;
      case 'online-lobby':
        if (composingRecruit) return 'オンライン1対1';
        return roomCode ? `ルーム ${roomCode} — 相手を待っています` : 'オンライン1対1';
      case 'play':
        if (playKind === 'cpu') {
          return `${RAKUDA_ROBO_EMOJI} ${othelloCpuDifficultyLabelJa(cpuDifficulty)}`;
        }
        return roomCode ? `オンライン ${roomCode}` : '対局中';
      default:
        return '';
    }
  }, [composingRecruit, cpuDifficulty, firebaseUser, playKind, reversiLogSummary, roomCode, view]);

  const onlineRematchReady = useMemo(() => {
    if (playKind !== 'online' || !onlineRoom || !firebaseUser) {
      return { mine: false, opponent: false };
    }
    const ready = onlineRoom.rematchReady ?? [];
    const oppUid =
      onlineRoom.blackUid === firebaseUser.uid
        ? onlineRoom.whiteUid
        : onlineRoom.blackUid;
    return {
      mine: ready.includes(firebaseUser.uid),
      opponent: oppUid ? ready.includes(oppUid) : false,
    };
  }, [firebaseUser, onlineRoom, playKind]);

  const showNormalClearModal =
    view === 'play' &&
    gameOver &&
    winner != null &&
    !(
      playKind === 'online' &&
      (onlineRoom?.endReason === 'abandoned' || onlineRoom?.endReason === 'timeout')
    );

  useEffect(() => {
    if (!gameOver) {
      didRecordShussekiRef.current = false;
      cpuMatchThanksDoneRef.current = false;
    }
  }, [gameOver]);

  useEffect(() => {
    if (!showNormalClearModal || !onRecordShussekiGamePlay) return;
    if (didRecordShussekiRef.current) return;
    didRecordShussekiRef.current = true;
    onRecordShussekiGamePlay();
  }, [onRecordShussekiGamePlay, showNormalClearModal]);

  useEffect(() => {
    if (onlineRoom?.status === 'playing') {
      matchThanksSentRef.current = false;
      seenOpponentThanksRef.current = new Set();
    }
  }, [onlineRoom?.status, roomCode]);

  useEffect(() => {
    if (
      playKind !== 'online' ||
      !showNormalClearModal ||
      !firebaseUser?.uid ||
      !roomCode ||
      matchThanksSentRef.current
    ) {
      return;
    }
    matchThanksSentRef.current = true;
    void sendReversiMatchThanks(roomCode, firebaseUser.uid);
  }, [firebaseUser?.uid, playKind, roomCode, showNormalClearModal]);

  useEffect(() => {
    if (playKind !== 'online' || !firebaseUser?.uid || !onlineRoom?.thanksByUid) return;
    const myUid = firebaseUser.uid;
    for (const [uid, sent] of Object.entries(onlineRoom.thanksByUid)) {
      if (!sent || uid === myUid || seenOpponentThanksRef.current.has(uid)) continue;
      seenOpponentThanksRef.current.add(uid);
      const opp = reversiOpponentPlayer(onlineRoom, myUid);
      const label = opp ? `${opp.emoji}${opp.name}` : '対戦相手';
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: `${label}さん：${REVERSI_MATCH_THANKS_TEXT}`,
        }),
      );
    }
  }, [firebaseUser?.uid, onlineRoom, playKind]);

  useEffect(() => {
    if (playKind !== 'cpu' || !showNormalClearModal || cpuMatchThanksDoneRef.current) return;
    cpuMatchThanksDoneRef.current = true;
    window.dispatchEvent(
      new CustomEvent('SHOW_TOAST', {
        detail: `${RAKUDA_ROBO_EMOJI}${RAKUDA_ROBO_NAME}：${REVERSI_MATCH_THANKS_TEXT}`,
      }),
    );
  }, [playKind, showNormalClearModal]);

  /** iPad 等: 親領域の min(幅,高さ) で盤を正方形に固定（aspect-ratio だけだと縦長に伸びる） */
  useLayoutEffect(() => {
    if (view !== 'play') return;
    const el = boardAreaRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const { boardPx: next, gutter } = measureOthelloBoardPx(Math.min(w, h), showCoordLayer);
      setBoardPx((prev) => (prev === next ? prev : next));
      setCoordGutter((prev) =>
        prev.left === gutter.left && prev.top === gutter.top && prev.fontSize === gutter.fontSize
          ? prev
          : gutter,
      );
    };
    measure();
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [view, showCoordLayer]);

  const othelloCoordLayout = useMemo(() => {
    if (!showCoordLayer || boardPx <= 0) return null;
    const cellSize = othelloCellSize(boardPx);
    const cellStep = cellSize + OTHELLO_GRID_GAP_PX;
    return {
      cellSize,
      cellStep,
      gridOriginX: coordGutter.left + OTHELLO_GRID_PAD_PX,
      gridOriginY: coordGutter.top + OTHELLO_GRID_PAD_PX,
      wrapWidth: boardPx + coordGutter.left,
      wrapHeight: boardPx + coordGutter.top,
    };
  }, [showCoordLayer, boardPx, coordGutter.left, coordGutter.top]);

  return (
    <RK05ImmersiveScreen themeClassName={REVERSI_THEME}>
      <RK06ImmersiveHeader
        title={headerTitle}
        subtitle={headerNote}
        showKicker={false}
        kickerClassName={REVERSI_KICKER}
        titleClassName={REVERSI_TITLE}
        subtitleClassName={REVERSI_SUB}
        backButton="rk19"
        backButtonTitle="らくだ珈琲のトップへもどる"
        onBack={
          view === 'menu'
            ? handleBack
              : view === 'play'
              ? () => {
                  void handlePlayExitToMenu();
                }
              : view === 'online-lobby'
                ? () => {
                    if (composingRecruit) {
                      setComposingRecruit(false);
                      return;
                    }
                    retreatFromOnlineLobby();
                  }
                : () => {
                    vibrate(8);
                    setView('menu');
                  }
        }
      />

      {view === 'menu' ? (
        <div className="flex-1 min-h-0 w-full max-w-md flex flex-col justify-center gap-2.5 py-4">
          {isMyHostWaiting ? (
            <div className="rounded-xl border-2 border-rk-amber-400/90 bg-rk-amber-50/95 p-4 space-y-2.5 shadow-md">
              <p className="text-base font-black text-rk-amber-950 leading-snug">
                🟢 ルーム {roomCode} を募集中
              </p>
              {onlineRoom?.recruitComment ? (
                <p className="text-sm text-rk-amber-900/85 leading-snug">{onlineRoom.recruitComment}</p>
              ) : null}
              <p className="text-sm text-rk-amber-900/75 leading-snug">
                相手が参加するまで待機中です。メニューから離れても募集は続きます。
              </p>
              <RK02PrimaryTouchButton
                className={`w-full ${REVERSI_MENU_PRIMARY_BORDER}`}
                onClick={() => {
                  vibrate(8);
                  setView('online-lobby');
                }}
              >
                待機画面へ
              </RK02PrimaryTouchButton>
              <RK03GhostTouchButton
                disabled={onlineBusy}
                className={`w-full ${REVERSI_MENU_GHOST_BORDER}`}
                onClick={() => {
                  void cancelHostRecruitment();
                }}
              >
                募集をやめる
              </RK03GhostTouchButton>
            </div>
          ) : null}
          <RK02PrimaryTouchButton
            className={`w-full inline-flex items-center justify-center gap-2 ${REVERSI_MENU_PRIMARY_BORDER}`}
            onClick={() => {
              vibrate(10);
              setView('cpu-difficulty');
            }}
          >
            <span aria-hidden>{RAKUDA_ROBO_EMOJI}</span>
            {RAKUDA_ROBO_NAME}と遊ぶ
          </RK02PrimaryTouchButton>
          <RK02PrimaryTouchButton
            className={`w-full inline-flex items-center justify-center gap-2 relative ${REVERSI_MENU_PRIMARY_BORDER}`}
            onClick={() => {
              vibrate(10);
              setView('online-lobby');
            }}
          >
            <Swords className="size-[1.15em] shrink-0" aria-hidden />
            オンライン1対1
            {isMyHostWaiting ? (
              <span className={`ml-1.5 ${REVERSI_RECRUIT_HOST_BADGE_CLASS}`}>募集中</span>
            ) : joinableOpenRooms.length > 0 ? (
              <span className={`ml-1.5 ${REVERSI_RECRUIT_BADGE_CLASS}`}>募集あり</span>
            ) : null}
          </RK02PrimaryTouchButton>
          <RK03GhostTouchButton
            className={`${REVERSI_MENU_GHOST_NARROW} inline-flex items-center justify-center gap-2 ${REVERSI_MENU_SETTINGS_TOP_GAP} ${REVERSI_MENU_GHOST_BORDER}`}
            onClick={() => {
              vibrate(8);
              setView('my-settings');
            }}
          >
            <Settings2 className="size-[1.15em] shrink-0" aria-hidden />
            自分の設定
          </RK03GhostTouchButton>
          <RK03GhostTouchButton
            className={`${REVERSI_MENU_GHOST_NARROW} inline-flex items-center justify-center gap-2 ${REVERSI_MENU_GHOST_BORDER}`}
            onClick={() => setView('logs')}
          >
            <BookOpen className="size-[1.15em] shrink-0" aria-hidden />
            対戦記録（ログ）
          </RK03GhostTouchButton>
        </div>
      ) : null}

      {view === 'my-settings' ? (
        <ReversiMySettingsPanel
          prefs={localViewPrefs}
          onChange={setLocalViewPrefs}
          onReset={() => setLocalViewPrefs({ ...REVERSI_DEFAULT_LOCAL_VIEW_PREFS })}
          onSave={() => {
            saveReversiLocalViewPrefs(localViewPrefs);
            window.dispatchEvent(
              new CustomEvent('SHOW_TOAST', { detail: '自分の設定を保存しました' }),
            );
            setView('menu');
          }}
        />
      ) : null}

      {view === 'logs' ? (
        <LogsPanel
          logs={reversiLogs}
          isLoggedIn={!!firebaseUser}
          onLogin={onGoogleLogin}
          onDone={() => setView('menu')}
        />
      ) : null}

      {view === 'cpu-difficulty' ? (
        <div className="flex-1 min-h-0 w-full max-w-md flex flex-col gap-2 py-4">
          <div className="rounded-xl border border-rk-success-300/80 bg-rk-white/90 p-3 space-y-1.5">
            <p className="font-black text-rk-success-950 text-center mb-1">あなたの先後</p>
            {(['black_first', 'white_first', 'random'] as const).map((mode) => (
              <ReversiRadioOption
                key={mode}
                name="reversi-cpu-turn-pick"
                value={mode}
                checked={localViewPrefs.cpuTurnPickMode === mode}
                label={reversiTurnPickModeLabelJa(mode)}
                hint={reversiTurnPickModeHintJa(mode)}
                onSelect={() => {
                  const next = { ...localViewPrefs, cpuTurnPickMode: mode };
                  setLocalViewPrefs(next);
                  saveReversiLocalViewPrefs(next);
                }}
              />
            ))}
          </div>
          <p className="text-center text-sm font-medium text-rk-success-900/70">難易度を選んでください</p>
          {OTHELLO_CPU_DIFFICULTIES.map((level) => (
            <RK03GhostTouchButton
              key={level}
              className="w-full text-center px-4 py-3"
              onClick={() => {
                void beginMatch(() => startCpuGame(level));
              }}
            >
              <span className="block font-black text-rk-success-950 leading-snug whitespace-nowrap">
                {RAKUDA_ROBO_EMOJI} {othelloCpuDifficultyLabelJa(level)}　
                <span className="font-medium text-rk-success-900/70">
                  {othelloCpuDifficultyHintJa(level)}
                </span>
              </span>
            </RK03GhostTouchButton>
          ))}
        </div>
      ) : null}

      {view === 'online-lobby' ? (
        <div className="flex-1 min-h-0 w-full max-w-md flex flex-col gap-3 py-4">
          {!roomCode ? (
            composingRecruit ? (
              <ReversiRecruitComposer
                draft={roomDraft}
                busy={onlineBusy}
                onChange={setRoomDraft}
                onReset={() => setRoomDraft({ ...REVERSI_DEFAULT_ROOM_DEFAULTS })}
                onSaveDefaults={() => {
                  saveReversiRoomDefaults(roomDraft);
                  setRoomDefaults(roomDraft);
                  window.dispatchEvent(
                    new CustomEvent('SHOW_TOAST', { detail: 'ルーム作成の初期値として保存しました' }),
                  );
                }}
                onSubmit={() => {
                  void handleCreateOnlineRoom();
                }}
              />
            ) : (
              <div className={`flex-1 min-h-0 flex flex-col gap-3 ${REVERSI_ONLINE_UI_TEXT}`}>
                <RK02PrimaryTouchButton
                  disabled={onlineBusy}
                  className="w-full shrink-0"
                  onClick={openRecruitComposer}
                >
                  ルームを作成（ホスト）
                </RK02PrimaryTouchButton>

                <p className="shrink-0 font-black text-rk-success-950">募集中のルーム</p>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                  {joinableOpenRooms.length === 0 ? (
                    <p className="text-center text-rk-success-900/60 py-6 leading-snug">
                      いま募集中のルームはありません
                    </p>
                  ) : (
                    joinableOpenRooms.map((room) => (
                      <OpenReversiRoomCard
                        key={room.roomCode}
                        room={room}
                        busy={onlineBusy}
                        onJoin={() => {
                          void handleJoinOnlineRoomByCode(room.roomCode);
                        }}
                      />
                    ))
                  )}
                </div>
                {!firebaseUser ? (
                  <p className="text-center text-rk-success-900/70 shrink-0">
                    オンライン対戦はログインが必要です
                  </p>
                ) : null}
              </div>
            )
          ) : (
            <div className="flex-1 min-h-0 flex flex-col justify-center text-center space-y-3">
              <p className="text-[0.9em] font-bold text-rk-success-950">ルーム番号</p>
              <p className="text-[2em] font-black tracking-[0.2em] text-rk-success-900">{roomCode}</p>
              {onlineRoom?.recruitComment ? (
                <p className="text-[0.82em] text-rk-success-900/80 leading-snug px-2">
                  {onlineRoom.recruitComment}
                </p>
              ) : null}
              <p className="text-[0.82em] text-rk-success-900/75 leading-snug">
                {isOnlineSideReveal
                  ? '先後を確認しています…'
                  : isMyHostSidePick
                    ? `${onlineRoom?.guest?.emoji ?? '👤'} ${onlineRoom?.guest?.name ?? '相手'}が参加しました。`
                    : isGuestSidePick
                      ? 'コインで先後を決めています…'
                      : isMyHostWaiting
                        ? '一覧から相手が参加するのを待っています。'
                        : '相手に番号を伝えて待ちましょう。'}
                <br />
                {isMyHostWaiting
                  ? `先後：${reversiOnlineStartModeLabelJa(onlineRoom?.onlineStartMode ?? 'default_black')}`
                  : null}
                {!isMyHostWaiting && isOnlineSidePick ? (
                  <>
                    <br />
                    コインで先後が決まります。
                  </>
                ) : null}
                {!isMyHostWaiting && !isOnlineSidePick && !isOnlineSideReveal
                  ? 'ルーム設定（ハンデなど）が適用されます。'
                  : null}
              </p>
              {onlineRoom?.status === 'playing' ? (
                <RK02PrimaryTouchButton
                  className="w-full"
                  onClick={() => {
                    setPlayKind('online');
                    setView('play');
                  }}
                >
                  対局へ
                </RK02PrimaryTouchButton>
              ) : null}
              {isMyHostWaiting ? (
                <>
                  <RK03GhostTouchButton
                    className={`w-full ${REVERSI_MENU_GHOST_BORDER}`}
                    onClick={() => {
                      retreatFromOnlineLobby();
                    }}
                  >
                    リバーシメニューへ（募集を続ける）
                  </RK03GhostTouchButton>
                  <RK03GhostTouchButton
                    disabled={onlineBusy}
                    className={`w-full text-rk-amber-900 ${REVERSI_MENU_GHOST_BORDER}`}
                    onClick={() => {
                      void cancelHostRecruitment();
                    }}
                  >
                    募集をやめる
                  </RK03GhostTouchButton>
                </>
              ) : null}
            </div>
          )}
          {!isMyHostWaiting && !composingRecruit ? (
            <RK03GhostTouchButton className="w-full shrink-0" onClick={() => void leaveOnlineLobby()}>
              もどる
            </RK03GhostTouchButton>
          ) : null}
        </div>
      ) : null}

      {view === 'play' ? (
        <div className="w-full max-w-md flex-1 min-h-0 flex flex-col gap-2">
          <div className="shrink-0 flex gap-2">
            <SideBadge
              profile={blackSide}
              count={counts.black}
              sideColor="black"
              myColor={myColorForView}
              prefs={localViewPrefs}
              label="黒"
            />
            <SideBadge
              profile={whiteSide}
              count={counts.white}
              sideColor="white"
              myColor={myColorForView}
              prefs={localViewPrefs}
              label="白"
            />
          </div>

          <div ref={boardAreaRef} className="flex-1 min-h-0 flex items-center justify-center w-full">
            <div
              className="relative shrink-0"
              style={
                othelloCoordLayout
                  ? { width: othelloCoordLayout.wrapWidth, height: othelloCoordLayout.wrapHeight }
                  : undefined
              }
            >
              {othelloCoordLayout && (
                <div className="absolute inset-0 z-[5] pointer-events-none select-none" aria-hidden>
                  {Array.from({ length: OTHELLO_SIZE }, (_, col) => (
                    <div
                      key={`othello-coord-col-${col}`}
                      className="absolute flex items-center justify-center font-bold text-rk-sky-600 leading-none"
                      style={{
                        left: othelloCoordLayout.gridOriginX + col * othelloCoordLayout.cellStep,
                        top: 0,
                        width: othelloCoordLayout.cellSize,
                        height: coordGutter.top,
                        fontSize: coordGutter.fontSize,
                      }}
                    >
                      {boardGridColumnLabel(col)}
                    </div>
                  ))}
                  {Array.from({ length: OTHELLO_SIZE }, (_, row) => (
                    <div
                      key={`othello-coord-row-${row}`}
                      className="absolute flex items-center justify-center font-bold text-rk-sky-600 leading-none tabular-nums"
                      style={{
                        left: 0,
                        top: othelloCoordLayout.gridOriginY + row * othelloCoordLayout.cellStep,
                        width: coordGutter.left,
                        height: othelloCoordLayout.cellSize,
                        fontSize: coordGutter.fontSize,
                      }}
                    >
                      {row + 1}
                    </div>
                  ))}
                </div>
              )}
              <div
                className={[
                  'shrink-0 rounded-xl border-4 p-1 shadow-md grid gap-[2px]',
                  boardTheme.frameBorder,
                  boardTheme.frameBg,
                ].join(' ')}
                style={{
                  width: boardPx,
                  height: boardPx,
                  marginLeft: othelloCoordLayout ? coordGutter.left : 0,
                  marginTop: othelloCoordLayout ? coordGutter.top : 0,
                  gridTemplateColumns: `repeat(${OTHELLO_SIZE}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${OTHELLO_SIZE}, minmax(0, 1fr))`,
                }}
                role="grid"
                aria-label="8×8リバーシ盤"
              >
                {board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const key = `${rowIndex},${colIndex}`;
                    const hint = canInteract && validKeySet.has(key);
                    const flipped = lastFlips.has(key);
                    const stoneVisual = cell
                      ? resolveReversiStoneVisual(cell, myColorForView, localViewPrefs)
                      : null;

                    return (
                      <button
                        key={key}
                        type="button"
                        role="gridcell"
                        disabled={!hint}
                        onClick={() => handleCellTap(rowIndex, colIndex)}
                        className={[
                          'relative min-h-0 min-w-0 size-full rounded-[3px]',
                          boardTheme.cellBg,
                          hint ? 'cursor-pointer ring-2 ring-rk-amber-300/90' : 'cursor-default',
                        ].join(' ')}
                        aria-label={
                          cell ? othelloColorLabelJa(cell) : hint ? '置けるマス' : '空き'
                        }
                      >
                        {stoneVisual ? (
                          <ReversiStoneMark visual={stoneVisual} flipped={flipped} />
                        ) : hint ? (
                          <span
                            className="absolute inset-0 m-auto size-[22%] rounded-full bg-rk-amber-200/85"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col gap-2">
            {playKind === 'online' &&
            onlineRoom?.status === 'playing' &&
            !gameOver &&
            onlineTurnTimer?.phase === 'final' ? (
              <div className="rounded-lg border border-rk-amber-300/90 bg-rk-white/95 px-3 py-2 shadow-sm">
                <p className="text-center text-[0.8em] font-black text-rk-success-950 tabular-nums">
                  残り時間 {formatRemainingMs(onlineTurnTimer.remainingMs)}
                </p>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-rk-success-200"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={REVERSI_ONLINE_TURN_FINAL_MS}
                  aria-valuenow={onlineTurnTimer.remainingMs}
                  aria-label="残り時間"
                >
                  <div
                    className="h-full rounded-full bg-rk-amber-400 transition-[width] duration-1000 linear"
                    style={{
                      width: `${Math.max(0, Math.min(100, (onlineTurnTimer.remainingMs / REVERSI_ONLINE_TURN_FINAL_MS) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {onlineActiveMatch ? (
              <RK02PrimaryTouchButton
                className="w-full"
                disabled={onlineBusy}
                onClick={promptOnlineInterrupt}
              >
                中断
              </RK02PrimaryTouchButton>
            ) : playKind === 'online' && view === 'play' ? null : (
              <div className="flex w-full items-stretch gap-2">
                <RK15HubMenuRowHalfW
                  fill
                  className="flex-1 min-w-0 min-h-[44px] px-2 text-[0.88em] bg-gradient-to-r from-rk-success-300 to-rk-success-300 border-rk-success-600/55 text-rk-success-950 shadow-md font-medium"
                  onClick={() => {
                    void handlePlayRestart();
                  }}
                >
                  <RotateCcw className="size-[1.1em] shrink-0" aria-hidden />
                  最初から
                </RK15HubMenuRowHalfW>
                <RK03GhostTouchButton
                  className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 text-[0.88em]"
                  disabled={
                    !canUndoLocal ||
                    cpuThinking ||
                    (gameOver && localHistoryRef.current.length === 0)
                  }
                  onClick={handleCpuUndo}
                >
                  <Undo2 className="size-[1.1em] shrink-0" aria-hidden />
                  一手戻す
                </RK03GhostTouchButton>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {sidePickOverlayMode && onlineRoom ? (
          <ReversiSidePickOverlay
            mode={sidePickOverlayMode}
            coin={
              onlineRoom.sidePickAnimMethod === 'coin' ||
              onlineRoom.sidePickMethod === 'coin' ||
              onlineRoom.sidePickAnimMethod === 'roulette' ||
              onlineRoom.sidePickMethod === 'roulette' ||
              normalizeReversiOnlineStartMode(onlineRoom.onlineStartMode) === 'coin'
            }
            myColor={mySidePickColor}
            host={onlineRoom.host}
            guest={onlineRoom.guest}
          />
        ) : null}
        {showNormalClearModal ? (
          <ClearModal
            winner={winner!}
            counts={counts}
            playKind={playKind}
            cpuDifficulty={cpuDifficulty}
            humanColor={humanColor}
            myOnlineColor={myOnlineColor}
            onlineRematchReady={onlineRematchReady}
            onlineBusy={onlineBusy}
            onAgain={() => {
              void handlePlayRestart();
            }}
            onMenu={() => {
              void handleClearModalMenu();
            }}
          />
        ) : null}
        {showInterruptConfirm ? (
          <OnlineInterruptConfirmModal
            busy={onlineBusy}
            onConfirm={() => {
              void confirmOnlineInterrupt();
            }}
            onCancel={() => setShowInterruptConfirm(false)}
          />
        ) : null}
        {onlineSessionNotice ? (
          <OnlineSessionNoticeModal
            notice={onlineSessionNotice}
            onOk={handleBackToMenu}
          />
        ) : null}
      </AnimatePresence>
    </RK05ImmersiveScreen>
  );
};

function ReversiStoneMark({ visual, flipped }: { visual: ReversiStoneVisual; flipped: boolean }) {
  return (
    <motion.span
      className={[
        'absolute inset-[12%] rounded-full shadow-sm border',
        visual.fill,
        visual.border,
      ].join(' ')}
      initial={flipped ? { scale: 0.6, rotateY: 90 } : false}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ duration: 0.18 }}
    />
  );
}

function SideBadge({
  profile,
  count,
  sideColor,
  myColor,
  prefs,
  label,
  onBreak = false,
}: {
  profile: SideProfile;
  count: number;
  sideColor: OthelloColor;
  myColor: OthelloColor | null;
  prefs: ReversiLocalViewPrefs;
  label: string;
}) {
  const visual = resolveReversiStoneVisual(sideColor, myColor, prefs);
  const isSelfSide = myColor != null && myColor === sideColor;

  return (
    <span
      className={[
        hubMenuBtnHalfWFill,
        'flex-col gap-1 border-rk-success-300/80 bg-rk-white/90 font-medium overflow-hidden',
      ].join(' ')}
    >
      <span className="flex items-center justify-center gap-1.5 min-w-0 max-w-full leading-none">
        <span className="text-[clamp(1rem,4.2vw,1.2rem)] shrink-0">{profile.emoji}</span>
        <span
          className={`text-[clamp(0.78rem,3.3vw,0.92rem)] font-bold truncate leading-tight ${isSelfSide ? RK_GATE_NICK_DISPLAY_CLASS : ''}`}
        >
          {profile.label}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[clamp(0.78rem,3.2vw,0.9rem)] tabular-nums leading-none">
        <span
          className={['inline-block size-3 rounded-full border shrink-0', visual.fill, visual.border].join(
            ' ',
          )}
          aria-hidden
        />
        {label} {count}
      </span>
    </span>
  );
}

function ReversiMySettingsPanel({
  prefs,
  onChange,
  onReset,
  onSave,
}: {
  prefs: ReversiLocalViewPrefs;
  onChange: (next: ReversiLocalViewPrefs) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className={`flex-1 min-h-0 w-full max-w-md overflow-y-auto py-3 space-y-3 ${REVERSI_SETTINGS_UI_TEXT}`}>
      <SettingsSection label="盤面の色">
        <div className="grid grid-cols-1 gap-1.5">
          {REVERSI_BOARD_THEMES.map((theme) => {
            const active = prefs.boardThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onChange({ ...prefs, boardThemeId: theme.id as ReversiBoardThemeId })}
                className={[
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left',
                  active
                    ? 'border-rk-success-700 bg-rk-success-100'
                    : 'border-rk-slate-300 bg-rk-white',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-flex size-10 shrink-0 rounded-md border-2 grid grid-cols-2 gap-px p-0.5',
                    theme.frameBorder,
                    theme.frameBg,
                  ].join(' ')}
                  aria-hidden
                >
                  <span className={['rounded-[1px]', theme.cellBg].join(' ')} />
                  <span className={['rounded-[1px]', theme.cellBg].join(' ')} />
                  <span className={['rounded-[1px]', theme.cellBg].join(' ')} />
                  <span className={['rounded-[1px]', theme.cellBg].join(' ')} />
                </span>
                <span className="font-medium text-rk-success-950">{theme.labelJa}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <div className="flex gap-2 pt-1">
        <RK03GhostTouchButton className="flex-1" onClick={onReset}>
          初期値に戻す
        </RK03GhostTouchButton>
        <RK02PrimaryTouchButton className="flex-1" onClick={onSave}>
          保存して閉じる
        </RK02PrimaryTouchButton>
      </div>
    </div>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-rk-success-300/80 bg-rk-white/92 p-3.5">
      <h3 className="font-black text-rk-success-950 mb-2 leading-snug">{label}</h3>
      {children}
    </section>
  );
}

function reversiLogResult(log: LogEntry): 'win' | 'lose' | 'draw' | null {
  const details = log.details as Record<string, unknown> | undefined;
  const stored = details?.result;
  if (stored === 'win' || stored === 'lose' || stored === 'draw') return stored;
  if (log.message.includes('勝ち')) return 'win';
  if (log.message.includes('負け')) return 'lose';
  if (log.message.includes('引き分け')) return 'draw';
  return null;
}

function buildReversiHostRecord(logs: LogEntry[]): ReversiHostRecord {
  const all = summarizeReversiMatchResults(logs);
  let onlineWins = 0;
  let onlineLosses = 0;
  let onlineDraws = 0;
  for (const log of logs) {
    const details = log.details as Record<string, unknown> | undefined;
    if (details?.playKind !== 'online') continue;
    const result = reversiLogResult(log);
    if (result === 'win') onlineWins += 1;
    else if (result === 'lose') onlineLosses += 1;
    else if (result === 'draw') onlineDraws += 1;
  }
  return {
    wins: all.wins,
    losses: all.losses,
    draws: all.draws,
    onlineWins,
    onlineLosses,
    onlineDraws,
  };
}

function OpenReversiRoomCard({
  room,
  busy,
  onJoin,
}: {
  room: ReversiRoomDoc;
  busy: boolean;
  onJoin: () => void;
}) {
  const strengthHint = reversiHostStrengthHintJa(room.hostRecord);
  const recordSummary = reversiHostRecordSummaryJa(room.hostRecord);
  const rules = reversiOpenRoomRulesJa(room);
  const waitingAge = reversiWaitingAgeJa(room.createdAt);

  return (
    <div className="rounded-lg border border-rk-success-200 bg-rk-success-50/70 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-rk-success-950 leading-snug truncate">
            {room.host.emoji} {room.host.name}
          </p>
        </div>
        <span className="shrink-0 text-rk-success-900/55 tabular-nums">{waitingAge}</span>
      </div>
      {room.recruitComment ? (
        <p className="mt-1.5 font-medium text-rk-success-950 leading-snug">{room.recruitComment}</p>
      ) : null}
      <p className="mt-1.5 text-rk-success-900/80 leading-snug">{recordSummary}</p>
      {strengthHint ? (
        <p className="mt-0.5 font-bold text-rk-amber-900/85">{strengthHint}</p>
      ) : null}
      <p className="mt-1 text-rk-success-900/65 leading-snug">{rules}</p>
      <RK02PrimaryTouchButton className="mt-2 w-full" disabled={busy} onClick={onJoin}>
        このルームに参加
      </RK02PrimaryTouchButton>
    </div>
  );
}

function ReversiSidePickOverlay({
  mode,
  coin,
  myColor,
  host,
  guest,
}: {
  mode: 'anim' | 'reveal';
  coin: boolean;
  myColor: OthelloColor | null;
  host: ReversiRoomDoc['host'];
  guest?: ReversiRoomDoc['guest'];
}) {
  const isBlack = myColor === 'black';
  const isWhite = myColor === 'white';

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-rk-success-950/55 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-rk-success-300/80 bg-rk-white/95 p-6 text-center shadow-xl"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
      >
        {mode === 'anim' ? (
          <>
            <p className="text-[1.05em] font-black text-rk-success-950 mb-4">
              コインで先後を決定中…
            </p>
            <motion.div
              className="mx-auto flex size-28 items-center justify-center rounded-full border-4 border-rk-amber-500 bg-gradient-to-b from-rk-amber-200 to-rk-amber-400 text-5xl shadow-lg"
              animate={{ rotateY: [0, 360, 720, 1080], scale: [1, 1.08, 1] }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
            >
              🪙
            </motion.div>
            <p className="mt-5 text-[0.88em] font-medium text-rk-success-900/70 leading-snug">
              {host.emoji} {host.name} と {guest?.emoji ?? '👤'} {guest?.name ?? '相手'}
              <br />
              お待ちください…
            </p>
          </>
        ) : (
          <>
            <p className="text-[0.9em] font-black text-rk-amber-900 mb-2">
              {coin ? '🪙 コインの結果' : '先後が決まりました'}
            </p>
            {isBlack ? (
              <div className="space-y-2">
                <p className="text-[1.35em] font-black text-rk-slate-900">あなたは 黒（先手）</p>
                <span className="inline-flex size-14 items-center justify-center rounded-full border-4 border-rk-slate-700 bg-rk-slate-900 shadow-md" />
                <p className="text-[0.88em] font-bold text-rk-success-900/75">先攻でスタートします</p>
              </div>
            ) : isWhite ? (
              <div className="space-y-2">
                <p className="text-[1.35em] font-black text-rk-slate-800">あなたは 白（後攻）</p>
                <span className="inline-flex size-14 items-center justify-center rounded-full border-4 border-rk-slate-300 bg-rk-white shadow-md" />
                <p className="text-[0.88em] font-bold text-rk-success-900/75">後攻でスタートします</p>
              </div>
            ) : (
              <p className="text-[0.95em] font-bold text-rk-success-950">先後が決まりました</p>
            )}
            <p className="mt-4 text-[0.82em] text-rk-success-900/65">まもなく対局が始まります…</p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function ReversiRadioOption({
  name,
  value,
  checked,
  label,
  hint,
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
        checked ? 'border-rk-success-700 bg-rk-success-100' : 'border-rk-slate-300 bg-rk-white',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-rk-success-700"
      />
      <span className="min-w-0 text-left">
        <span className="block font-black text-rk-success-950">{label}</span>
        {hint ? (
          <span className="block text-[0.88em] font-medium text-rk-success-900/70 mt-0.5">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function ReversiRecruitComposer({
  draft,
  busy,
  onChange,
  onReset,
  onSaveDefaults,
  onSubmit,
}: {
  draft: ReversiRoomDefaults;
  busy: boolean;
  onChange: (next: ReversiRoomDefaults) => void;
  onReset: () => void;
  onSaveDefaults: () => void;
  onSubmit: () => void;
}) {
  const startModes: ReversiOnlineStartMode[] = ['default_black', 'guest_black', 'coin'];

  return (
    <div className={`flex-1 min-h-0 flex flex-col gap-3 ${REVERSI_ONLINE_UI_TEXT}`}>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-rk-success-300/80 bg-rk-white/90 p-3 space-y-3">
        <SettingsSection label="先攻・後攻の決め方">
          <fieldset className="space-y-1.5 border-0 p-0 m-0">
            {startModes.map((mode) => (
              <ReversiRadioOption
                key={mode}
                name="reversi-online-start-mode"
                value={mode}
                checked={draft.onlineStartMode === mode}
                label={reversiOnlineStartModeLabelJa(mode)}
                hint={reversiOnlineStartModeHintJa(mode)}
                onSelect={() => onChange({ ...draft, onlineStartMode: mode })}
              />
            ))}
          </fieldset>
        </SettingsSection>

        <SettingsSection label="角ハンデ（0〜4）">
          <div className="flex gap-1.5 flex-wrap">
            {([0, 1, 2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ ...draft, handicapCorners: n })}
                className={[
                  'min-w-10 rounded-lg border px-2 py-1.5 font-bold',
                  draft.handicapCorners === n
                    ? 'border-rk-success-700 bg-rk-success-200 text-rk-success-950'
                    : 'border-rk-slate-300 bg-rk-white',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[0.78em] text-rk-success-900/65 mt-1.5">
            参加側（後攻側）の角に石を置いて調整します
          </p>
        </SettingsSection>

        <SettingsSection label="コメント（任意）">
          <textarea
            value={draft.recruitComment}
            onChange={(e) =>
              onChange({
                ...draft,
                recruitComment: normalizeReversiRecruitComment(e.target.value),
              })
            }
            placeholder="お気楽にどうぞ。"
            rows={3}
            maxLength={REVERSI_RECRUIT_COMMENT_MAX}
            className="w-full rounded-lg border border-rk-slate-300 px-3 py-2 leading-snug resize-none"
          />
          <p className="mt-1 text-rk-success-900/55 text-right tabular-nums">
            {draft.recruitComment.length}/{REVERSI_RECRUIT_COMMENT_MAX}
          </p>
        </SettingsSection>
      </div>

      <RK02PrimaryTouchButton
        className={`w-full shrink-0 ${REVERSI_MENU_PRIMARY_BORDER}`}
        disabled={busy}
        onClick={onSubmit}
      >
        募集を開始
      </RK02PrimaryTouchButton>
      <div className="flex gap-2 shrink-0">
        <RK03GhostTouchButton className="flex-1" disabled={busy} onClick={onReset}>
          初期値に戻す
        </RK03GhostTouchButton>
        <RK03GhostTouchButton className="flex-1" disabled={busy} onClick={onSaveDefaults}>
          自分の設定として保存
        </RK03GhostTouchButton>
      </div>
    </div>
  );
}

function summarizeReversiMatchResults(logs: LogEntry[]): {
  wins: number;
  losses: number;
  draws: number;
} {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const log of logs) {
    const result = reversiLogResult(log);
    if (result === 'win') wins += 1;
    else if (result === 'lose') losses += 1;
    else if (result === 'draw') draws += 1;
  }
  return { wins, losses, draws };
}

function reversiLogHandicapLabel(log: LogEntry): string | null {
  const details = log.details as Record<string, unknown> | undefined;
  if (!details) return null;
  if (typeof details.handicapLabel === 'string') return details.handicapLabel;
  const corners =
    typeof details.handicapCorners === 'number'
      ? details.handicapCorners
      : typeof details.handicap === 'number'
        ? details.handicap
        : null;
  if (corners == null) return null;
  return reversiHandicapLogLabelJa(corners);
}

function LogsPanel({
  logs,
  isLoggedIn,
  onLogin,
  onDone,
}: {
  logs: LogEntry[];
  isLoggedIn: boolean;
  onLogin: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 w-full max-w-md flex flex-col py-3">
      {!isLoggedIn ? (
        <div className="rounded-xl border border-rk-amber-300 bg-rk-amber-50 p-4 text-center space-y-3 mb-3">
          <p className="text-[0.85em] text-rk-amber-950 leading-snug">
            対戦記録はログインした人だけ残ります。
          </p>
          <RK02PrimaryTouchButton className="w-full" onClick={onLogin}>
            Googleでログイン
          </RK02PrimaryTouchButton>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 rounded-xl border border-rk-success-300/80 bg-rk-white/90 p-2">
        {logs.length === 0 ? (
          <p className="text-[0.82em] text-center text-rk-success-900/65 py-8">
            {isLoggedIn ? 'まだ記録がありません' : 'ログイン後に記録されます'}
          </p>
        ) : (
          logs.map((log) => {
            const handicapLabel = reversiLogHandicapLabel(log);
            return (
            <div
              key={log.id}
              className="rounded-lg border border-rk-slate-200 bg-rk-slate-50/80 px-3 py-2 text-[0.78em]"
            >
              <div className="flex items-center gap-1.5 font-bold text-rk-slate-800">
                <span>{log.emoji ?? '♟️'}</span>
                <span className="tabular-nums text-rk-slate-500 font-medium">{log.timestamp}</span>
              </div>
              <p className="mt-0.5 text-rk-slate-800 leading-snug">{log.message}</p>
              {handicapLabel ? (
                <p className="mt-0.5 text-rk-slate-600 leading-snug">
                  ハンデ：{handicapLabel}
                </p>
              ) : null}
            </div>
            );
          })
        )}
      </div>
      <RK02PrimaryTouchButton className="w-full mt-3 shrink-0" onClick={onDone}>
        もどる
      </RK02PrimaryTouchButton>
    </div>
  );
}

function ClearModal({
  winner,
  counts,
  playKind,
  cpuDifficulty,
  humanColor,
  myOnlineColor,
  onlineRematchReady,
  onlineBusy,
  onAgain,
  onMenu,
}: {
  winner: OthelloWinner;
  counts: { black: number; white: number };
  playKind: PlayKind;
  cpuDifficulty: OthelloCpuDifficulty;
  humanColor: OthelloColor;
  myOnlineColor: OthelloColor | null;
  onlineRematchReady: { mine: boolean; opponent: boolean };
  onlineBusy: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const humanResult =
    playKind === 'cpu'
      ? winner === 'draw'
        ? 'draw'
        : winner === humanColor
          ? 'win'
          : 'lose'
      : playKind === 'online' && myOnlineColor
        ? winner === 'draw'
          ? 'draw'
          : winner === myOnlineColor
            ? 'win'
            : 'lose'
        : 'draw';

  const title =
    humanResult === 'win' ? '勝ち！' : humanResult === 'lose' ? '負け…' : '引き分け';

  const againLabel =
    playKind === 'online' && onlineRematchReady.mine && !onlineRematchReady.opponent
      ? '相手を待っています…'
      : 'もう一局';
  const againDisabled =
    onlineBusy || (playKind === 'online' && onlineRematchReady.mine && !onlineRematchReady.opponent);

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+6.5rem)] pb-3 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md pointer-events-auto rounded-2xl border border-rk-success-200 bg-rk-white/97 p-3.5 text-center shadow-xl backdrop-blur-sm"
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -8, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reversi-clear-title"
      >
        <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-rk-success-100 text-rk-success-700">
          <Sparkles className="size-[1.25em]" aria-hidden />
        </div>
        <h2 id="reversi-clear-title" className="text-[1.05em] font-black text-rk-success-950">{title}</h2>
        <p className="mt-1 text-[0.88em] text-rk-success-900/80">
          {winnerMessage(winner, counts.black, counts.white)}
        </p>
        {playKind === 'cpu' ? (
          <p className="mt-0.5 text-[0.75em] text-rk-success-900/60">
            {RAKUDA_ROBO_EMOJI} {othelloCpuDifficultyLabelJa(cpuDifficulty)}
          </p>
        ) : null}
        {playKind === 'online' && onlineRematchReady.opponent && !onlineRematchReady.mine ? (
          <p className="mt-0.5 text-[0.75em] text-rk-success-900/65">相手が再戦を希望しています</p>
        ) : null}
        {playKind === 'online' ? (
          <p className="mt-0.5 text-[0.72em] text-rk-success-900/55">
            相手に「{REVERSI_MATCH_THANKS_TEXT}」を送りました
          </p>
        ) : playKind === 'cpu' ? (
          <p className="mt-0.5 text-[0.72em] text-rk-success-900/55">
            {RAKUDA_ROBO_EMOJI}{RAKUDA_ROBO_NAME}に「{REVERSI_MATCH_THANKS_TEXT}」を送りました
          </p>
        ) : null}
        {playKind === 'cpu' && humanResult === 'win' ? (
          <div className="mt-2.5 text-left">
            <LiveClearReportSoloPanel kind="reversi" vibrate={vibrate} />
          </div>
        ) : null}
        <div className="mt-2.5 flex gap-2">
          <RK02PrimaryTouchButton
            className="flex-1 min-w-0 min-h-11 py-2.5"
            disabled={againDisabled}
            onClick={onAgain}
          >
            {againLabel}
          </RK02PrimaryTouchButton>
          <RK03GhostTouchButton className="flex-1 min-w-0 min-h-11 py-2.5" onClick={onMenu}>
            メニューへ
          </RK03GhostTouchButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function onlineSessionNoticeMessage(notice: OnlineSessionNotice): string {
  switch (notice) {
    case 'opponent_left':
      return '対戦相手がルームから抜けました';
    case 'interrupted':
      return '相手の都合によりプレイが中断されました';
    case 'timeout':
      return '制限時間を過ぎたため、対局を終了しました';
  }
}

function OnlineInterruptConfirmModal({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-rk-success-950/35 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-rk-success-200 bg-rk-white p-4 text-center shadow-xl"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reversi-interrupt-title"
      >
        <h2 id="reversi-interrupt-title" className="text-[1em] font-black text-rk-success-950 leading-snug">
          プレイを中断し相手に伝える
        </h2>
        <div className="mt-4 flex gap-2">
          <RK03GhostTouchButton className="flex-1" disabled={busy} onClick={onCancel}>
            キャンセル
          </RK03GhostTouchButton>
          <RK02PrimaryTouchButton className="flex-1" disabled={busy} onClick={onConfirm}>
            OK
          </RK02PrimaryTouchButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OnlineSessionNoticeModal({
  notice,
  onOk,
}: {
  notice: OnlineSessionNotice;
  onOk: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-rk-success-950/35 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-rk-success-200 bg-rk-white p-4 text-center shadow-xl"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reversi-session-notice-title"
      >
        <h2 id="reversi-session-notice-title" className="text-[1em] font-black text-rk-success-950 leading-snug">
          {onlineSessionNoticeMessage(notice)}
        </h2>
        <RK02PrimaryTouchButton className="mt-4 w-full" onClick={onOk}>
          リバーシに戻る
        </RK02PrimaryTouchButton>
      </motion.div>
    </motion.div>
  );
}

export default OthelloGame;
