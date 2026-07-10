import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { BookOpen, RotateCcw, Swords, Undo2 } from 'lucide-react';
import type { LogEntry } from '../../types';
import {
  applyGomokuMove,
  createGomokuStartBoard,
  getGomokuWinnerAfterMove,
  gomokuBoardSizeLabelJa,
  gomokuCellKey,
  gomokuColorLabelJa,
  gomokuCoordLabel,
  gomokuCpuDifficultyLabelJa,
  gomokuHandicapHintJa,
  gomokuHandicapLabelJa,
  gomokuOpponent,
  gomokuStarPoints,
  gomokuWinnerMessage,
  isValidGomokuMove,
  pickGomokuCpuMove,
  GOMOKU_HANDICAP_OPTIONS,
  type GomokuBoardSize,
  type GomokuCell,
  type GomokuColor,
  type GomokuCpuDifficulty,
  type GomokuHandicapStones,
  type GomokuOpponent,
  type GomokuWinner,
} from '../../lib/gomokuLogic';
import {
  loadGomokuSettings,
  saveGomokuSettings,
  type GomokuGameSettings,
} from '../../lib/gomokuPrefs';
import { boardGridColumnLabel, measureCoordGutter } from '../../lib/boardGridCoordinates';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME } from '../../lib/reversiConfig';
import {
  GOMOKU_DEFAULT_ROOM_DEFAULTS,
  GOMOKU_RECRUIT_BADGE_CLASS,
  GOMOKU_RECRUIT_HOST_BADGE_CLASS,
  loadGomokuPendingHostRoomCode,
  loadGomokuRoomDefaults,
  saveGomokuPendingHostRoomCode,
  saveGomokuRoomDefaults,
  gomokuOnlineStartModeLabelJa,
  isGomokuPresetSideAssignMode,
  normalizeGomokuOnlineStartMode,
  type GomokuRoomDefaults,
} from '../../lib/gomokuConfig';
import {
  buildGomokuHostRecord,
  summarizeGomokuMatchResults,
} from '../../lib/gomokuMatchLog';
import {
  clearBoardGameRenrakuRecruit,
  consumeBoardGamePendingJoinRoomCode,
  ensureBoardGameRenrakuRecruit,
  publishBoardGameRenrakuRecruit,
  shouldClearBoardGameRenrakuRecruit,
} from '../../lib/boardGameRenrakuRecruit';
import {
  abandonGomokuRoom,
  beginGomokuRoomPlay,
  colorForGomokuUid,
  commitGomokuSidePick,
  createGomokuRoom,
  deserializeGomokuBoard,
  gomokuHandicapKeysSet,
  joinGomokuRoom,
  signalGomokuSidePickAnim,
  subscribeGomokuRoom,
  subscribeOpenGomokuRooms,
  submitGomokuRoomMove,
  type GomokuRoomDoc,
} from '../../lib/gomokuRooms';
import {
  GomokuLogsPanel,
  GomokuRecruitComposer,
  GomokuSidePickOverlay,
  OpenGomokuRoomCard,
} from './GomokuOnlineLobby';
import { RK19QuietRoomBackButton, RK02PrimaryTouchButton, RK03GhostTouchButton } from '../../ui/baselineParts';
import {
  btnGhostTouch,
  btnPrimaryTouch,
  immersiveContentWidth,
  immersiveHeader,
  immersiveKicker,
  immersiveSubtitle,
  immersiveTitle,
} from '../../ui/policy';
import { vibrate } from '../../lib/utils';
import LiveClearReportSoloPanel from '../../components/LiveClearReportSoloPanel';

type GomokuView = 'menu' | 'cpu-setup' | 'play' | 'online-lobby' | 'logs';
type PlayKind = 'cpu' | 'local' | 'online';

type MoveRecord = { row: number; col: number; color: GomokuColor };

interface GomokuGameProps {
  onBack: () => void;
  nickname?: string;
  userEmoji?: string;
  firebaseUser?: { uid: string } | null;
  addLog?: (
    type: LogEntry['type'],
    tag: string,
    message: string,
    details?: unknown,
    emoji?: string,
  ) => void;
  logs?: LogEntry[];
  onGoogleLogin?: () => void;
  onRecordShussekiGamePlay?: () => number;
  streamMode?: boolean;
  coordOverlayEnabled?: boolean;
}

const CPU_DELAY_MS = 480;
const GRID_PAD_PX = 6;
const SIDE_PICK_ANIM_MS = 2200;
const SIDE_PICK_REVEAL_MS = 3000;

function gomokuCellStep(boardPx: number, size: number): number {
  const inner = boardPx - GRID_PAD_PX * 2;
  return inner / Math.max(1, size - 1);
}

function measureGomokuLayout(areaPx: number, size: number, showCoords: boolean) {
  const areaFloor = Math.floor(areaPx);
  if (!showCoords) {
    const boardPx = areaFloor;
    return {
      wrapWidth: boardPx,
      wrapHeight: boardPx,
      boardPx,
      gutter: { left: 0, top: 0, fontSize: 12 },
      cellStep: gomokuCellStep(boardPx, size),
      gridOriginX: GRID_PAD_PX,
      gridOriginY: GRID_PAD_PX,
    };
  }
  let boardPx = areaFloor;
  let cellStep = gomokuCellStep(boardPx, size);
  let gutter = measureCoordGutter(cellStep);
  boardPx = Math.max(size * 8, areaFloor - Math.max(gutter.left, gutter.top));
  cellStep = gomokuCellStep(boardPx, size);
  gutter = measureCoordGutter(cellStep);
  boardPx = Math.max(size * 8, areaFloor - Math.max(gutter.left, gutter.top));
  cellStep = gomokuCellStep(boardPx, size);
  gutter = measureCoordGutter(cellStep);
  return {
    wrapWidth: boardPx + gutter.left,
    wrapHeight: boardPx + gutter.top,
    boardPx,
    gutter,
    cellStep,
    gridOriginX: gutter.left + GRID_PAD_PX,
    gridOriginY: gutter.top + GRID_PAD_PX,
  };
}

function gomokuIntersectionHitPx(cellStep: number): number {
  return Math.min(48, Math.max(28, cellStep * 0.9));
}

function RadioRow(props: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  hint?: string;
  onSelect: () => void;
  dark?: boolean;
}) {
  const { name, value, checked, label, hint, onSelect, dark = false } = props;
  return (
    <label
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer border ${
        checked
          ? dark
            ? 'bg-rk-slate-800 text-rk-white border-rk-slate-700'
            : 'bg-rk-amber-50 border-rk-amber-300'
          : 'bg-rk-white border-rk-slate-200'
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="size-4" />
      <span className="font-bold">
        {label}
        {hint ? <span className="block text-[10px] font-medium opacity-75 mt-0.5">{hint}</span> : null}
      </span>
    </label>
  );
}

const GomokuGame: React.FC<GomokuGameProps> = ({
  onBack,
  nickname = 'ゲスト',
  userEmoji = '🙂',
  firebaseUser = null,
  addLog,
  logs = [],
  onGoogleLogin = () => {},
  onRecordShussekiGamePlay,
  streamMode = false,
  coordOverlayEnabled = false,
}) => {
  const [view, setView] = useState<GomokuView>('menu');
  const [playKind, setPlayKind] = useState<PlayKind>('cpu');
  const [roomDefaults, setRoomDefaults] = useState<GomokuRoomDefaults>(() => loadGomokuRoomDefaults());
  const [roomDraft, setRoomDraft] = useState<GomokuRoomDefaults>(() => loadGomokuRoomDefaults());
  const [roomCode, setRoomCode] = useState('');
  const [composingRecruit, setComposingRecruit] = useState(false);
  const [onlineRoom, setOnlineRoom] = useState<GomokuRoomDoc | null>(null);
  const [openWaitingRooms, setOpenWaitingRooms] = useState<GomokuRoomDoc[]>([]);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [sidePickBusy, setSidePickBusy] = useState(false);
  const [loggedOnce, setLoggedOnce] = useState(false);
  const [showInterruptConfirm, setShowInterruptConfirm] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const coinAutoStartedRef = useRef<string | null>(null);
  const defaultRevealStartedRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<GomokuGameSettings>(() => loadGomokuSettings());
  const [settings, setSettings] = useState<GomokuGameSettings>(() => loadGomokuSettings());
  const initial = useMemo(
    () => createGomokuStartBoard(settings.boardSize, settings.handicapStones, settings.handicapBeneficiary),
    [],
  );
  const [board, setBoard] = useState<GomokuCell[][]>(() => initial.board);
  const [handicapKeys, setHandicapKeys] = useState<Set<string>>(() => new Set(initial.handicapKeys));
  const [turn, setTurn] = useState<GomokuColor>('black');
  const [winner, setWinner] = useState<GomokuWinner>(null);
  const [history, setHistory] = useState<MoveRecord[]>([]);
  const [lastCoord, setLastCoord] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [areaPx, setAreaPx] = useState(320);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const shussekiRecordedRef = useRef(false);

  const gomokuLogs = useMemo(() => logs.filter((l) => l.tag === 'GOMOKU').slice(0, 40), [logs]);
  const gomokuLogSummary = useMemo(() => summarizeGomokuMatchResults(gomokuLogs), [gomokuLogs]);
  const myOnlineColor = useMemo(
    () => (onlineRoom ? colorForGomokuUid(onlineRoom, firebaseUser?.uid ?? null) : null),
    [firebaseUser?.uid, onlineRoom],
  );

  const size =
    playKind === 'online' && onlineRoom ? onlineRoom.boardSize : settings.boardSize;
  const showCoordLayer = streamMode || coordOverlayEnabled || settings.showCoords;
  const layout = useMemo(
    () => measureGomokuLayout(areaPx, size, showCoordLayer),
    [areaPx, showCoordLayer, size],
  );
  const { boardPx, gutter, cellStep, wrapWidth, wrapHeight } = layout;
  const intersectionHitPx = gomokuIntersectionHitPx(cellStep);
  const stonePx = Math.max(14, Math.min(28, cellStep * 0.82));
  const stars = useMemo(() => gomokuStarPoints(size), [size]);

  const humanTurn = useMemo(() => {
    if (playKind === 'online') {
      return !!myOnlineColor && turn === myOnlineColor && onlineRoom?.status === 'playing';
    }
    if (settings.opponent === 'human') return true;
    return turn === settings.humanColor;
  }, [myOnlineColor, onlineRoom?.status, playKind, settings.humanColor, settings.opponent, turn]);

  const handicapSummary = useMemo(() => {
    if (playKind === 'online' && onlineRoom) {
      const h = onlineRoom.settings.handicapStones;
      if (h <= 0) return '';
      return `星ハンデ${h}（${gomokuColorLabelJa(onlineRoom.settings.handicapBeneficiary)}）`;
    }
    if (settings.handicapStones <= 0) return '';
    return `星ハンデ${settings.handicapStones}（${gomokuColorLabelJa(settings.handicapBeneficiary)}）`;
  }, [onlineRoom, playKind, settings.handicapBeneficiary, settings.handicapStones]);

  const onlineWinMessage = useMemo(() => {
    if (!winner || playKind !== 'online' || !myOnlineColor) return '';
    if (winner === myOnlineColor) return 'あなたの勝ちです。';
    return '負けました。';
  }, [myOnlineColor, playKind, winner]);

  const isMyHostWaiting = useMemo(
    () =>
      !!firebaseUser &&
      !!roomCode &&
      onlineRoom?.status === 'waiting' &&
      onlineRoom.host.uid === firebaseUser.uid,
    [firebaseUser, onlineRoom, roomCode],
  );

  const joinableOpenRooms = useMemo(() => {
    const myUid = firebaseUser?.uid;
    return openWaitingRooms.filter((room) => !myUid || room.host.uid !== myUid);
  }, [firebaseUser?.uid, openWaitingRooms]);

  const onlineActiveMatch = useMemo(
    () =>
      playKind === 'online' &&
      view === 'play' &&
      !winner &&
      onlineRoom?.status === 'playing',
    [onlineRoom?.status, playKind, view, winner],
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
    () => (onlineRoom ? colorForGomokuUid(onlineRoom, firebaseUser?.uid ?? null) : null),
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

  const statusLine = useMemo(() => {
    if (winner) return '';
    if (playKind === 'online' && onlineRoom?.status === 'playing') {
      const opp =
        firebaseUser?.uid === onlineRoom.host.uid ? onlineRoom.guest : onlineRoom.host;
      if (!humanTurn && opp) {
        return `${opp.emoji} ${opp.name}が考えています…`;
      }
    }
    if (settings.opponent === 'cpu' && thinking) return `${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}が考えています…`;
    const coordPart = lastCoord ? `${lastCoord} · ` : '';
    if (playKind === 'online') {
      return humanTurn ? `${coordPart}あなたの番です` : `${coordPart}相手の番です`;
    }
    if (settings.opponent === 'human') return `${coordPart}${gomokuColorLabelJa(turn)}の番です`;
    if (humanTurn) return `${coordPart}あなたの番です`;
    return `${coordPart}${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}の番です`;
  }, [firebaseUser?.uid, humanTurn, lastCoord, onlineRoom, playKind, settings.opponent, thinking, turn, winner]);

  useEffect(() => {
    const pending = loadGomokuPendingHostRoomCode();
    if (!pending) return;
    setPlayKind('online');
    setRoomCode(pending);
  }, []);

  useEffect(() => {
    if (view !== 'menu' && view !== 'online-lobby') return;
    if (roomCode) return;
    const unsub = subscribeOpenGomokuRooms(setOpenWaitingRooms);
    return unsub;
  }, [roomCode, view]);

  useEffect(() => {
    coinAutoStartedRef.current = null;
    defaultRevealStartedRef.current = null;
  }, [roomCode]);

  useEffect(() => {
    if (playKind !== 'online' || !roomCode) {
      setOnlineRoom(null);
      return;
    }
    setOnlineRoom(null);
    const unsub = subscribeGomokuRoom(roomCode, (room) => {
      setOnlineRoom(room);
      if (room) {
        setBoard(deserializeGomokuBoard(room.board, room.boardSize));
        setHandicapKeys(gomokuHandicapKeysSet(room.handicapKeys));
        setTurn(room.turn);
        setLastCoord(room.lastMoveCoord ?? null);
        setWinner(room.winner ?? null);
        const myUid = firebaseUser?.uid;
        const isMember = !!myUid && (room.host.uid === myUid || room.guest?.uid === myUid);
        if (isMember && room.guest) {
          setPlayKind('online');
          if (room.status === 'playing') {
            saveGomokuPendingHostRoomCode('');
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
        saveGomokuPendingHostRoomCode('');
      }
    });
    return unsub;
  }, [firebaseUser?.uid, playKind, roomCode]);

  useEffect(() => {
    if (!firebaseUser || !onlineRoom || !roomCode) return;
    if (onlineRoom.host.uid !== firebaseUser.uid) return;
    if (onlineRoom.status === 'waiting') {
      saveGomokuPendingHostRoomCode(roomCode);
      return;
    }
    saveGomokuPendingHostRoomCode('');
  }, [firebaseUser, onlineRoom, roomCode]);

  const recordMatch = useCallback(
    (result: 'win' | 'lose' | 'draw', detail: Record<string, unknown>) => {
      if (!firebaseUser || !addLog || loggedOnce) return;
      setLoggedOnce(true);
      const resultJa = result === 'win' ? '勝ち' : result === 'lose' ? '負け' : '引き分け';
      const endNoteJa = typeof detail.endNoteJa === 'string' ? detail.endNoteJa : '';
      const noteSuffix = endNoteJa ? ` · ${endNoteJa}` : '';
      addLog(
        'LIVE_REPORT',
        'GOMOKU',
        `${detail.modeLabel ?? '五目並べ'} — ${resultJa}${noteSuffix}`,
        { ...detail, result },
        (detail.emoji as string) ?? '⚫',
      );
    },
    [addLog, firebaseUser, loggedOnce],
  );

  useEffect(() => {
    if (view !== 'play' || !winner) return;
    if (playKind === 'cpu') {
      const humanWon =
        winner === settings.humanColor ? 'win' : 'lose';
      recordMatch(humanWon, {
        modeLabel: `${RAKUDA_ROBO_NAME}(${gomokuCpuDifficultyLabelJa(settings.difficulty)})`,
        emoji: humanWon === 'win' ? userEmoji : RAKUDA_ROBO_EMOJI,
        playKind: 'cpu',
        difficulty: settings.difficulty,
        humanColor: settings.humanColor,
        boardSize: settings.boardSize,
        handicapStones: settings.handicapStones,
      });
    } else if (playKind === 'online' && myOnlineColor) {
      if (onlineRoom?.endReason === 'abandoned') return;
      const humanWon = winner === myOnlineColor ? 'win' : 'lose';
      recordMatch(humanWon, {
        modeLabel: 'オンライン1対1',
        emoji: humanWon === 'win' ? userEmoji : '🌐',
        playKind: 'online',
        roomCode,
        myColor: myOnlineColor,
        boardSize: onlineRoom?.settings.boardSize ?? settings.boardSize,
        handicapStones: onlineRoom?.settings.handicapStones ?? 0,
      });
    }
  }, [
    myOnlineColor,
    onlineRoom?.endReason,
    onlineRoom?.settings.boardSize,
    onlineRoom?.settings.handicapStones,
    playKind,
    recordMatch,
    roomCode,
    settings.boardSize,
    settings.difficulty,
    settings.handicapStones,
    settings.humanColor,
    userEmoji,
    view,
    winner,
  ]);

  useEffect(() => {
    if (playKind !== 'online' || view !== 'play' || !firebaseUser || !myOnlineColor) return;
    if (
      onlineRoom?.status === 'finished' &&
      onlineRoom.endReason === 'abandoned' &&
      onlineRoom.endedBy !== firebaseUser.uid
    ) {
      recordMatch('win', {
        modeLabel: 'オンライン1対1',
        emoji: userEmoji,
        playKind: 'online',
        roomCode,
        myColor: myOnlineColor,
        endNoteJa: '相手中断',
        endKind: 'abandoned',
      });
    }
  }, [firebaseUser, myOnlineColor, onlineRoom, playKind, recordMatch, roomCode, userEmoji, view]);

  const handleBackToMenu = useCallback(() => {
    vibrate(8);
    setShowInterruptConfirm(false);
    if (playKind === 'online' && roomCode && firebaseUser) {
      void abandonGomokuRoom(roomCode, firebaseUser.uid);
    }
    saveGomokuPendingHostRoomCode('');
    setRoomCode('');
    setComposingRecruit(false);
    setOnlineRoom(null);
    setLoggedOnce(false);
    setView('menu');
  }, [firebaseUser, playKind, roomCode]);

  const handleCreateOnlineRoom = useCallback(async () => {
    if (!firebaseUser) {
      onGoogleLogin();
      return;
    }
    setOnlineBusy(true);
    try {
      const hostRecord = buildGomokuHostRecord(gomokuLogs);
      const settingsPayload = {
        boardSize: roomDraft.boardSize,
        handicapStones: roomDraft.handicapStones,
        handicapBeneficiary: roomDraft.handicapBeneficiary,
      };
      const code = await createGomokuRoom(
        { uid: firebaseUser.uid, name: nickname, emoji: userEmoji },
        settingsPayload,
        hostRecord,
        roomDraft.onlineStartMode,
        roomDraft.recruitComment,
      );
      setPlayKind('online');
      setRoomCode(code);
      saveGomokuPendingHostRoomCode(code);
      setLoggedOnce(false);
      setComposingRecruit(false);
      setView('online-lobby');
      vibrate(10);
      try {
        await publishBoardGameRenrakuRecruit({
          kind: 'gomoku',
          roomCode: code,
          nickname,
          uid: firebaseUser.uid,
          recruitComment: roomDraft.recruitComment,
        });
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '掲示板に募集を出しました！' }));
      } catch (e) {
        console.warn('[GomokuGame] renraku recruit failed', e);
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: '掲示板への募集に失敗しました（Googleログインを確認）' }),
        );
      }
    } catch {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'ルーム作成に失敗しました' }));
    } finally {
      setOnlineBusy(false);
    }
  }, [firebaseUser, gomokuLogs, nickname, onGoogleLogin, roomDraft, userEmoji]);

  const openRecruitComposer = useCallback(() => {
    if (!firebaseUser) {
      onGoogleLogin();
      return;
    }
    vibrate(8);
    setRoomDraft(loadGomokuRoomDefaults());
    setComposingRecruit(true);
    setView('online-lobby');
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
        const res = await joinGomokuRoom(code, {
          uid: firebaseUser.uid,
          name: nickname,
          emoji: userEmoji,
        });
        if (res === 'ok') {
          setPlayKind('online');
          setRoomCode(code);
          setLoggedOnce(false);
          setView('online-lobby');
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
    const pendingCode = consumeBoardGamePendingJoinRoomCode('gomoku');
    if (!pendingCode) return;
    void handleJoinOnlineRoomByCode(pendingCode);
  }, [firebaseUser, handleJoinOnlineRoomByCode]);

  useEffect(() => {
    if (!roomCode || !onlineRoom || !firebaseUser) return;
    if (!shouldClearBoardGameRenrakuRecruit(roomCode, onlineRoom, firebaseUser.uid)) return;
    void clearBoardGameRenrakuRecruit('gomoku', roomCode);
  }, [firebaseUser, onlineRoom, roomCode]);

  useEffect(() => {
    if (playKind !== 'online' || !roomCode || !onlineRoom || !firebaseUser) return;
    if (!roomCode || onlineRoom.roomCode?.toUpperCase() !== roomCode.toUpperCase()) return;
    if (onlineRoom.host.uid !== firebaseUser.uid) return;
    if (onlineRoom.status !== 'waiting' || onlineRoom.guest?.uid) return;
    void ensureBoardGameRenrakuRecruit({
      kind: 'gomoku',
      roomCode,
      nickname,
      uid: firebaseUser.uid,
      recruitComment: onlineRoom.recruitComment,
    });
  }, [firebaseUser, nickname, onlineRoom, playKind, roomCode]);

  const retreatFromOnlineLobby = useCallback(() => {
    vibrate(8);
    if (isMyHostWaiting && roomCode) {
      saveGomokuPendingHostRoomCode(roomCode);
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
      await clearBoardGameRenrakuRecruit('gomoku', roomCode);
      await abandonGomokuRoom(roomCode, firebaseUser.uid);
      saveGomokuPendingHostRoomCode('');
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
      await abandonGomokuRoom(roomCode, firebaseUser.uid);
    }
    handleBackToMenu();
  }, [firebaseUser, handleBackToMenu, isMyHostWaiting, retreatFromOnlineLobby, roomCode]);

  const runCoinSidePickFlow = useCallback(async () => {
    if (!roomCode || !firebaseUser || sidePickBusy) return;
    setSidePickBusy(true);
    vibrate(12);
    try {
      const signal = await signalGomokuSidePickAnim(roomCode, firebaseUser.uid, 'coin');
      if (signal !== 'ok') {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: '先後決定の開始に失敗しました' }),
        );
        return;
      }
      await new Promise((r) => window.setTimeout(r, SIDE_PICK_ANIM_MS));
      const res = await commitGomokuSidePick(roomCode, firebaseUser.uid, 'coin');
      if (!res.ok) {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: '先後の決定に失敗しました' }),
        );
        return;
      }
      await new Promise((r) => window.setTimeout(r, SIDE_PICK_REVEAL_MS));
      const begin = await beginGomokuRoomPlay(roomCode, firebaseUser.uid);
      if (begin !== 'ok') {
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: '対局開始に失敗しました' }),
        );
        return;
      }
      setView('play');
    } finally {
      setSidePickBusy(false);
    }
  }, [firebaseUser, roomCode, sidePickBusy]);

  useEffect(() => {
    if (playKind !== 'online' || !roomCode || !firebaseUser || !onlineRoom) return;
    if (onlineRoom.status !== 'side_pick') return;
    if (normalizeGomokuOnlineStartMode(onlineRoom.onlineStartMode) !== 'coin') return;
    if (onlineRoom.host.uid !== firebaseUser.uid) return;
    if (onlineRoom.sidePickAnimMethod || sidePickBusy) return;
    const key = `${roomCode}:${onlineRoom.guest?.uid ?? ''}`;
    if (coinAutoStartedRef.current === key) return;
    coinAutoStartedRef.current = key;
    void runCoinSidePickFlow();
  }, [firebaseUser, onlineRoom, playKind, roomCode, runCoinSidePickFlow, sidePickBusy]);

  useEffect(() => {
    if (playKind !== 'online' || !roomCode || !firebaseUser || !onlineRoom) return;
    if (onlineRoom.status !== 'side_reveal' || !isGomokuPresetSideAssignMode(onlineRoom.onlineStartMode)) {
      return;
    }
    const isMember =
      onlineRoom.host.uid === firebaseUser.uid || onlineRoom.guest?.uid === firebaseUser.uid;
    if (!isMember) return;
    const key = `${roomCode}:${onlineRoom.guest?.uid ?? ''}`;
    if (defaultRevealStartedRef.current === key) return;
    defaultRevealStartedRef.current = key;
    void (async () => {
      await new Promise((r) => window.setTimeout(r, SIDE_PICK_REVEAL_MS));
      const begin = await beginGomokuRoomPlay(roomCode, firebaseUser.uid);
      if (begin !== 'ok' && begin !== 'not_ready') {
        defaultRevealStartedRef.current = null;
      }
    })();
  }, [firebaseUser, onlineRoom, playKind, roomCode]);

  const confirmOnlineInterrupt = useCallback(async () => {
    if (!roomCode || !firebaseUser) return;
    setOnlineBusy(true);
    try {
      const result = await abandonGomokuRoom(roomCode, firebaseUser.uid);
      if (result !== 'ok') {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '中断の送信に失敗しました' }));
        return;
      }
      setShowInterruptConfirm(false);
      handleBackToMenu();
    } finally {
      setOnlineBusy(false);
    }
  }, [firebaseUser, handleBackToMenu, roomCode]);

  useLayoutEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setAreaPx(Math.floor(Math.min(w, h)));
    };
    sync();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [view, size, showCoordLayer]);

  const rebuildBoardFromHistory = useCallback(
    (moves: MoveRecord[], nextSettings: GomokuGameSettings) => {
      const start = createGomokuStartBoard(
        nextSettings.boardSize,
        nextSettings.handicapStones,
        nextSettings.handicapBeneficiary,
      );
      const nextBoard = start.board.map((r) => [...r]);
      for (const move of moves) {
        nextBoard[move.row]![move.col] = move.color;
      }
      return { board: nextBoard, handicapKeys: new Set(start.handicapKeys) };
    },
    [],
  );

  const startGame = useCallback(
    (nextSettings: GomokuGameSettings) => {
      saveGomokuSettings(nextSettings);
      setSettings(nextSettings);
      setPlayKind('cpu');
      const start = createGomokuStartBoard(
        nextSettings.boardSize,
        nextSettings.handicapStones,
        nextSettings.handicapBeneficiary,
      );
      setBoard(start.board);
      setHandicapKeys(new Set(start.handicapKeys));
      setTurn('black');
      setWinner(null);
      setHistory([]);
      setLastCoord(null);
      setThinking(false);
      shussekiRecordedRef.current = false;
      setLoggedOnce(false);
      setView('play');
    },
    [],
  );

  const applyMove = useCallback(
    (row: number, col: number, color: GomokuColor) => {
      if (winner) return;
      if (!isValidGomokuMove(board, row, col)) return;
      const nextBoard = applyGomokuMove(board, row, col, color);
      const nextWinner = getGomokuWinnerAfterMove(nextBoard, row, col, color);
      setBoard(nextBoard);
      setHistory((prev) => [...prev, { row, col, color }]);
      setLastCoord(gomokuCoordLabel(col, row, boardGridColumnLabel));
      vibrate(8);
      if (nextWinner) {
        setWinner(nextWinner);
        if (!shussekiRecordedRef.current) {
          shussekiRecordedRef.current = true;
          onRecordShussekiGamePlay?.();
        }
        return;
      }
      setTurn(gomokuOpponent(color));
    },
    [board, onRecordShussekiGamePlay, winner],
  );

  useEffect(() => {
    if (view !== 'play' || winner) return;
    if (playKind !== 'cpu' || settings.opponent !== 'cpu') return;
    if (turn === settings.humanColor) return;

    setThinking(true);
    const tid = window.setTimeout(() => {
      const move = pickGomokuCpuMove(board, turn, settings.difficulty, size);
      setThinking(false);
      applyMove(move.row, move.col, turn);
    }, CPU_DELAY_MS);
    return () => {
      window.clearTimeout(tid);
      setThinking(false);
    };
  }, [applyMove, board, playKind, settings.difficulty, settings.humanColor, settings.opponent, size, turn, view, winner]);

  useEffect(() => {
    if (view !== 'play' || !winner || shussekiRecordedRef.current) return;
    shussekiRecordedRef.current = true;
    onRecordShussekiGamePlay?.();
  }, [onRecordShussekiGamePlay, view, winner]);

  const handleIntersectionTap = useCallback(
    async (row: number, col: number) => {
      if (view !== 'play' || winner) return;
      if (thinking) return;
      if (playKind === 'online') {
        if (!humanTurn || !roomCode || !firebaseUser) return;
        setOnlineBusy(true);
        try {
          const res = await submitGomokuRoomMove(roomCode, firebaseUser.uid, row, col);
          if (res === 'forbidden') {
            window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '今はあなたの番ではありません' }));
          } else if (res === 'invalid') {
            window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'そこには置けません' }));
          } else {
            vibrate(8);
          }
        } finally {
          setOnlineBusy(false);
        }
        return;
      }
      if (settings.opponent === 'cpu' && !humanTurn) return;
      applyMove(row, col, turn);
    },
    [applyMove, firebaseUser, humanTurn, playKind, roomCode, settings.opponent, thinking, turn, view, winner],
  );

  const handleUndo = useCallback(() => {
    if (playKind === 'online') return;
    if (history.length === 0 || winner) return;
    vibrate(5);
    const nextHistory = history.slice(0, -1);
    const last = history[history.length - 1];
    if (!last) return;
    const rebuilt = rebuildBoardFromHistory(nextHistory, settings);
    setBoard(rebuilt.board);
    setHandicapKeys(rebuilt.handicapKeys);
    setHistory(nextHistory);
    setTurn(last.color);
    setWinner(null);
    setThinking(false);
    const prev = nextHistory[nextHistory.length - 1];
    setLastCoord(
      prev ? gomokuCoordLabel(prev.col, prev.row, boardGridColumnLabel) : null,
    );
  }, [history, playKind, rebuildBoardFromHistory, settings, winner]);

  const handleBack = useCallback(() => {
    vibrate(10);
    if (view === 'play') {
      if (onlineActiveMatch) {
        setShowInterruptConfirm(true);
        return;
      }
      if (playKind === 'online') {
        handleBackToMenu();
        return;
      }
      setView('menu');
      return;
    }
    if (view === 'online-lobby') {
      if (composingRecruit) {
        setComposingRecruit(false);
        return;
      }
      retreatFromOnlineLobby();
      return;
    }
    if (view === 'logs' || view === 'cpu-setup') {
      setView('menu');
      return;
    }
    onBack();
  }, [composingRecruit, handleBackToMenu, onBack, onlineActiveMatch, playKind, retreatFromOnlineLobby, view]);

  const openCpuSetup = useCallback(() => {
    vibrate(10);
    setDraft({ ...loadGomokuSettings(), opponent: 'cpu' });
    setView('cpu-setup');
  }, []);

  const openOnlineLobby = useCallback(() => {
    vibrate(10);
    setComposingRecruit(false);
    setView('online-lobby');
  }, []);

  const shellClass =
    'absolute inset-0 z-40 h-full max-h-[100dvh] overflow-hidden flex flex-col items-center px-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[clamp(0.9375rem,3.6vw,1.0625rem)] bg-gradient-to-b from-rk-amber-100 via-rk-amber-50 to-rk-amber-100 text-rk-slate-900';

  return (
    <div className={shellClass}>
      <header className={`${immersiveHeader} ${view === 'play' ? 'mb-0.5' : ''}`}>
        <RK19QuietRoomBackButton onClick={handleBack} aria-label="戻る" />
        <p className={`${immersiveKicker} ${view === 'play' ? 'text-[0.72em]' : ''}`}>らくだ珈琲</p>
        <h1 className={`${immersiveTitle} ${view === 'play' ? 'text-[1em] mt-0' : ''}`}>五目並べ</h1>
        {view === 'menu' ? (
          <p className={`${immersiveSubtitle} text-rk-amber-950/70`}>
            ひとり・オンラインで遊べます
          </p>
        ) : view === 'cpu-setup' ? (
          <p className={`${immersiveSubtitle} text-rk-amber-950/70`}>
            {RAKUDA_ROBO_EMOJI} {RAKUDA_ROBO_NAME}と対戦
          </p>
        ) : view === 'logs' ? (
          <p className={`${immersiveSubtitle} text-rk-amber-950/70`}>
            {firebaseUser
              ? `ログイン中の対戦記録【${gomokuLogSummary.wins}勝/${gomokuLogSummary.losses}敗/${gomokuLogSummary.draws}引き分け】`
              : 'ログインすると記録が残ります'}
          </p>
        ) : view === 'online-lobby' ? (
          <p className={`${immersiveSubtitle} text-rk-amber-950/70`}>
            {roomCode ? `ルーム ${roomCode}` : 'オンライン1対1'}
          </p>
        ) : playKind === 'online' && roomCode ? (
          <p className={`${immersiveSubtitle} text-rk-amber-950/70`}>オンライン {roomCode}</p>
        ) : null}
      </header>

      {view === 'menu' ? (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col justify-center gap-2.5 py-4`}>
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
                className="w-full"
                onClick={() => {
                  vibrate(8);
                  setView('online-lobby');
                }}
              >
                待機画面へ
              </RK02PrimaryTouchButton>
              <RK03GhostTouchButton
                disabled={onlineBusy}
                className="w-full"
                onClick={() => {
                  void cancelHostRecruitment();
                }}
              >
                募集をやめる
              </RK03GhostTouchButton>
            </div>
          ) : null}

          <RK02PrimaryTouchButton
            className="w-full inline-flex items-center justify-center gap-2"
            onClick={openCpuSetup}
          >
            <span aria-hidden>{RAKUDA_ROBO_EMOJI}</span>
            {RAKUDA_ROBO_NAME}と遊ぶ
          </RK02PrimaryTouchButton>

          <RK02PrimaryTouchButton
            className="w-full inline-flex items-center justify-center gap-2 relative"
            onClick={openOnlineLobby}
          >
            <Swords className="size-[1.15em] shrink-0" aria-hidden />
            オンライン1対1
            {isMyHostWaiting ? (
              <span className={`ml-1.5 ${GOMOKU_RECRUIT_HOST_BADGE_CLASS}`}>募集中</span>
            ) : joinableOpenRooms.length > 0 ? (
              <span className={`ml-1.5 ${GOMOKU_RECRUIT_BADGE_CLASS}`}>募集あり</span>
            ) : null}
          </RK02PrimaryTouchButton>

          <RK03GhostTouchButton
            className="w-[calc(100%-2ch)] mx-auto inline-flex items-center justify-center gap-2"
            onClick={() => setView('logs')}
          >
            <BookOpen className="size-[1.15em] shrink-0" aria-hidden />
            対戦記録（ログ）
            {firebaseUser ? (
              <span className="text-[0.85em] font-bold opacity-80">
                {gomokuLogSummary.wins}勝/{gomokuLogSummary.losses}敗
              </span>
            ) : null}
          </RK03GhostTouchButton>
        </div>
      ) : view === 'cpu-setup' ? (
        <GomokuSoloSetupPanel
          draft={draft}
          onChange={setDraft}
          onStart={() => startGame({ ...draft, opponent: 'cpu' })}
          onBack={() => setView('menu')}
        />
      ) : view === 'logs' ? (
        <GomokuLogsPanel
          logs={gomokuLogs}
          isLoggedIn={!!firebaseUser}
          onLogin={onGoogleLogin}
          onDone={() => setView('menu')}
        />
      ) : view === 'online-lobby' ? (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col gap-3 py-2`}>
          {!roomCode ? (
            composingRecruit ? (
              <GomokuRecruitComposer
                draft={roomDraft}
                busy={onlineBusy}
                onChange={setRoomDraft}
                onReset={() => setRoomDraft({ ...GOMOKU_DEFAULT_ROOM_DEFAULTS })}
                onSaveDefaults={() => {
                  saveGomokuRoomDefaults(roomDraft);
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
              <div className="flex-1 min-h-0 flex flex-col gap-3 text-[105%]">
                <RK02PrimaryTouchButton
                  disabled={onlineBusy}
                  className="w-full shrink-0"
                  onClick={openRecruitComposer}
                >
                  ルームを作成（ホスト）
                </RK02PrimaryTouchButton>
                <p className="shrink-0 font-black text-rk-amber-950">募集中のルーム</p>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                  {joinableOpenRooms.length === 0 ? (
                    <p className="text-center text-rk-amber-900/60 py-6 leading-snug">
                      いま募集中のルームはありません
                    </p>
                  ) : (
                    joinableOpenRooms.map((room) => (
                      <OpenGomokuRoomCard
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
                  <p className="text-center text-rk-amber-900/70 shrink-0">
                    オンライン対戦はログインが必要です
                  </p>
                ) : null}
              </div>
            )
          ) : (
            <div className="flex-1 min-h-0 flex flex-col justify-center text-center space-y-3">
              <p className="text-[0.9em] font-bold text-rk-amber-950">ルーム番号</p>
              <p className="text-[2em] font-black tracking-[0.2em] text-rk-amber-900">{roomCode}</p>
              {onlineRoom?.recruitComment ? (
                <p className="text-[0.82em] text-rk-amber-900/80 leading-snug px-2">
                  {onlineRoom.recruitComment}
                </p>
              ) : null}
              <p className="text-[0.82em] text-rk-amber-900/75 leading-snug">
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
                  ? `先後：${gomokuOnlineStartModeLabelJa(onlineRoom?.onlineStartMode ?? 'default_black')}`
                  : null}
                {!isMyHostWaiting && isGuestSidePick ? (
                  <>
                    <br />
                    コインで先後が決まります。
                  </>
                ) : null}
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
                    className="w-full"
                    onClick={() => {
                      retreatFromOnlineLobby();
                    }}
                  >
                    五目並べメニューへ（募集を続ける）
                  </RK03GhostTouchButton>
                  <RK03GhostTouchButton
                    disabled={onlineBusy}
                    className="w-full text-rk-amber-900"
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
      ) : (
        <div className={`${immersiveContentWidth} flex-1 min-h-0 flex flex-col gap-2 overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1 rounded-lg bg-rk-amber-100 border border-rk-amber-300 px-2 py-1 text-[12px] font-bold text-rk-amber-950 max-w-[58%] truncate">
              {statusLine || `${gomokuBoardSizeLabelJa(size)} · ${history.length}手`}
            </span>
            <div className="flex gap-1.5 shrink-0">
              {playKind !== 'online' ? (
                <button
                  type="button"
                  className="rounded-lg border border-rk-slate-300 bg-rk-white px-2 py-1 text-[11px] font-bold"
                  onClick={() => startGame(settings)}
                >
                  <RotateCcw className="inline size-3.5 mr-0.5" aria-hidden />
                  新しいゲーム
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-rk-slate-300 bg-rk-white px-2 py-1 text-[11px] font-bold disabled:opacity-40"
                onClick={handleUndo}
                disabled={playKind === 'online' || history.length === 0 || !!winner}
              >
                <Undo2 className="inline size-3.5 mr-0.5" aria-hidden />
                取り消し
              </button>
            </div>
          </div>

          <p className="text-[11px] text-center text-rk-amber-950/75 px-2 -mt-1 shrink-0">
            交点をタップして石を置きます。縦・横・斜めで5つ先に並べた方の勝ちです。
          </p>

          <div className="flex-1 min-h-0 w-full max-w-[min(100%,440px)] mx-auto flex flex-col">
            {winner ? (
              <div className="shrink-0 flex justify-center px-2 py-1">
                <div className="w-full max-w-sm rounded-xl border border-rk-amber-300 bg-rk-white px-3 py-2.5 text-center space-y-2 shadow-sm">
                  <p className="text-sm font-black text-rk-slate-900 leading-relaxed">
                    {playKind === 'online' && onlineWinMessage
                      ? onlineWinMessage
                      : gomokuWinnerMessage(winner, settings.opponent, settings.humanColor)}
                  </p>
                  {lastCoord ? (
                    <p className="text-sm font-bold text-rk-sky-700">最後の手：{lastCoord}</p>
                  ) : null}
                  {playKind === 'cpu' && winner === settings.humanColor ? (
                    <LiveClearReportSoloPanel kind="gomoku" vibrate={vibrate} />
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <RK03GhostTouchButton
                      type="button"
                      className={btnGhostTouch}
                      onClick={() => {
                        vibrate(10);
                        setWinner(null);
                        if (playKind === 'online') {
                          handleBackToMenu();
                          return;
                        }
                        startGame(settings);
                      }}
                    >
                      {playKind === 'online' ? 'メニューへ' : 'もう一度'}
                    </RK03GhostTouchButton>
                    <RK02PrimaryTouchButton
                      type="button"
                      className={btnPrimaryTouch}
                      onClick={() => {
                        vibrate(10);
                        setWinner(null);
                        handleBackToMenu();
                      }}
                    >
                      閉じる
                    </RK02PrimaryTouchButton>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              ref={boardWrapRef}
              className="w-full flex justify-center flex-1 min-h-0 items-center"
            >
            <div
              className="relative shrink-0 select-none"
              style={{ width: wrapWidth, height: wrapHeight }}
            >
              {showCoordLayer ? (
                <div className="absolute inset-0 z-[5] pointer-events-none select-none" aria-hidden>
                  {Array.from({ length: size }, (_, col) => (
                    <div
                      key={`gomoku-coord-col-${col}`}
                      className="absolute flex items-center justify-center font-bold text-rk-sky-700 leading-none"
                      style={{
                        left: gutter.left + GRID_PAD_PX + col * cellStep - cellStep / 2,
                        top: 0,
                        width: cellStep,
                        height: gutter.top,
                        fontSize: gutter.fontSize,
                      }}
                    >
                      {boardGridColumnLabel(col)}
                    </div>
                  ))}
                  {Array.from({ length: size }, (_, row) => (
                    <div
                      key={`gomoku-coord-row-${row}`}
                      className="absolute flex items-center justify-center font-bold text-rk-sky-700 leading-none tabular-nums"
                      style={{
                        left: 0,
                        top: gutter.top + GRID_PAD_PX + row * cellStep - cellStep / 2,
                        width: gutter.left,
                        height: cellStep,
                        fontSize: gutter.fontSize,
                      }}
                    >
                      {row + 1}
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                className="absolute rounded-xl border border-rk-amber-900/30 shadow-md"
                style={{
                  left: gutter.left,
                  top: gutter.top,
                  width: boardPx,
                  height: boardPx,
                  background:
                    'linear-gradient(145deg, #d4a574 0%, #c8956c 45%, #b8845a 100%)',
                }}
              >
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${boardPx} ${boardPx}`}
                  aria-hidden
                >
                  {Array.from({ length: size }, (_, i) => {
                    const pos = GRID_PAD_PX + i * cellStep;
                    return (
                      <g key={i}>
                        <line
                          x1={GRID_PAD_PX}
                          y1={pos}
                          x2={boardPx - GRID_PAD_PX}
                          y2={pos}
                          stroke="#5c3d1e"
                          strokeWidth="1"
                        />
                        <line
                          x1={pos}
                          y1={GRID_PAD_PX}
                          x2={pos}
                          y2={boardPx - GRID_PAD_PX}
                          stroke="#5c3d1e"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}
                  {stars.map((star) => (
                    <circle
                      key={`${star.row}-${star.col}`}
                      cx={GRID_PAD_PX + star.col * cellStep}
                      cy={GRID_PAD_PX + star.row * cellStep}
                      r={Math.max(2, stonePx * 0.12)}
                      fill="#3d2814"
                    />
                  ))}
                </svg>

                {board.map((row, rowIdx) =>
                  row.map((_, colIdx) => {
                    const occupied = row[colIdx] != null;
                    const playable =
                      view === 'play' &&
                      !winner &&
                      !thinking &&
                      !occupied &&
                      (settings.opponent === 'human' || humanTurn);
                    const x = GRID_PAD_PX + colIdx * cellStep;
                    const y = GRID_PAD_PX + rowIdx * cellStep;
                    const coord = gomokuCoordLabel(colIdx, rowIdx, boardGridColumnLabel);
                    return (
                      <button
                        key={`gomoku-hit-${rowIdx}-${colIdx}`}
                        type="button"
                        className={`absolute z-[8] -translate-x-1/2 -translate-y-1/2 rounded-full border-0 p-0 ${
                          playable
                            ? 'cursor-pointer bg-rk-amber-400/0 active:bg-rk-amber-400/25'
                            : 'pointer-events-none'
                        }`}
                        style={{ left: x, top: y, width: intersectionHitPx, height: intersectionHitPx }}
                        disabled={!playable}
                        aria-label={playable ? `${coord}に置く` : coord}
                        onClick={() => handleIntersectionTap(rowIdx, colIdx)}
                      />
                    );
                  }),
                )}

                {board.map((row, rowIdx) =>
                  row.map((cell, colIdx) => {
                    if (!cell) return null;
                    const x = GRID_PAD_PX + colIdx * cellStep;
                    const y = GRID_PAD_PX + rowIdx * cellStep;
                    const isBlack = cell === 'black';
                    const isHandicap = handicapKeys.has(gomokuCellKey(rowIdx, colIdx));
                    const isLast =
                      lastCoord === gomokuCoordLabel(colIdx, rowIdx, boardGridColumnLabel);
                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className="absolute z-[10] rounded-full pointer-events-none"
                        style={{
                          width: stonePx,
                          height: stonePx,
                          left: x - stonePx / 2,
                          top: y - stonePx / 2,
                          background: isBlack
                            ? 'radial-gradient(circle at 35% 35%, #555, #111 70%)'
                            : 'radial-gradient(circle at 35% 35%, #fff, #ddd 70%)',
                          boxShadow: isBlack
                            ? '0 1px 2px rgba(0,0,0,0.45)'
                            : '0 1px 2px rgba(0,0,0,0.25)',
                          border: isLast
                            ? '2px solid rgba(56, 189, 248, 0.95)'
                            : isBlack
                              ? '1px solid #222'
                              : '1px solid #bbb',
                          outline: isHandicap ? '2px dashed rgba(251, 191, 36, 0.85)' : undefined,
                          outlineOffset: 1,
                        }}
                      />
                    );
                  }),
                )}
              </div>
            </div>
            </div>
          </div>

          <p className="text-center text-[11px] font-medium text-rk-amber-950/70 px-2 leading-snug shrink-0">
            {gomokuBoardSizeLabelJa(size)}
            {handicapSummary ? ` · ${handicapSummary}` : ''}
            {' · '}
            五連で勝ち · 三三・四四禁止なし
            {showCoordLayer ? ' · 座標 ON' : ''}
          </p>
        </div>
      )}

      <AnimatePresence>
        {sidePickOverlayMode && onlineRoom ? (
          <GomokuSidePickOverlay
            mode={sidePickOverlayMode}
            myColor={mySidePickColor}
            host={onlineRoom.host}
            guest={onlineRoom.guest}
          />
        ) : null}
      </AnimatePresence>

      {showInterruptConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-rk-slate-900/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-rk-amber-300 bg-rk-white p-4 space-y-3 shadow-xl">
            <p className="font-black text-rk-amber-950 text-center leading-snug">
              対局中です。中断しますか？
            </p>
            <p className="text-sm text-rk-amber-900/75 text-center">相手の勝ちになります。</p>
            <RK02PrimaryTouchButton
              disabled={onlineBusy}
              className="w-full"
              onClick={() => {
                void confirmOnlineInterrupt();
              }}
            >
              中断する
            </RK02PrimaryTouchButton>
            <RK03GhostTouchButton
              className="w-full"
              onClick={() => setShowInterruptConfirm(false)}
            >
              続ける
            </RK03GhostTouchButton>
          </div>
        </div>
      ) : null}

    </div>
  );
};

function GomokuSoloSetupPanel({
  draft,
  onChange,
  onStart,
  onBack,
}: {
  draft: GomokuGameSettings;
  onChange: (next: GomokuGameSettings) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className={`${immersiveContentWidth} flex-1 min-h-0 overflow-y-auto py-2 space-y-3`}>
      <div className="rounded-2xl border border-rk-amber-300/80 bg-rk-amber-50/90 p-3 space-y-3 shadow-sm">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-rk-slate-600">難易度</p>
          <div className="grid grid-cols-1 gap-2">
            {(['easy', 'normal', 'hard'] as GomokuCpuDifficulty[]).map((level) => (
              <RadioRow
                key={level}
                name="gomoku-solo-difficulty"
                value={level}
                checked={draft.difficulty === level}
                label={gomokuCpuDifficultyLabelJa(level)}
                onSelect={() => onChange({ ...draft, difficulty: level })}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-rk-slate-600">あなたの色</p>
          <div className="grid grid-cols-2 gap-2">
            <RadioRow
              name="gomoku-solo-color"
              value="black"
              checked={draft.humanColor === 'black'}
              label="黒"
              dark
              onSelect={() => onChange({ ...draft, humanColor: 'black' })}
            />
            <RadioRow
              name="gomoku-solo-color"
              value="white"
              checked={draft.humanColor === 'white'}
              label="白"
              onSelect={() => onChange({ ...draft, humanColor: 'white' })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-rk-slate-600">盤面</p>
          <div className="grid grid-cols-2 gap-2">
            {([13, 15] as GomokuBoardSize[]).map((boardSize) => (
              <RadioRow
                key={boardSize}
                name="gomoku-solo-size"
                value={String(boardSize)}
                checked={draft.boardSize === boardSize}
                label={gomokuBoardSizeLabelJa(boardSize)}
                onSelect={() => onChange({ ...draft, boardSize })}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-rk-slate-600">星ハンデ（らくだ式）</p>
          <p className="text-[10px] font-medium text-rk-slate-600 leading-snug">{gomokuHandicapHintJa()}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {GOMOKU_HANDICAP_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`rounded-lg border px-1 py-2 text-[11px] font-black ${
                  draft.handicapStones === n
                    ? 'bg-rk-amber-200 border-rk-amber-500 text-rk-amber-950'
                    : 'bg-rk-white border-rk-slate-200 text-rk-slate-700'
                }`}
                onClick={() => onChange({ ...draft, handicapStones: n as GomokuHandicapStones })}
              >
                {gomokuHandicapLabelJa(n)}
              </button>
            ))}
          </div>
          {draft.handicapStones > 0 ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <RadioRow
                name="gomoku-solo-handicap-color"
                value="white"
                checked={draft.handicapBeneficiary === 'white'}
                label="ハンデは白"
                hint="黒先攻の定番"
                onSelect={() => onChange({ ...draft, handicapBeneficiary: 'white' })}
              />
              <RadioRow
                name="gomoku-solo-handicap-color"
                value="black"
                checked={draft.handicapBeneficiary === 'black'}
                label="ハンデは黒"
                onSelect={() => onChange({ ...draft, handicapBeneficiary: 'black' })}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold text-rk-slate-600">座標（配信向け）</p>
          <div className="grid grid-cols-1 gap-2">
            <RadioRow
              name="gomoku-solo-coords"
              value="on"
              checked={draft.showCoords}
              label="盤の外に A1 形式"
              hint="設定の「盤面座標」と併用可"
              onSelect={() => onChange({ ...draft, showCoords: true })}
            />
            <RadioRow
              name="gomoku-solo-coords"
              value="off"
              checked={!draft.showCoords}
              label="座標を隠す"
              onSelect={() => onChange({ ...draft, showCoords: false })}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <RK03GhostTouchButton type="button" className={btnGhostTouch} onClick={onBack}>
          もどる
        </RK03GhostTouchButton>
        <RK02PrimaryTouchButton type="button" className={btnPrimaryTouch} onClick={onStart}>
          開始
        </RK02PrimaryTouchButton>
      </div>
    </div>
  );
}

export default GomokuGame;
