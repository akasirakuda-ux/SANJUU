import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { GameState, Point, Selection, LogEntry, PlacedWord, WordOccurrence } from '../types';
import { convertToHiragana, convertToKatakana, getCategoryDisplayTitle } from '../constants';
import { inviteRoomCodeForShare } from './AppUIHelpers';
import { audioService } from '../services/audioService';
import RakudaFloatingBackdrop from './RakudaFloatingBackdrop';
import { btnGhost, btnPrimary, cardClass } from '../ui/policy';
import { pageTopHeadingClass } from '../ui/typography';
import { getDoc, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { applyHostCancelledHundredGeneration } from '../lib/hundredRecruitCancel';
import { clearHundredRestoreSession } from '../lib/rakudaHundredRestore';
import { RK19QuietRoomBackButton } from '../ui/baselineParts';
import { isTabletTouchLayout } from '../lib/tabletPhoneCanvas';
import {
  rkBandColorCount,
  rkCssColor,
  rkResolvedAccentPrimary,
  rkResolvedBandColor,
} from '../lib/rakudaHubShell';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../lib/rakudaGate';
import RakudaGreenGateEmoji from './RakudaGreenGateEmoji';
import { useGreenGateActiveByUids } from '../hooks/useGreenGateActiveByUids';
import {
  buildHundredRoundRanking,
  countPlacedWordOccurrences,
  countUniqueFoundOccurrences,
} from '../lib/hundredPickupOccurrences';
import { formatBoardDimensions, resolveBoardCols, resolveBoardRows } from '../lib/boardDimensions';
import { boardGridColumnLabel, measureCoordGutter } from '../lib/boardGridCoordinates';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME } from '../lib/reversiConfig';
import { isRoboPickupLoungeRoomId, ROBO_PICKUP_STALE_HINT_MS, roboPickupLoungeTitleForRoom } from '../lib/roboPickupLoungeConfig';
import {
  activateRoboLoungeResultsHold,
  clearRoboLoungeResultsHold,
  isRoboLoungeResultsHoldActive,
} from '../lib/roboPickupLoungeResultsHold';
import {
  filterPresentHundredPlayers,
  filterRoboLoungeRoundPlayers,
  HUNDRED_PLAYER_PRESENCE_TICK_MS,
  hundredPresenceStatusLine,
} from '../lib/hundredPlayerPresence';
import { useRoboLoungeLastOccurrenceFill } from '../hooks/useRoboLoungeLastOccurrenceFill';
import { firestoreLikeToMillis } from '../lib/firestoreTime';
import { isRoboLoungeRoundIdle } from '../lib/roboPickupLoungeFound';
import { RK_STREAM_LIVE_BADGE_LABEL } from '../lib/rakudaStreamLiveBadge';
import RoboPickupLoungeGuide from './Renrakucho/hundred/RoboPickupLoungeGuide';
import { useKotobaRoboIdleFinish } from '../hooks/useKotobaRoboIdleFinish';
import {
  clearFlyModalDelayMs,
  FLY_BANNER_DURATION_SEC,
  LAST_ONE_FLY_X_PERCENT,
  CLEAR_FLY_X_PERCENT,
  CLEAR_RESULT_OVERLAY_TIMING_SCALE,
} from '../lib/clearFlyTiming';
import { setHundredRoomHintsEnabled } from '../lib/hundredRoomHints';
import LiveClearReportSoloPanel from './LiveClearReportSoloPanel';
import { buildSamePuzzleChallengeUrlFromGameState } from '../lib/kotobaChallengeShare';

class ParticlePool {
  pool: any[] = [];
  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '', size: 0, rotation: 0, vr: 0 });
    }
  }
  emit(x: number, y: number, color: string) {
    const p = this.pool.find(p => p.life <= 0);
    if (p) {
      p.x = x; p.y = y;
      p.vx = (Math.random() - 0.5) * 5;
      p.vy = (Math.random() - 0.5) * 5 - 2;
      p.life = 1.0; p.color = color;
      p.size = Math.random() * 3 + 2;
      p.rotation = 0; p.vr = 0.1;
    }
  }
}

interface FloatingText { id: number; text: string; x: number; y: number; life: number; color: string; }

interface GameScreenProps {
  gameState: GameState;
  onUpdateFound: (word: string, start: Point, end: Point, isHint?: boolean, options?: { robo?: boolean }) => void;
  onBack: () => void | Promise<void>;
  /** みんなであそぶ（掲示板）へ戻す専用導線（任意） */
  onBackToBoard?: () => void | Promise<void>;
  /** クリア画面から３０募集一覧へ戻す（みんなであそぶ／30プレイ） */
  onBackToRecruitBoard?: () => void | Promise<void>;
  showToast: (msg: string) => void;
  onSaveHistory: (log: LogEntry) => void;
  vibrate: (pattern?: number | number[]) => void;
  language: 'ja';
  isOnline: boolean;
  onClear: () => void;
  onClearSeed: () => void;
  userId: string;
  onNextProblem: () => void;
  seed: string;
  proCode?: string;
  nickname: string;
  userEmoji?: string;
  isMultiplay?: boolean;
  isSyncMode?: boolean;
  roomId?: string | null;
  shareRoomId?: string | null;
  roomStartTime?: number | null;
  consecutiveClears: number;
  roomPlayers?: any[];
  roomStatus?: 'waiting' | 'start' | 'playing' | 'finished';
  onBackToTitle?: () => void | Promise<void>;
  /** みんなであそぶ協力（同期盤・hundred_rooms） */
  hundredCoop?: boolean;
  hundredRoster?: import('../lib/hundredPlayerPresence').HundredRosterPlayer[];
  /** hundred_rooms.hostUid（ホストが離脱するとき確認）。`userId`(アプリUUID)ではなく Firebase Auth の uid と比較する */
  hundredRoomHostUid?: string | null;
  /** 現行お題の開始（ロボ常設の参加者フィルタ用） */
  hundredRoomStartedAt?: unknown;
  /** ロボ常設: 最後に誰かが見つけた時刻 */
  hundredRoomLastFoundAt?: unknown;
  hundredRoomUpdatedAt?: unknown;
  /** Firebase Auth の uid（ホスト判定用） */
  currentFirebaseUid?: string | null;
  onHundredRoomFinished?: (reason: 'timeout' | 'cleared') => void;
  /** クリア後: らくだロボが新しい探すことばで同サイズ盤面を再生成 */
  onRakudaRoboReplay?: () => Promise<boolean>;
  /** みんなであそぶ: クリア後に players から退室（ロボ常設も一般募集と同じ扱い） */
  onLeaveHundredRoom?: () => void | Promise<void>;
  /** ロボ常設: お題クリア後に次のお題を自動生成 */
  onRoboPickupLoungeAutoRefresh?: () => void | Promise<void>;
  /** ひと言探しクリア時の全面広告（達成の区切り） */
  onHundredPickupClearInterstitial?: () => void | Promise<void>;
  /** 配信モード（軽量化） */
  streamMode?: boolean;
  /** 盤面の座標表示（配信モードと別） */
  coordOverlayEnabled?: boolean;
  /** 管理者・配信モード時の「配信中」バッジ切替（ひと言探しのみ） */
  adminStreamLiveBadgeControl?: boolean;
  streamLiveBadgeEnabled?: boolean;
  onToggleStreamLiveBadge?: () => void;
  /** 待機室ロジック（画面非表示）の状態 */
  hundredWaitHeadlessState?: import('../lib/hundredWaitHeadless').HundredWaitHeadlessState | null;
  onHundredHostStart?: () => void;
  onHundredJoinRetry?: () => void;
}

/** ラストワン／クリアの実測幅を揃える（見た目の font 系は表示と同一に） */
const FLY_BANNER_MEASURE_STYLE: React.CSSProperties = {
  fontSize: '30vh',
  lineHeight: 1,
  WebkitTextStroke: '12px var(--rk-fly-title-stroke)',
  textShadow: 'var(--rk-fly-title-text-shadow)',
};

const GameScreen: React.FC<GameScreenProps> = ({ 
  gameState, onUpdateFound, onBack, onBackToBoard, onBackToRecruitBoard, onSaveHistory, showToast, vibrate, language, isOnline, onClear, onClearSeed, userId, onNextProblem, seed, proCode, nickname, isMultiplay = false, isSyncMode = false, roomId = null, shareRoomId = null, roomStartTime = null, consecutiveClears, roomPlayers = [],
  roomStatus = 'playing', onBackToTitle,
  userEmoji = '🐫',
  hundredCoop = false,
  hundredRoster = [],
  hundredRoomHostUid = null,
  hundredRoomStartedAt = null,
  hundredRoomLastFoundAt = null,
  hundredRoomUpdatedAt = null,
  currentFirebaseUid = null,
  onHundredRoomFinished,
  onRakudaRoboReplay,
  onLeaveHundredRoom,
  onRoboPickupLoungeAutoRefresh,
  onHundredPickupClearInterstitial,
  streamMode = false,
  coordOverlayEnabled = false,
  adminStreamLiveBadgeControl = false,
  streamLiveBadgeEnabled = false,
  onToggleStreamLiveBadge,
  hundredWaitHeadlessState = null,
  onHundredHostStart,
  onHundredJoinRetry,
}) => {
  const displayRoomCode = inviteRoomCodeForShare(shareRoomId, roomId) || null;
  const t = {
    clear: 'おめでとう😊',
    categoryLabel: '分類：',
    answersLabel: '回答数：',
    timeLabel: 'じかん：',
    difficultyLabel: 'むつかしさ：',
    dateLabel: 'ひづけ：',
    userIdLabel: 'ID：',
    back: 'もどる',
    showAnswers: 'すべてのこたえをみる',
    hintInstruction: 'タップしてヒント！',
    lastOne: 'ラストワン！',
    clearFly: 'おめでとう😊',
    nextProblem: '次の問題',
    consecutiveClear: (count: number) => `${count}連続クリアおめでとう！`,
    wordList: 'ワードリスト',
    logClear: 'クリア：',
    sec: '秒',
    min: '分',
    hint: 'ヒント',
  };

  const displaySearchWord = React.useMemo(() => {
    const w = (gameState.targetWord ?? gameState.category?.words?.[0] ?? '').trim();
    return w || 'ことば';
  }, [gameState.targetWord, gameState.category?.words]);

  /** 検索モードで `searchTimeLimitSec` が正のときだけカウントダウン（0 以下・未設定は制限なし） */
  const searchCountdownActive = React.useMemo(() => {
    if (gameState.gameMode !== 'search') return false;
    const n = Number(gameState.searchTimeLimitSec);
    return Number.isFinite(n) && n > 0;
  }, [gameState.gameMode, gameState.searchTimeLimitSec]);

  const searchTimerMax = React.useMemo(() => {
    if (gameState.gameMode !== 'search') return 120;
    const n = Number(gameState.searchTimeLimitSec);
    if (Number.isFinite(n) && n > 0) return n;
    return 1;
  }, [gameState.gameMode, gameState.searchTimeLimitSec]);

  /** ひと言探し共同: ホストが「ヒントなし」を選んだときは盤面下ボタンを出さない（ロボ常設の10分放置ヒントは別） */
  const hundredHintsAllowed = !hundredCoop || gameState.hintsEnabled !== false;

  type RoboLoungeClearSnapshot = {
    targetWord: string;
    foundWords: GameState['foundWords'];
  };
  const [roboLoungeClearSnapshot, setRoboLoungeClearSnapshot] =
    useState<RoboLoungeClearSnapshot | null>(null);

  const leaveFromClearScreen = useCallback(() => {
    vibrate(10);
    if (isRoboPickupLoungeRoomId(roomId)) {
      clearRoboLoungeResultsHold();
      setRoboLoungeClearSnapshot(null);
    }
    if (hundredCoop) {
      onClearSeed();
      clearHundredRestoreSession();
      if (onBackToRecruitBoard) {
        void onBackToRecruitBoard();
        return;
      }
      void onBack();
      return;
    }
    void onBack();
  }, [hundredCoop, onClearSeed, onBack, onBackToRecruitBoard, roomId, vibrate]);

  const [roboReplayBusy, setRoboReplayBusy] = useState(false);
  const handleRakudaRoboReplay = useCallback(async () => {
    if (!onRakudaRoboReplay || roboReplayBusy) return;
    vibrate(10);
    setRoboReplayBusy(true);
    try {
      await onRakudaRoboReplay();
    } finally {
      setRoboReplayBusy(false);
    }
  }, [onRakudaRoboReplay, roboReplayBusy, vibrate]);

  const [isFinished, setIsFinished] = useState(false);
  const compactStreamMode = !!streamMode && !!hundredCoop && !isFinished;
  // 一般ユーザー向け: hundredCoop（みんなであそぶ）プレイ中に端末が重い兆候が出たら自動で軽量化する
  const [autoCompactMode, setAutoCompactMode] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const showAnswersRef = useRef(false);
  useEffect(() => {
    showAnswersRef.current = showAnswers;
  }, [showAnswers]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [isSuccessFlashing, setIsSuccessFlashing] = useState(false);
  const [clearTime, setClearTime] = useState("");
  const [clearDate, setClearDate] = useState("");
  const [hintWord, setHintWord] = useState<(WordOccurrence & { word: string, startTime: number }) | null>(null);
  const hintWordRef = useRef<(WordOccurrence & { word: string; startTime: number }) | null>(null);
  useEffect(() => {
    hintWordRef.current = hintWord;
  }, [hintWord]);
  const consecutiveClearsRef = useRef(consecutiveClears);
  consecutiveClearsRef.current = consecutiveClears;
  const [streakCount, setStreakCount] = useState(0);
  const [showLastOneBonus, setShowLastOneBonus] = useState(false);
  const [showClearFlyBonus, setShowClearFlyBonus] = useState(false);
  const [showHostInterruptConfirm, setShowHostInterruptConfirm] = useState(false);
  const [hostInterruptInFlight, setHostInterruptInFlight] = useState(false);
  const [hintsToggleBusy, setHintsToggleBusy] = useState(false);
  const [showGuestInterruptedModal, setShowGuestInterruptedModal] = useState(false);
  const guestInterruptHandledRef = useRef(false);
  const lastFlyMeasureRef = useRef<HTMLSpanElement>(null);
  const clearFlyMeasureRef = useRef<HTMLSpanElement>(null);
  const [flyBannerWidths, setFlyBannerWidths] = useState<{ last: number; clear: number }>({ last: 0, clear: 0 });

  const measureFlyBannerWidths = useCallback(() => {
    const wl = lastFlyMeasureRef.current?.offsetWidth ?? 0;
    const wc = clearFlyMeasureRef.current?.offsetWidth ?? 0;
    setFlyBannerWidths({ last: wl, clear: wc });
  }, []);

  useLayoutEffect(() => {
    measureFlyBannerWidths();
    window.addEventListener('resize', measureFlyBannerWidths);
    return () => window.removeEventListener('resize', measureFlyBannerWidths);
  }, [measureFlyBannerWidths, t.lastOne, t.clearFly]);

  const isHundredHost = useMemo(() => {
    if (!hundredCoop || !roomId || !currentFirebaseUid) return false;
    if (hundredRoomHostUid && currentFirebaseUid === hundredRoomHostUid) return true;
    // hostUid 同期前・ひとり参加（20×30 など）でもホストが中断できるようフォールバック
    if (!hundredRoomHostUid && hundredRoster.length <= 1) {
      return (
        hundredRoster.length === 0 ||
        hundredRoster.some((p) => p.uid === currentFirebaseUid)
      );
    }
    return false;
  }, [currentFirebaseUid, hundredCoop, hundredRoomHostUid, hundredRoster, roomId]);

  const isRoboPickupLounge = isRoboPickupLoungeRoomId(roomId);

  const showHundredRoboReplay =
    hundredCoop &&
    gameState.category?.category === 'pickup' &&
    isHundredHost &&
    !!onRakudaRoboReplay &&
    !isRoboPickupLounge;

  const showHundredHostStart =
    hundredCoop &&
    isHundredHost &&
    !isRoboPickupLounge &&
    !!hundredWaitHeadlessState?.canHostStart &&
    !!onHundredHostStart &&
    // クリア後は「らくだロボでもう一回」に任せる（同じ導線が二重にならない）
    !(isFinished && showHundredRoboReplay);

  const showHundredGuestWait =
    hundredCoop &&
    !isHundredHost &&
    !isRoboPickupLounge &&
    !!hundredWaitHeadlessState &&
    (hundredWaitHeadlessState.betweenRounds ||
      (hundredWaitHeadlessState.status === 'recruiting' && !hundredWaitHeadlessState.roomBoardReady));

  const hundredJoinRetryVisible =
    hundredCoop &&
    !!hundredWaitHeadlessState?.joinStalled &&
    (!!hundredWaitHeadlessState.joinError || !hundredWaitHeadlessState.joinOk) &&
    !!onHundredJoinRetry;

  const hundredHostStartButton = showHundredHostStart ? (
    <button
      type="button"
      className={`${btnPrimary} w-full max-w-xs`}
      disabled={hundredWaitHeadlessState?.problemsGenerating}
      onClick={() => onHundredHostStart?.()}
    >
      {hundredWaitHeadlessState?.betweenRounds ? '次のお題をはじめる' : 'はじめる'}
    </button>
  ) : null;

  const hundredClearAutoLeaveDoneRef = useRef(false);
  useEffect(() => {
    hundredClearAutoLeaveDoneRef.current = false;
  }, [roomId]);

  const goToRecruitBoard = useCallback(() => {
    onClearSeed();
    clearHundredRestoreSession();
    if (onBackToRecruitBoard) {
      void onBackToRecruitBoard();
      return;
    }
    void onBack();
  }, [onBack, onBackToRecruitBoard, onClearSeed]);

  const handleHundredBoardBack = useCallback(() => {
    vibrate(10);
    if (hundredCoop && !isFinished && isHundredHost) {
      setShowHostInterruptConfirm(true);
      return;
    }
    // ゲスト: タイトルへ戻さず一旦退室 → 募集一覧（再参加可）
    if (hundredCoop && !isFinished) {
      void onBack();
      return;
    }
    if (typeof onBackToTitle === 'function') {
      void Promise.resolve(onBackToTitle());
    } else {
      void onBack();
    }
  }, [hundredCoop, isFinished, isHundredHost, onBack, onBackToTitle, vibrate]);

  const performHostInterrupt = useCallback(async () => {
    if (!roomId || !isHundredHost || hostInterruptInFlight) return;
    setHostInterruptInFlight(true);
    try {
      const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
      const d = snap.exists() ? (snap.data() as { publicRecruitId?: unknown }) : null;
      const publicRecruitId = typeof d?.publicRecruitId === 'string' ? d.publicRecruitId : undefined;
      await applyHostCancelledHundredGeneration({
        roomId,
        hundredPublicDocId: publicRecruitId,
        endReason: 'host_interrupted',
      });
      await setDoc(
        doc(db, 'hundred_rooms', roomId),
        { foundWords: [], updatedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => {});
    } catch (e) {
      console.warn('[GameScreen] host interrupt failed', e);
    } finally {
      setHostInterruptInFlight(false);
      setShowHostInterruptConfirm(false);
      goToRecruitBoard();
    }
  }, [goToRecruitBoard, hostInterruptInFlight, isHundredHost, roomId]);

  const handleHostToggleHints = useCallback(async () => {
    if (!roomId || !isHundredHost || hintsToggleBusy || isFinished) return;
    const next = !hundredHintsAllowed;
    setHintsToggleBusy(true);
    try {
      await setHundredRoomHintsEnabled(roomId, next);
      showToast(next ? '☝️ ヒントをオンにしました' : '☝️ ヒントをオフにしました');
    } catch (e) {
      console.warn('[GameScreen] toggle hints failed', e);
      showToast('ヒントの切り替えに失敗しました');
    } finally {
      setHintsToggleBusy(false);
    }
  }, [roomId, isHundredHost, hintsToggleBusy, isFinished, hundredHintsAllowed, showToast]);

  useEffect(() => {
    if (!hundredCoop || !roomId || isHundredHost) return;
    guestInterruptHandledRef.current = false;
    const unsub = onSnapshot(
      doc(db, 'hundred_rooms', roomId),
      (snap) => {
        if (!snap.exists()) return;
        const status = (snap.data() as { status?: string }).status;
        if (status !== 'cancelled') return;
        if (guestInterruptHandledRef.current) return;
        guestInterruptHandledRef.current = true;
        setShowGuestInterruptedModal(true);
      },
      (err) => {
        console.warn('[GameScreen] hundred_rooms guest interrupt listen', err);
      },
    );
    return () => unsub();
  }, [hundredCoop, isHundredHost, roomId]);

  /** ラストワンと同じ px/s。距離 = (CLEAR_FLY_X_PERCENT/100)*W_clear → 時間 = 距離/速度 */
  const clearFlyDurationSec = useMemo(() => {
    const wl = flyBannerWidths.last;
    const wc = flyBannerWidths.clear;
    if (wl <= 1 || wc <= 1) {
      return FLY_BANNER_DURATION_SEC * (CLEAR_FLY_X_PERCENT / LAST_ONE_FLY_X_PERCENT);
    }
    const v =
      (LAST_ONE_FLY_X_PERCENT / 100) * wl / FLY_BANNER_DURATION_SEC;
    const dist = (CLEAR_FLY_X_PERCENT / 100) * wc;
    return dist / v;
  }, [flyBannerWidths.last, flyBannerWidths.clear]);

  const clearFlyMotionDurationSec = clearFlyDurationSec * CLEAR_RESULT_OVERLAY_TIMING_SCALE;
  const clearFlyModalDelayMsValue = useMemo(
    () =>
      clearFlyModalDelayMs({
        lastBannerWidthPx: flyBannerWidths.last,
        clearBannerWidthPx: flyBannerWidths.clear,
      }),
    [flyBannerWidths.last, flyBannerWidths.clear],
  );
  const clearFlyModalDelayMsRef = useRef(clearFlyModalDelayMsValue);
  clearFlyModalDelayMsRef.current = clearFlyModalDelayMsValue;

  const [displayConsecutiveClears, setDisplayConsecutiveClears] = useState(consecutiveClears);
  const [finishedPlayers, setFinishedPlayers] = useState<Set<string>>(new Set());
  const lastFoundWordsCount = useRef(gameState.foundWords.length);
  /** ひと言探し: 同じ正解への効果音二重再生を防ぐ */
  const playedFoundSoundKeysRef = useRef(new Set<string>());
  /** join/restore 直後の Firestore 同期分はボーナス・クリア演出を抑止する */
  const joinedFoundBaselineRef = useRef<number | null>(null);
  const joinedBaselineTimerRef = useRef<number | null>(null);
  /** baseline 確定後にクリア判定を再実行（参加時すでに全問見つけ済みの復旧） */
  const [joinedBaselineLockTick, setJoinedBaselineLockTick] = useState(0);

  const clearJoinedFoundBaseline = useCallback(() => {
    if (joinedBaselineTimerRef.current != null) {
      window.clearTimeout(joinedBaselineTimerRef.current);
      joinedBaselineTimerRef.current = null;
    }
    joinedFoundBaselineRef.current = null;
    setJoinedBaselineLockTick(0);
  }, []);

  const foundProgressAfterJoin = (count: number) =>
    joinedFoundBaselineRef.current !== null && count > joinedFoundBaselineRef.current;

  const [activeSelection, setActiveSelection] = useState<Selection>({ start: null, end: null });
  const activeSelectionRef = useRef<Selection>({ start: null, end: null });
  useEffect(() => {
    activeSelectionRef.current = activeSelection;
  }, [activeSelection]);
  const [timeLeft, setTimeLeft] = useState(120);
  const searchModeTimedOut =
    gameState.gameMode === 'search' && searchCountdownActive && timeLeft === 0;
  const [startCountdown, setStartCountdown] = useState(() => {
    return isMultiplay ? 5 : 0; // Default 5s for multiplay, 0 for solo
  });
  const [showStartText, setShowStartText] = useState(() => {
    if (isMultiplay && roomId && roomStartTime) {
      const diff = (roomStartTime - Date.now()) / 1000;
      return diff <= 0 && diff > -1.5;
    }
    return false;
  });

  useEffect(() => {
    if (!isMultiplay || !roomId || hundredCoop) return;
    if (joinedFoundBaselineRef.current === null) return;
    if (gameState.foundWords.length > lastFoundWordsCount.current) {
      const newWord = gameState.foundWords[gameState.foundWords.length - 1];
      if (newWord && newWord.userName && newWord.userName !== nickname) {
        showToast(`${newWord.userName}さんが「${convertToHiragana(newWord.word)}」をみつけたよ！`);
        audioService.noteUserGesture();
        audioService.playCorrectSound();
        vibrate(20);
      }
    }
    lastFoundWordsCount.current = gameState.foundWords.length;
  }, [gameState.foundWords, isMultiplay, roomId, nickname, showToast, hundredCoop]);

  /** ひと言探し: 自分・他プレイヤーの正解発見で効果音（Firestore 同期も含む） */
  useEffect(() => {
    if (!hundredCoop || joinedFoundBaselineRef.current === null) return;
    const prevLen = lastFoundWordsCount.current;
    if (gameState.foundWords.length <= prevLen) return;

    const newEntries = gameState.foundWords.slice(prevLen);
    lastFoundWordsCount.current = gameState.foundWords.length;
    const selfUid = (currentFirebaseUid || userId || '').trim();
    const nick = (nickname || '').trim();

    for (const fw of newEntries) {
      const sk = fw.start;
      const ek = fw.end;
      const soundKey = `${fw.playerId ?? ''}|${fw.userName ?? ''}|${fw.word}|${sk?.x ?? ''},${sk?.y ?? ''}|${ek?.x ?? ''},${ek?.y ?? ''}`;
      if (playedFoundSoundKeysRef.current.has(soundKey)) continue;
      playedFoundSoundKeysRef.current.add(soundKey);
      if (playedFoundSoundKeysRef.current.size > 240) {
        playedFoundSoundKeysRef.current = new Set([...playedFoundSoundKeysRef.current].slice(-120));
      }

      const isSelf =
        (!!fw.playerId && !!selfUid && fw.playerId === selfUid) ||
        (!!fw.userName && !!nick && fw.userName.trim() === nick);

      audioService.noteUserGesture();
      audioService.playCorrectSound();
      vibrate(isSelf ? 14 : 20);
    }
  }, [
    gameState.foundWords,
    hundredCoop,
    currentFirebaseUid,
    userId,
    nickname,
    vibrate,
  ]);

  // Reset finish overlay when a new board arrives (e.g., "next problem")
  useEffect(() => {
    if (isRoboPickupLounge && isRoboLoungeResultsHoldActive()) {
      return;
    }
    if (isRoboPickupLounge && roboLoungeClearSnapshot) {
      const incomingWord = (gameState.targetWord || gameState.category?.words?.[0] || '').trim();
      if (!incomingWord || incomingWord === roboLoungeClearSnapshot.targetWord) {
        return;
      }
      clearRoboLoungeResultsHold();
      setRoboLoungeClearSnapshot(null);
    }

    setIsFinished(false);
    setShowAnswers(false);
    setIsSuccessFlashing(false);
    setStreakCount(0);
    setShowLastOneBonus(false);
    setShowClearFlyBonus(false);
    setFinishedPlayers(new Set());
    startTimeRef.current = Date.now();
    setClearTime("");
    setClearDate("");
    clearJoinedFoundBaseline();
    lastFoundWordsCount.current = 0;
    playedFoundSoundKeysRef.current.clear();
    if (gameState.gameMode === 'search') {
      const limit = Number(gameState.searchTimeLimitSec);
      if (Number.isFinite(limit) && limit > 0) {
        setTimeLeft(limit);
      } else {
        setTimeLeft(1);
      }
    }
    // Ensure the canvas is redrawn immediately on board change.
    // (In compactMode we throttle draws; without this, old ribbons can linger visually.)
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
    lastDrawAtMsRef.current = 0;
    lastCanvasPixelSizeRef.current = { w: 0, h: 0 };
    baseLayerFoundCountRef.current = 0;
    baseLayerBoardKeyRef.current = '';
  }, [
    // A change in these typically means a new puzzle/round
    gameState.actualSeed,
    gameState.grid.length,
    gameState.placedWords.length,
    gameState.difficulty,
    gameState.isKatakana,
    gameState.category?.category,
    gameState.targetWord,
    gameState.gameMode,
    gameState.searchTimeLimitSec,
    clearJoinedFoundBaseline,
    isRoboPickupLounge,
    roboLoungeClearSnapshot,
  ]);

  // Sync finish notifications
  useEffect(() => {
    if (!isMultiplay || !roomId || !roomPlayers.length) return;

    // Check for newly finished players
    roomPlayers.forEach(player => {
      if (player.isFinished && !finishedPlayers.has(player.uid)) {
        // Don't notify for self
        if (player.uid !== userId) {
          const timeStr = player.finishTime ? `${Math.floor(player.finishTime / 60)}分${player.finishTime % 60}秒` : '';
          showToast(`${player.name}さんがゴール！${timeStr ? `（タイム：${timeStr}）` : ''}`);
          vibrate([10, 30, 10]);
        }
        setFinishedPlayers(prev => {
          const next = new Set(prev);
          next.add(player.uid);
          return next;
        });
      }
    });
  }, [roomPlayers, finishedPlayers, userId, showToast, vibrate, isMultiplay, roomId]);

  useEffect(() => {
    if (roomStatus !== 'finished' || isFinished) return;
    // みんなであそぶ（hundredCoop）は「全問クリア」側の演出（横スクロール完了後に表示）に統一する。
    // roomStatus finished をトリガーにすると、固定 1s でモーダルが出てしまいタイミングがズレる。
    if (hundredCoop) return;

    const tid = window.setTimeout(() => {
      setIsFinished(true);
      audioService.playFanfareSound();
      setIsSuccessFlashing(true);

      if (!clearTime) {
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        const m = Math.floor(durationSec / 60);
        const s = Math.floor(durationSec % 60);
        setClearTime(`${m}${t.min}${String(s).padStart(2, '0')}${t.sec}`);
        setClearDate(new Date().toLocaleDateString());
      }
    }, 1000);

    return () => window.clearTimeout(tid);
  }, [roomStatus, isFinished, clearTime, t.min, t.sec]);

  // Sync countdown logic
  useEffect(() => {
    if (isMultiplay && roomStatus === 'start') {
      setStartCountdown(5);
      setShowStartText(false);
    }
  }, [roomStatus, isMultiplay]);

  // カウントダウン処理
  useEffect(() => {
    if (startCountdown > 0) {
      const timer = setTimeout(() => {
        const nextValue = startCountdown - 1;
        setStartCountdown(nextValue);
        vibrate(10);
        if (nextValue === 0) {
          setShowStartText(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [startCountdown]);

  useEffect(() => {
    if (showStartText) {
      const timer = setTimeout(() => setShowStartText(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showStartText]);

  const displayHundredRoster = useMemo(() => {
    if (!hundredCoop || !currentFirebaseUid) return hundredRoster;
    const selfNick = (nickname || '').trim();
    const selfEmoji = (userEmoji || '').trim();
    if (!selfNick && !selfEmoji) return hundredRoster;
    return hundredRoster.map((p) =>
      p.uid === currentFirebaseUid
        ? {
            ...p,
            name: selfNick || p.name,
            emoji: selfEmoji || p.emoji,
          }
        : p,
    );
  }, [hundredCoop, hundredRoster, currentFirebaseUid, nickname, userEmoji]);

  const [hundredPresenceNowMs, setHundredPresenceNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hundredCoop || isFinished) return;
    const id = window.setInterval(() => setHundredPresenceNowMs(Date.now()), HUNDRED_PLAYER_PRESENCE_TICK_MS);
    return () => window.clearInterval(id);
  }, [hundredCoop, isFinished]);

  const roboStaleHintAvailable = useMemo(() => {
    if (!isRoboPickupLounge || isFinished) return false;
    const startedMs = firestoreLikeToMillis(hundredRoomStartedAt);
    if (!startedMs) return false;
    return isRoboLoungeRoundIdle(
      gameState.foundWords,
      gameState.placedWords,
      startedMs,
      firestoreLikeToMillis(hundredRoomLastFoundAt),
      hundredPresenceNowMs,
      ROBO_PICKUP_STALE_HINT_MS,
      firestoreLikeToMillis(hundredRoomUpdatedAt),
    );
  }, [
    isRoboPickupLounge,
    isFinished,
    hundredRoomStartedAt,
    hundredRoomLastFoundAt,
    hundredRoomUpdatedAt,
    gameState.foundWords,
    gameState.placedWords,
    hundredPresenceNowMs,
  ]);

  const pickupHintButtonVisible = hundredHintsAllowed || roboStaleHintAvailable;

  useRoboLoungeLastOccurrenceFill({
    enabled: isRoboPickupLounge && hundredCoop && !isFinished,
    roomId,
    isFinished,
    placedWords: gameState.placedWords,
    foundWords: gameState.foundWords,
    hundredRoomStartedAt,
    hundredRoomLastFoundAt,
    hundredRoomUpdatedAt,
    nowMs: hundredPresenceNowMs,
  });

  useEffect(() => {
    if (hundredCoop && !pickupHintButtonVisible) {
      setHintWord(null);
    }
  }, [hundredCoop, pickupHintButtonVisible]);

  const presentHundredRoster = useMemo(
    () =>
      filterPresentHundredPlayers(displayHundredRoster, {
        nowMs: hundredPresenceNowMs,
        alwaysIncludeUid: currentFirebaseUid,
      }),
    [displayHundredRoster, hundredPresenceNowMs, currentFirebaseUid],
  );

  const activeHundredRoster = useMemo(() => {
    if (!isRoboPickupLounge) return presentHundredRoster;
    return filterRoboLoungeRoundPlayers(
      presentHundredRoster,
      hundredRoomStartedAt,
      gameState.foundWords,
      { nowMs: hundredPresenceNowMs, alwaysIncludeUid: currentFirebaseUid },
    );
  }, [
    isRoboPickupLounge,
    presentHundredRoster,
    hundredRoomStartedAt,
    gameState.foundWords,
    hundredPresenceNowMs,
    currentFirebaseUid,
  ]);

  const hundredPresenceLine = useMemo(
    () => hundredPresenceStatusLine(activeHundredRoster.length),
    [activeHundredRoster.length],
  );

  // 貢献者の計算
  const contributors = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const nameByUid = Object.fromEntries(displayHundredRoster.map((p) => [p.uid, p.name]));
    gameState.foundWords.forEach(fw => {
      const name =
        fw.userName ||
        (fw.playerId && nameByUid[fw.playerId]) ||
        (language === 'ja' ? 'ななし' : 'Anonymous');
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // 上位5名
  }, [gameState.foundWords, language, displayHundredRoster]);

  /** クリア画面ランキング用：この局の foundWords のみ（Firestore の累計 foundCount ではない） */
  const roboLoungeRankingFoundWords =
    isRoboPickupLounge && roboLoungeClearSnapshot
      ? roboLoungeClearSnapshot.foundWords
      : gameState.foundWords;

  const hundredRoundRanking = React.useMemo(
    () =>
      hundredCoop
        ? buildHundredRoundRanking(roboLoungeRankingFoundWords, displayHundredRoster)
        : [],
    [hundredCoop, roboLoungeRankingFoundWords, displayHundredRoster],
  );

  /** みんなであそぶ以外のソロ、またはひと言探しでこの局が1人だけ */
  const isSoloClear = React.useMemo(() => {
    if (isMultiplay && !hundredCoop) return false;
    if (!hundredCoop) return true;
    const isPickupHundred = gameState.category?.category === 'pickup';
    if (isPickupHundred && hundredRoundRanking.length <= 1) return true;
    return false;
  }, [gameState.category?.category, hundredCoop, hundredRoundRanking.length, isMultiplay]);

  useEffect(() => {
    if (
      gameState.gameMode === 'search' &&
      searchCountdownActive &&
      !isFinished &&
      timeLeft > 0 &&
      startCountdown === 0
    ) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Move side effects out of the state setter
            setTimeout(() => {
              setIsFinished(true);
              audioService.playFanfareSound();
              onClear();
              if (hundredCoop) onHundredRoomFinished?.('timeout');
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [
    gameState.gameMode,
    searchCountdownActive,
    isFinished,
    timeLeft,
    startCountdown,
    onClear,
    hundredCoop,
    onHundredRoomFinished,
  ]);

  // 検証コード生成 (SHA-256を使用)
  const generateVerificationCode = async (data: any) => {
    const secret = "kotoba-sagashi-pro-2026-secure-salt"; // アプリ独自の秘密鍵
    const msg = JSON.stringify(data) + secret;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(msg);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // 読みやすさのため12文字の16進数にする
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12).toUpperCase();
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const soloBottomControlsRef = useRef<HTMLDivElement>(null);
  
  const [layout, setLayout] = useState({
    cellSize: 0,
    padding: 8,
    gridOriginX: 8,
    gridOriginY: 8,
    coordGutterLeft: 0,
    coordGutterTop: 0,
    labelFontSize: 12,
    boardSize: 0,
    boardWidth: 0,
    boardHeight: 0,
  });
  const showCoordLayer = streamMode || coordOverlayEnabled;
  /** ヒント・こたえ帯が縦長のため初期値だけ余裕あり（実測で上書き） */
  const [soloBottomControlsPx, setSoloBottomControlsPx] = useState(152);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const particlePool = useRef<ParticlePool>(new ParticlePool(100));
  const requestRef = useRef<number>(0);
  const lastDrawAtMsRef = useRef(0);
  const forceDrawRef = useRef(true);
  const lastActivityAtMsRef = useRef(Date.now());
  /** ロボ放置判定用 — 指操作だけ更新（ロボの正解でリセットしない） */
  const lastUserPointerAtMsRef = useRef(Date.now());
  const lagScoreRef = useRef(0);
  const lastCanvasPixelSizeRef = useRef({ w: 0, h: 0 });
  const hundredCoopRef = useRef(hundredCoop);
  useEffect(() => {
    hundredCoopRef.current = hundredCoop;
  }, [hundredCoop]);
  const hundredRoomFinishSentRef = useRef(false);
  const hundredRoundCompleteRef = useRef(false);
  const isRoboPickupLoungeRef = useRef(isRoboPickupLounge);
  useEffect(() => {
    isRoboPickupLoungeRef.current = isRoboPickupLounge;
  }, [isRoboPickupLounge]);
  const onHundredRoomFinishedRef = useRef(onHundredRoomFinished);
  useEffect(() => {
    onHundredRoomFinishedRef.current = onHundredRoomFinished;
  }, [onHundredRoomFinished]);
  /** みんなであそぶ: 盤面の下地（文字＋正解帯）を増分更新して再描画コストを抑える */
  const baseLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseLayerFoundCountRef = useRef(0);
  const baseLayerBoardKeyRef = useRef('');
  const layoutUpdateRafRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());
  const selectionRef = useRef<Selection>({ start: null, end: null });

  const GRID_PADDING = 8;

  // Solo play: measure the sticky bottom controls height and keep the board above it.
  useLayoutEffect(() => {
    if (hundredCoop) return;
    let raf = 0;
    const measure = () => {
      const el = soloBottomControlsRef.current;
      if (!el) return;
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setSoloBottomControlsPx(h);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(raf);
    };
  }, [hundredCoop, showAnswers]);

  // --- hundredCoop: 自動軽量化（一般ユーザー向けの安全装置） ---
  // 軽量化は「今このゲーム中だけ」適用。新しい盤面/終了でリセット。
  useEffect(() => {
    if (!hundredCoop || isFinished) {
      setAutoCompactMode(false);
      lagScoreRef.current = 0;
    }
  }, [hundredCoop, isFinished, gameState.actualSeed]);

  // 参加者が多いときは早めに自動軽量化（落ちる前に守る）
  useEffect(() => {
    if (!hundredCoop || isFinished) return;
    if (hundredRoster.length >= 12) setAutoCompactMode(true);
  }, [hundredCoop, isFinished, hundredRoster.length]);

  // イベントループ遅延（フリーズ前兆）を監視して自動軽量化
  useEffect(() => {
    if (!hundredCoop || isFinished) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      window.setTimeout(() => {
        if (cancelled) return;
        const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const lagMs = Math.max(0, t1 - t0);
        if (lagMs >= 220) {
          lagScoreRef.current = Math.min(6, lagScoreRef.current + 1);
        } else {
          lagScoreRef.current = Math.max(0, lagScoreRef.current - 1);
        }
        if (lagScoreRef.current >= 3) setAutoCompactMode(true);
      }, 0);
    }, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hundredCoop, isFinished]);

  // 盤面/進捗が更新されたら即時描画を許可（放置判定の lastUserPointerAtMsRef は触らない）
  useEffect(() => {
    if (!hundredCoop || isFinished) return;
    forceDrawRef.current = true;
  }, [hundredCoop, isFinished, gameState.foundWords.length, gameState.grid.length, hundredRoster.length]);

  const showBoardParticipantName = useCallback(
    (name: string, isSelf: boolean) => {
      vibrate(10);
      const label = (name || 'ななしさん').trim() || 'ななしさん';
      showToast(isSelf ? `${label}（あなた）` : label);
    },
    [showToast, vibrate],
  );

  const compactMode = (compactStreamMode || (autoCompactMode && !!hundredCoop && !isFinished));

  const boardParticipants = useMemo(() => {
    if (hundredCoop && activeHundredRoster.length > 0) {
      const hostUid = hundredRoomHostUid;
      const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ja');
      if (!hostUid) {
        return activeHundredRoster.map((p) => ({
          uid: p.uid,
          name: p.name,
          emoji: (p.emoji || '🌸').trim() || '🌸',
        }));
      }
      const host = activeHundredRoster.find((p) => p.uid === hostUid);
      const rest = activeHundredRoster.filter((p) => p.uid !== hostUid).sort(byName);
      const ordered = host ? [host, ...rest] : [...activeHundredRoster].sort(byName);
      return ordered.map((p) => ({
        uid: p.uid,
        name: p.name,
        emoji: (p.emoji || '🌸').trim() || '🌸',
      }));
    }
    if (isMultiplay && roomPlayers.length > 0) {
      return roomPlayers.map((p) => ({
        uid: String(p.uid ?? p.name),
        name: String(p.name ?? 'ななし'),
        emoji: String(p.emoji || '👤').trim() || '👤',
      }));
    }
    return [];
  }, [hundredCoop, activeHundredRoster, hundredRoomHostUid, isMultiplay, roomPlayers]);

  const boardParticipantUids = useMemo(
    () => boardParticipants.map((p) => p.uid),
    [boardParticipants]
  );
  const greenGateByUid = useGreenGateActiveByUids(boardParticipantUids);

  const updateLayout = useCallback(() => {
    if (!mainContentRef.current || !canvasRef.current) return;

    const el = mainContentRef.current;
    const viewportW = window.visualViewport?.width ?? window.innerWidth;
    // px-2/sm:px-3 左右 + 盤面枠 border 分を引いてはみ出しを防ぐ
    const horizontalPad = hundredCoop ? 6 : 28;
    const containerWidth = Math.min(el.clientWidth, Math.max(0, viewportW - horizontalPad));
    const containerHeight = el.clientHeight;

    // reflow 中に一瞬 0 になると盤面を消す → canvas が黒く見える。前回サイズを維持する。
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const edgeInset = hundredCoop ? 0 : 6;
    const gridPad = hundredCoop ? 4 : GRID_PADDING;
    const availableHeight = Math.max(0, containerHeight - edgeInset * 2);
    const availableWidth = Math.max(0, containerWidth - edgeInset * 2);

    const cols = resolveBoardCols({
      boardCols: gameState.boardCols,
      boardSize: gameState.difficulty,
      grid: gameState.grid,
    });
    const rows = resolveBoardRows({
      boardRows: gameState.boardRows,
      boardSize: gameState.difficulty,
      grid: gameState.grid,
    });

    const fitBoard = (
      gutterLeft: number,
      gutterTop: number,
    ): { cellSize: number; boardWidth: number; boardHeight: number } | null => {
      let cellFromWidth = (availableWidth - gutterLeft - gridPad * 2) / cols;
      let cellFromHeight = (availableHeight - gutterTop - gridPad * 2) / rows;
      let cellSize = Math.min(cellFromWidth, cellFromHeight);
      if (!Number.isFinite(cellSize) || cellSize <= 0) return null;

      let boardWidth = gutterLeft + gridPad + cols * cellSize + gridPad;
      let boardHeight = gutterTop + gridPad + rows * cellSize + gridPad;

      if (boardWidth > availableWidth) {
        cellSize = (availableWidth - gutterLeft - gridPad * 2) / cols;
        boardWidth = gutterLeft + gridPad + cols * cellSize + gridPad;
        boardHeight = gutterTop + gridPad + rows * cellSize + gridPad;
      }
      if (boardHeight > availableHeight) {
        cellSize = (availableHeight - gutterTop - gridPad * 2) / rows;
        boardWidth = gutterLeft + gridPad + cols * cellSize + gridPad;
        boardHeight = gutterTop + gridPad + rows * cellSize + gridPad;
      }

      if (cellSize <= 0 || boardWidth <= 0 || boardHeight <= 0) return null;
      return { cellSize, boardWidth, boardHeight };
    };

    let coordGutterLeft = 0;
    let coordGutterTop = 0;
    let labelFontSize = 12;

    let fitted = fitBoard(0, 0);
    if (!fitted) return;

    if (showCoordLayer) {
      const gutter = measureCoordGutter(fitted.cellSize);
      coordGutterLeft = gutter.left;
      coordGutterTop = gutter.top;
      labelFontSize = gutter.fontSize;
      fitted = fitBoard(coordGutterLeft, coordGutterTop);
      if (!fitted) return;
      const refined = measureCoordGutter(fitted.cellSize);
      if (refined.left !== coordGutterLeft || refined.top !== coordGutterTop) {
        coordGutterLeft = refined.left;
        coordGutterTop = refined.top;
        labelFontSize = refined.fontSize;
        fitted = fitBoard(coordGutterLeft, coordGutterTop);
        if (!fitted) return;
      }
    }

    const { cellSize, boardWidth, boardHeight } = fitted;
    const gridOriginX = coordGutterLeft + gridPad;
    const gridOriginY = coordGutterTop + gridPad;

    const nextLayout = {
      cellSize,
      padding: gridPad,
      gridOriginX,
      gridOriginY,
      coordGutterLeft,
      coordGutterTop,
      labelFontSize,
      boardSize: boardWidth,
      boardWidth,
      boardHeight,
    };
    const prev = layoutRef.current;
    const layoutChanged =
      Math.abs(prev.cellSize - nextLayout.cellSize) > 0.01 ||
      Math.abs(prev.boardWidth - nextLayout.boardWidth) > 0.01 ||
      Math.abs(prev.boardHeight - nextLayout.boardHeight) > 0.01 ||
      Math.abs(prev.gridOriginX - nextLayout.gridOriginX) > 0.01 ||
      Math.abs(prev.gridOriginY - nextLayout.gridOriginY) > 0.01 ||
      Math.abs(prev.labelFontSize - nextLayout.labelFontSize) > 0.01;

    if (layoutChanged) {
      layoutRef.current = nextLayout;
      setLayout(nextLayout);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const canvas = canvasRef.current;
    const pixelW = Math.max(1, Math.round(boardWidth * dpr));
    const pixelH = Math.max(1, Math.round(boardHeight * dpr));
    const lastPx = lastCanvasPixelSizeRef.current;

    if (pixelW === lastPx.w && pixelH === lastPx.h) return;

    canvas.width = pixelW;
    canvas.height = pixelH;
    canvas.style.width = `${boardWidth}px`;
    canvas.style.height = `${boardHeight}px`;
    lastCanvasPixelSizeRef.current = { w: pixelW, h: pixelH };

    // width/height 代入でバッファが黒クリアされる（alpha:false）。描画ループを待たず白で埋める。
    const ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = rkCssColor('--rk-white', 'rgb(255 255 255)');
      ctx.fillRect(0, 0, boardWidth, boardHeight);
    }
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
  }, [gameState.boardCols, gameState.boardRows, gameState.difficulty, gameState.grid, hundredCoop, streamMode]);

  useEffect(() => {
    updateLayout();
    let resizeTimer: number;
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateLayout, 200);
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [updateLayout]);

  // Layout can be temporarily 0-height on mobile while bottom UI settles.
  // Observe size changes so the canvas reliably reflows and draws letters.
  useEffect(() => {
    if (!mainContentRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (layoutUpdateRafRef.current) return;
      layoutUpdateRafRef.current = window.requestAnimationFrame(() => {
        layoutUpdateRafRef.current = 0;
        updateLayout();
      });
    });
    ro.observe(mainContentRef.current);
    return () => {
      ro.disconnect();
      if (layoutUpdateRafRef.current) {
        window.cancelAnimationFrame(layoutUpdateRafRef.current);
        layoutUpdateRafRef.current = 0;
      }
    };
  }, [updateLayout]);

  // When a board arrives (especially in hundredCoop), refs may have been null earlier.
  // Force a couple of layout recalcs after mount/update so canvas size + hint width settle.
  useEffect(() => {
    if (!mainContentRef.current || !canvasRef.current) return;
    if (!gameState.grid || gameState.grid.length === 0) return;
    const raf1 = requestAnimationFrame(() => updateLayout());
    const raf2 = requestAnimationFrame(() => updateLayout());
    const t = window.setTimeout(() => updateLayout(), 80);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [updateLayout, gameState.grid.length, gameState.boardCols, gameState.boardRows, gameState.difficulty, soloBottomControlsPx, showAnswers, boardParticipants.length]);

  const isPointOnSegment = (px: number, py: number, start: Point, end: Point) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist === 0) return px === start.x && py === start.y;
    const sx = dx === 0 ? 0 : dx / Math.abs(dx);
    const sy = dy === 0 ? 0 : dy / Math.abs(dy);
    if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
    for (let i = 0; i <= dist; i++) {
      if (Math.round(start.x + sx * i) === px && Math.round(start.y + sy * i) === py) return true;
    }
    return false;
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const enumerateSegmentCells = (start: Point, end: Point): Point[] => {
    const cells: Point[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distInCells = Math.max(Math.abs(dx), Math.abs(dy));
    const unitX = distInCells === 0 ? 0 : dx === 0 ? 0 : dx / distInCells;
    const unitY = distInCells === 0 ? 1 : dy === 0 ? 0 : dy / distInCells;
    for (let i = 0; i <= distInCells; i++) {
      cells.push({
        x: Math.round(start.x + unitX * i),
        y: Math.round(start.y + unitY * i),
      });
    }
    return cells;
  };

  const paintFoundBeadRibbonOnCtx = (
    ctx: CanvasRenderingContext2D,
    fw: GameState['foundWords'][number],
    cellSize: number,
    gridOriginX: number,
    gridOriginY: number,
  ) => {
    if (!fw.start || !fw.end) return;
    const cells = enumerateSegmentCells(fw.start, fw.end);
    if (cells.length === 0) return;

    const beadRadius = cellSize * 0.4;
    const neckThickness = cellSize * 0.16;
    const neckInset = beadRadius * 0.82;

    const cellCenter = (gx: number, gy: number) => ({
      cx: gx * cellSize + gridOriginX + cellSize / 2,
      cy: gy * cellSize + gridOriginY + cellSize / 2,
    });

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = fw.color;

    for (let i = 0; i < cells.length - 1; i++) {
      const c1 = cellCenter(cells[i].x, cells[i].y);
      const c2 = cellCenter(cells[i + 1].x, cells[i + 1].y);
      const angle = Math.atan2(c2.cy - c1.cy, c2.cx - c1.cx);
      const dist = Math.hypot(c2.cx - c1.cx, c2.cy - c1.cy);
      const segLen = Math.max(0, dist - neckInset * 2);
      if (segLen <= 0) continue;
      ctx.save();
      ctx.translate((c1.cx + c2.cx) / 2, (c1.cy + c2.cy) / 2);
      ctx.rotate(angle);
      drawRoundedRect(ctx, -segLen / 2, -neckThickness / 2, segLen, neckThickness, neckThickness / 2);
      ctx.fill();
      ctx.restore();
    }

    for (const cell of cells) {
      const { cx, cy } = cellCenter(cell.x, cell.y);
      ctx.beginPath();
      ctx.arc(cx, cy, beadRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const paintFoundRibbonOnCtx = (
    ctx: CanvasRenderingContext2D,
    fw: GameState['foundWords'][number],
    cellSize: number,
    gridOriginX: number,
    gridOriginY: number,
    answerRibbonThickness: number,
    ribbonExtension: number,
  ) => {
    if (!fw.start || !fw.end) return;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = fw.color;

    const dx = fw.end.x - fw.start.x;
    const dy = fw.end.y - fw.start.y;
    const distInCells = Math.max(Math.abs(dx), Math.abs(dy));
    const unitX = distInCells === 0 ? 0 : dx === 0 ? 0 : dx / distInCells;
    const unitY = distInCells === 0 ? 1 : dy === 0 ? 0 : dy / distInCells;
    const isDiagonal = unitX !== 0 && unitY !== 0;
    const edgeFactor = isDiagonal ? (cellSize / 2) * 0.75 : cellSize / 2 + ribbonExtension;
    const x1 = fw.start.x * cellSize + gridOriginX + cellSize / 2 - unitX * edgeFactor;
    const y1 = fw.start.y * cellSize + gridOriginY + cellSize / 2 - unitY * edgeFactor;
    const x2 = fw.end.x * cellSize + gridOriginX + cellSize / 2 + unitX * edgeFactor;
    const y2 = fw.end.y * cellSize + gridOriginY + cellSize / 2 + unitY * edgeFactor;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    ctx.translate(midX, midY);
    ctx.rotate(angle);
    drawRoundedRect(ctx, -dist / 2, -answerRibbonThickness / 2, dist, answerRibbonThickness, answerRibbonThickness / 2);
    ctx.fill();
    ctx.restore();
  };

  /** ひと言探し（pickup）のみ玉＋細道。それ以外は従来のカプセル帯 */
  const paintAnswerRibbonOnCtx = (
    ctx: CanvasRenderingContext2D,
    fw: GameState['foundWords'][number],
    cellSize: number,
    gridOriginX: number,
    gridOriginY: number,
    answerRibbonThickness: number,
    ribbonExtension: number,
    pickupBeadRibbon: boolean,
  ) => {
    if (pickupBeadRibbon) {
      paintFoundBeadRibbonOnCtx(ctx, fw, cellSize, gridOriginX, gridOriginY);
      return;
    }
    paintFoundRibbonOnCtx(
      ctx,
      fw,
      cellSize,
      gridOriginX,
      gridOriginY,
      answerRibbonThickness,
      ribbonExtension,
    );
  };

  const paintLetterCellOnCtx = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    gs: GameState,
    cellSize: number,
    gridOriginX: number,
    gridOriginY: number,
    displayFontSize: number,
    boardFont: string,
    isFound: boolean,
    revealAnswers: boolean,
    cellOnAnyPlacedOccurrence: (gx: number, gy: number) => boolean,
    paletteOrange700: string,
    paletteSlate800: string,
    paletteWhite: string,
    paletteGlyphStrokeOnFound: string,
    paletteGlyphStrokeOnReveal: string,
  ) => {
    const cx = x * cellSize + gridOriginX + cellSize / 2;
    const cy = y * cellSize + gridOriginY + cellSize / 2;
    const char = gs.grid[y]?.[x];
    if (char == null) return;
    const displayChar = gs.category?.isKanji
      ? char
      : gs.isKatakana
        ? convertToKatakana(char)
        : convertToHiragana(char);
    const strokeW = Math.max(2, displayFontSize * 0.1);
    ctx.font = boardFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isFound) {
      ctx.fillStyle = paletteWhite;
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = paletteGlyphStrokeOnFound;
      ctx.lineJoin = 'round';
      ctx.strokeText(displayChar, cx, cy);
      ctx.fillText(displayChar, cx, cy);
    } else if (revealAnswers && cellOnAnyPlacedOccurrence(x, y)) {
      ctx.fillStyle = paletteOrange700;
      ctx.lineWidth = Math.max(1.5, displayFontSize * 0.07);
      ctx.strokeStyle = paletteGlyphStrokeOnReveal;
      ctx.lineJoin = 'round';
      ctx.strokeText(displayChar, cx, cy);
      ctx.fillText(displayChar, cx, cy);
    } else {
      ctx.fillStyle = paletteSlate800;
      ctx.fillText(displayChar, cx, cy);
    }
  };

  const syncHundredCoopBaseLayer = (
    baseCtx: CanvasRenderingContext2D,
    gs: GameState,
    layout: typeof layoutRef.current,
    revealAnswers: boolean,
    paletteWhite: string,
    paletteOrange700: string,
    paletteSlate800: string,
    paletteGlyphStrokeOnFound: string,
    paletteGlyphStrokeOnReveal: string,
  ) => {
    const { cellSize, gridOriginX, gridOriginY, boardWidth, boardHeight } = layout;
    const baseFontSize = cellSize * 0.65;
    const displayFontSize = baseFontSize * 1.2;
    const boardFont = `500 ${displayFontSize}px "M PLUS Rounded 1c"`;
    const answerRibbonThickness = cellSize * 0.85 * 0.9;
    const ribbonExtension = 0;
    const pickupBeadRibbon = gs.category?.category === 'pickup';
    const boardKey = `${gs.actualSeed ?? ''}|${gs.grid.length}|${boardWidth}|${boardHeight}|${revealAnswers ? 1 : 0}|${pickupBeadRibbon ? 'bead' : 'capsule'}`;
    const foundLen = gs.foundWords.length;
    const needsFull =
      boardKey !== baseLayerBoardKeyRef.current
      || foundLen < baseLayerFoundCountRef.current
      || forceDrawRef.current;

    const cellOnAnyPlacedOccurrence = (gx: number, gy: number) => {
      for (const pw of gs.placedWords || []) {
        for (const occ of pw.occurrences || []) {
          if (isPointOnSegment(gx, gy, occ.start, occ.end)) return true;
        }
      }
      return false;
    };

    const cellIsFound = (gx: number, gy: number) => {
      for (let i = 0; i < gs.foundWords.length; i++) {
        const fw = gs.foundWords[i];
        if (isPointOnSegment(gx, gy, fw.start, fw.end)) return true;
      }
      return false;
    };

    if (needsFull) {
      baseCtx.fillStyle = paletteWhite;
      baseCtx.fillRect(0, 0, boardWidth, boardHeight);
      gs.foundWords.forEach((fw) => {
        paintAnswerRibbonOnCtx(
          baseCtx,
          fw,
          cellSize,
          gridOriginX,
          gridOriginY,
          answerRibbonThickness,
          ribbonExtension,
          pickupBeadRibbon,
        );
      });
      gs.grid.forEach((row, y) => {
        row.forEach((_char, x) => {
          paintLetterCellOnCtx(
            baseCtx,
            x,
            y,
            gs,
            cellSize,
            gridOriginX,
            gridOriginY,
            displayFontSize,
            boardFont,
            cellIsFound(x, y),
            revealAnswers,
            cellOnAnyPlacedOccurrence,
            paletteOrange700,
            paletteSlate800,
            paletteWhite,
            paletteGlyphStrokeOnFound,
            paletteGlyphStrokeOnReveal,
          );
        });
      });
      baseLayerFoundCountRef.current = foundLen;
      baseLayerBoardKeyRef.current = boardKey;
      return;
    }

    if (foundLen <= baseLayerFoundCountRef.current) return;

    const newFound = gs.foundWords.slice(baseLayerFoundCountRef.current);
    const touchedCells = new Set<string>();
    newFound.forEach((fw) => {
      paintAnswerRibbonOnCtx(
        baseCtx,
        fw,
        cellSize,
        gridOriginX,
        gridOriginY,
        answerRibbonThickness,
        ribbonExtension,
        pickupBeadRibbon,
      );
      if (!fw.start || !fw.end) return;
      enumerateSegmentCells(fw.start, fw.end).forEach((cell) => {
        touchedCells.add(`${cell.x},${cell.y}`);
      });
    });
    touchedCells.forEach((key) => {
      const [xs, ys] = key.split(',');
      const gx = Number(xs);
      const gy = Number(ys);
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;
      paintLetterCellOnCtx(
        baseCtx,
        gx,
        gy,
        gs,
        cellSize,
        gridOriginX,
        gridOriginY,
        displayFontSize,
        boardFont,
        true,
        revealAnswers,
        cellOnAnyPlacedOccurrence,
        paletteOrange700,
        paletteSlate800,
        paletteWhite,
        paletteGlyphStrokeOnFound,
        paletteGlyphStrokeOnReveal,
      );
    });
    baseLayerFoundCountRef.current = foundLen;
  };

  const draw = useCallback(() => {
    try {
      const now = Date.now();
      // 配信モード（hundredCoopのプレイ中）は過剰な再描画を抑える（操作時は即時描画）
      if (compactMode) {
        const intervalMs = 4000;
        const recentlyActive = now - lastActivityAtMsRef.current < 1600;
        if (!forceDrawRef.current && now - lastDrawAtMsRef.current < intervalMs) {
          if (!recentlyActive) {
          requestRef.current = requestAnimationFrame(draw);
          return;
          }
        }
        forceDrawRef.current = false;
        lastDrawAtMsRef.current = now;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

      const currentLayout = layoutRef.current;
      const currentGameState = gameStateRef.current;
      const { cellSize, gridOriginX, gridOriginY, boardWidth, boardHeight } = currentLayout;
      // Mobile layout can be 0 for a moment while UI settles.
      // Keep the RAF loop alive so we recover automatically.
      if (cellSize <= 0 || boardWidth <= 0 || boardHeight <= 0) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

    const paletteAmber400 = rkCssColor('--rk-amber-400', 'rgb(251 191 36)');
    const paletteOrange700 = rkCssColor('--rk-orange-700', 'rgb(194 65 12)');
    const paletteSlate800 = rkCssColor('--rk-slate-800', 'rgb(30 41 59)');
    const paletteWhite = rkCssColor('--rk-white', 'rgb(255 255 255)');
    const paletteGlyphStrokeOnFound = rkCssColor('--rk-board-glyph-stroke-on-found', 'rgb(15 23 42 / 0.32)');
    const paletteGlyphStrokeOnReveal = rkCssColor('--rk-board-glyph-stroke-on-reveal', 'rgb(255 255 255 / 0.92)');
    const baseFontSize = cellSize * 0.65;
    const displayFontSize = baseFontSize * 1.2;
    const boardFont = `500 ${displayFontSize}px "M PLUS Rounded 1c"`;
    const hintRibbonThickness = cellSize * 0.85;
    /** 正解帯（ことば探し・ひと言探し・ロボ常設共通）。従来比 1 割細く */
    const answerRibbonThickness = cellSize * 0.85 * 0.9;
    const ribbonExtension = 0;
    const pickupBeadRibbon = currentGameState.category?.category === 'pickup';
    const revealAnswers = showAnswersRef.current;

    let useBaseLayer = hundredCoopRef.current;
    if (useBaseLayer) {
      let base = baseLayerCanvasRef.current;
      if (!base) {
        base = document.createElement('canvas');
        baseLayerCanvasRef.current = base;
      }
      if (base.width !== boardWidth || base.height !== boardHeight) {
        base.width = boardWidth;
        base.height = boardHeight;
        baseLayerFoundCountRef.current = 0;
        baseLayerBoardKeyRef.current = '';
      }
      const baseCtx = base.getContext('2d');
      if (baseCtx) {
        syncHundredCoopBaseLayer(
          baseCtx,
          currentGameState,
          currentLayout,
          revealAnswers,
          paletteWhite,
          paletteOrange700,
          paletteSlate800,
          paletteGlyphStrokeOnFound,
          paletteGlyphStrokeOnReveal,
        );
        ctx.drawImage(base, 0, 0);
      } else {
        useBaseLayer = false;
      }
    }

    if (!useBaseLayer) {
      ctx.fillStyle = paletteWhite;
      ctx.fillRect(0, 0, boardWidth, boardHeight);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 2. Layer: Correct Bands (Thick Strikethrough)
      currentGameState.foundWords.forEach((fw) => {
        paintAnswerRibbonOnCtx(
          ctx,
          fw,
          cellSize,
          gridOriginX,
          gridOriginY,
          answerRibbonThickness,
          ribbonExtension,
          pickupBeadRibbon,
        );
      });

      // 4. Layer: Letters
      ctx.font = boardFont;

      const cellOnAnyPlacedOccurrence = (gx: number, gy: number) => {
        for (const pw of currentGameState.placedWords || []) {
          for (const occ of pw.occurrences || []) {
            if (isPointOnSegment(gx, gy, occ.start, occ.end)) return true;
          }
        }
        return false;
      };

      currentGameState.grid.forEach((row, y) => {
        row.forEach((char, x) => {
          let isFound = false;
          for (let i = 0; i < currentGameState.foundWords.length; i++) {
            if (isPointOnSegment(x, y, currentGameState.foundWords[i].start, currentGameState.foundWords[i].end)) {
              isFound = true;
              break;
            }
          }
          paintLetterCellOnCtx(
            ctx,
            x,
            y,
            currentGameState,
            cellSize,
            gridOriginX,
            gridOriginY,
            displayFontSize,
            boardFont,
            isFound,
            revealAnswers,
            cellOnAnyPlacedOccurrence,
            paletteOrange700,
            paletteSlate800,
            paletteWhite,
            paletteGlyphStrokeOnFound,
            paletteGlyphStrokeOnReveal,
          );
        });
      });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

      // 3. Layer: Hint Highlight
      const hint = hintWordRef.current;
      if (hint) {
      ctx.save();
      // Pulse effect: 5 times (5 seconds at 1000ms per pulse)
      const elapsed = Date.now() - hint.startTime;
      const pulseDuration = 1000; // ms per pulse
      const maxPulses = 5;
      const isPulsing = elapsed < maxPulses * pulseDuration;
      
      const pulse = isPulsing 
        ? (Math.sin(elapsed * (2 * Math.PI / pulseDuration)) + 1) / 2 
        : 1;

      ctx.globalAlpha = isPulsing ? (0.4 + pulse * 0.5) : 0.8; 
      ctx.fillStyle = paletteAmber400;
      ctx.strokeStyle = paletteWhite;
      ctx.lineWidth = 3;

      const dx = hint.end.x - hint.start.x;
      const dy = hint.end.y - hint.start.y;
      const distInCells = Math.max(Math.abs(dx), Math.abs(dy));

      // 「帯」表示（従来どおり）。start===end の場合も短い帯を描く。
      const unitX =
        distInCells === 0 ? 1 : dx === 0 ? 0 : dx / distInCells;
      const unitY =
        distInCells === 0 ? 0 : dy === 0 ? 0 : dy / distInCells;

      const isDiagonal = unitX !== 0 && unitY !== 0;
      // 1マスだけのヒントは短めの帯にする
      const edgeFactor =
        distInCells === 0
          ? cellSize * 0.42
          : isDiagonal
            ? (cellSize / 2) * 0.75
            : (cellSize / 2) + ribbonExtension;

      const ex = (distInCells === 0 ? hint.start.x : hint.end.x) * cellSize + gridOriginX + (cellSize / 2);
      const ey = (distInCells === 0 ? hint.start.y : hint.end.y) * cellSize + gridOriginY + (cellSize / 2);
      const sx = hint.start.x * cellSize + gridOriginX + (cellSize / 2);
      const sy = hint.start.y * cellSize + gridOriginY + (cellSize / 2);

      const x1 = sx - unitX * edgeFactor;
      const y1 = sy - unitY * edgeFactor;
      const x2 = ex + unitX * edgeFactor;
      const y2 = ey + unitY * edgeFactor;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

      ctx.translate(midX, midY);
      ctx.rotate(angle);

      const currentThickness = hintRibbonThickness * (1 + pulse * 0.1);
      drawRoundedRect(ctx, -dist / 2, -currentThickness / 2, dist, currentThickness, currentThickness / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Layer: Selection Highlight (Green Circles)
    const sel = activeSelectionRef.current;
    if (sel.start && sel.end) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = rkResolvedAccentPrimary();

      const dx = sel.end.x - sel.start.x;
      const dy = sel.end.y - sel.start.y;
      const distInCells = Math.max(Math.abs(dx), Math.abs(dy));
      const unitX = distInCells === 0 ? 0 : (dx === 0 ? 0 : dx / distInCells);
      const unitY = distInCells === 0 ? 1 : (dy === 0 ? 0 : dy / distInCells);

      for (let i = 0; i <= distInCells; i++) {
        const cx = (sel.start.x + unitX * i) * cellSize + gridOriginX + cellSize / 2;
        const cy = (sel.start.y + unitY * i) * cellSize + gridOriginY + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Layer: Particles (Top)
    if (!compactMode) {
      particlePool.current.pool.forEach(p => {
      if (p.life > 0) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2;
        p.life -= 0.03; p.rotation += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
      }
      });
    }

      requestRef.current = requestAnimationFrame(draw);
    } catch (e) {
      // Never stop drawing loop due to transient errors (e.g. grid/layout races).
      console.error('[GameScreen] draw error', e);
      requestRef.current = requestAnimationFrame(draw);
    }
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(requestRef.current);
  }, [draw]);

  // みんなであそぶは「出現座標（occurrence）」で数える方が安定（同じ単語が複数回出る/拾う）。
  const countByOccurrence = !!hundredCoop;
  const isKotobaHiroi = !!hundredCoop && gameState.category?.category === 'pickup';

  const gridCols = React.useMemo(
    () =>
      resolveBoardCols({
        boardCols: gameState.boardCols,
        boardSize: gameState.difficulty,
        grid: gameState.grid,
      }),
    [gameState.boardCols, gameState.difficulty, gameState.grid],
  );
  const gridRows = React.useMemo(
    () =>
      resolveBoardRows({
        boardRows: gameState.boardRows,
        boardSize: gameState.difficulty,
        grid: gameState.grid,
      }),
    [gameState.boardRows, gameState.difficulty, gameState.grid],
  );

  const adultChallengeShareUrl = React.useMemo(() => {
    if (!isSoloClear || searchModeTimedOut || gameState.actualSeed === undefined) return null;
    if (hundredCoop) {
      return buildSamePuzzleChallengeUrlFromGameState(gameState, gridCols, gridRows, { hundredPickup: true });
    }
    return buildSamePuzzleChallengeUrlFromGameState(gameState, gridCols, gridRows);
  }, [gameState, gridCols, gridRows, hundredCoop, isSoloClear, searchModeTimedOut]);

  const isRectBoard = gridCols !== gridRows;

  // ことば拾いは「出現回数」をカウント（同じ単語を何回も拾う）。方向スキャンの重複は1マス1回。
  const foundCount = React.useMemo(() => {
    if (!countByOccurrence) {
      // ソロ等: 「単語」単位でカウント（同じ単語が盤面に複数あっても 1つ見つければ正解）
      return new Set(gameState.foundWords.map((fw) => fw.word)).size;
    }
    return countUniqueFoundOccurrences(gameState.foundWords);
  }, [gameState.foundWords, countByOccurrence]);

  const totalCount = React.useMemo(() => {
    if (!countByOccurrence) return gameState.placedWords.length;
    return countPlacedWordOccurrences(gameState.placedWords);
  }, [gameState.placedWords, countByOccurrence]);

  /** 5分放置 → らくだロボが粛々とクリアまで（みんなであそぶは1人のときだけ） */
  const kotobaRoboIdleEnabled = React.useMemo(() => {
    if (isMultiplay) return false;
    if (searchCountdownActive) return false;
    if (hundredCoop && hundredRoster.length > 1) return false;
    if (!gameState.placedWords?.length) return false;
    const cat = gameState.category?.category;
    if (cat === 'pickup') return true;
    if (gameState.gameMode === 'search' || gameState.gameMode === 'normal') return true;
    return false;
  }, [
    gameState.category?.category,
    gameState.gameMode,
    gameState.placedWords?.length,
    hundredCoop,
    hundredRoster.length,
    isMultiplay,
    searchCountdownActive,
  ]);

  const handleRoboFind = useCallback(
    (word: string, start: Point, end: Point) => {
      onUpdateFound(word, start, end, false, { robo: true });
    },
    [onUpdateFound],
  );

  const roboIdleToastShownRef = useRef(false);
  const { roboIdleActive } = useKotobaRoboIdleFinish({
    enabled: kotobaRoboIdleEnabled,
    isFinished,
    startCountdown,
    countByOccurrence,
    placedWords: gameState.placedWords,
    foundWords: gameState.foundWords,
    onRoboFind: handleRoboFind,
    getLastActivityMs: () => lastUserPointerAtMsRef.current,
    onRoboStarted: () => {
      if (roboIdleToastShownRef.current) return;
      roboIdleToastShownRef.current = true;
      showToast(`${RAKUDA_ROBO_EMOJI} ${RAKUDA_ROBO_NAME}がそばで続けています`);
    },
  });

  useEffect(() => {
    if (!isFinished) return;
    roboIdleToastShownRef.current = false;
  }, [isFinished, gameState.actualSeed]);

  // Safety: never show "8/7" etc even if data gets temporarily inconsistent.
  // Also use this for clear/progress so gameplay doesn't break.
  const safeFoundCount = React.useMemo(() => {
    if (totalCount <= 0) return Math.max(0, foundCount);
    return Math.min(foundCount, totalCount);
  }, [foundCount, totalCount]);

  // Firestore 同期が落ち着いてから「参加時点の found 数」を baseline に固定
  useEffect(() => {
    if (!gameState.grid?.length) return;
    if (joinedFoundBaselineRef.current !== null) return;

    joinedBaselineTimerRef.current = window.setTimeout(() => {
      // 参加直後にすでに全問見つけ済みだと baseline=total になりクリア演出が永遠に出ない → 1つ手前にずらす
      joinedFoundBaselineRef.current =
        totalCount > 0 && safeFoundCount >= totalCount
          ? Math.max(0, totalCount - 1)
          : safeFoundCount;
      lastFoundWordsCount.current = gameState.foundWords.length;
      joinedBaselineTimerRef.current = null;
      setJoinedBaselineLockTick((n) => n + 1);
    }, 800);

    return () => {
      if (joinedBaselineTimerRef.current != null) {
        window.clearTimeout(joinedBaselineTimerRef.current);
        joinedBaselineTimerRef.current = null;
      }
    };
  }, [
    gameState.actualSeed,
    gameState.grid.length,
    gameState.placedWords.length,
    gameState.difficulty,
    safeFoundCount,
    totalCount,
    gameState.foundWords.length,
  ]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isFinished || startCountdown > 0) return;
    audioService.noteUserGesture();
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
    lastUserPointerAtMsRef.current = Date.now();
    setHintWord(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left - layout.gridOriginX) / layout.cellSize);
    const y = Math.floor((e.clientY - rect.top - layout.gridOriginY) / layout.cellSize);
    if (x >= 0 && x < gridCols && y >= 0 && y < gridRows) {
      const point = { x, y };
      selectionRef.current = { start: point, end: point };
      setActiveSelection({ start: point, end: point });
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!selectionRef.current.start) return;
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
    lastUserPointerAtMsRef.current = Date.now();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left - layout.gridOriginX) / layout.cellSize);
    const y = Math.floor((e.clientY - rect.top - layout.gridOriginY) / layout.cellSize);
    const gs = gameStateRef.current;
    const cols = resolveBoardCols({
      boardCols: gs.boardCols,
      boardSize: gs.difficulty,
      grid: gs.grid,
    });
    const rows = resolveBoardRows({
      boardRows: gs.boardRows,
      boardSize: gs.difficulty,
      grid: gs.grid,
    });
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      const newEnd = { x, y };
      const dx = newEnd.x - selectionRef.current.start.x;
      const dy = newEnd.y - selectionRef.current.start.y;
      if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
        selectionRef.current.end = newEnd;
        setActiveSelection({ ...selectionRef.current });
      }
    }
  }, [layout, gridCols, gridRows]);

  const handlePointerUp = useCallback(() => {
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
    lastUserPointerAtMsRef.current = Date.now();
    const sel = selectionRef.current;
    if (!sel.start || !sel.end) {
      setActiveSelection({ start: null, end: null });
      return;
    }
    const dx = sel.end.x - sel.start.x;
    const dy = sel.end.y - sel.start.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (dist >= 0 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
      const sx = dx === 0 ? 0 : dx / Math.abs(dx);
      const sy = dy === 0 ? 0 : dy / Math.abs(dy);
      let chars = "";
      for (let i = 0; i <= dist; i++) {
        chars += gameState.grid[sel.start.y + sy * i][sel.start.x + sx * i];
      }

      /**
       * 判定を「文字列一致」ではなく「座標（occurrence）一致」優先にする。
       * 表示（ひらがな/カタカナ/漢字）や正規化差分で文字列がズレても、
       * 盤面生成が返した occurrences と同じ座標をなぞっていれば正解にする。
       */
      const findOccurrenceMatch = () => {
        const s = sel.start!;
        const e = sel.end!;
        for (const pw of gameState.placedWords) {
          for (const occ of pw.occurrences || []) {
            const forward =
              occ.start.x === s.x && occ.start.y === s.y && occ.end.x === e.x && occ.end.y === e.y;
            const backward =
              occ.start.x === e.x && occ.start.y === e.y && occ.end.x === s.x && occ.end.y === s.y;
            if (forward || backward) return { pw, occ };
          }
        }
        return null;
      };

      const matched = findOccurrenceMatch();
      if (matched) {
        const { pw, occ } = matched;

        if (!isKotobaHiroi) {
          // 重複排除: 同じ単語は 1 回だけ正解にする（別の場所の出現はカウントしない）
          if (gameState.foundWords.some((fw) => fw.word === pw.word)) {
            selectionRef.current = { start: null, end: null };
            setActiveSelection({ start: null, end: null });
            return;
          }
        } else {
          // ことば拾い: 同じ単語でも「同じ座標の出現」だけ重複排除
          const already = gameState.foundWords.some(
            (fw) =>
              (fw.start.x === occ.start.x &&
                fw.start.y === occ.start.y &&
                fw.end.x === occ.end.x &&
                fw.end.y === occ.end.y) ||
              (fw.start.x === occ.end.x &&
                fw.start.y === occ.end.y &&
                fw.end.x === occ.start.x &&
                fw.end.y === occ.start.y)
          );
          if (already) {
            selectionRef.current = { start: null, end: null };
            setActiveSelection({ start: null, end: null });
            return;
          }
        }

        setStreakCount((s) => s + 1);
        onUpdateFound(pw.word, occ.start, occ.end);
        if (!hundredCoop) {
          audioService.noteUserGesture();
          audioService.playCorrectSound();
        }

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const px =
            ((occ.start.x + occ.end.x) / 2) * layout.cellSize + layout.cellSize / 2 + layout.gridOriginX;
          const py =
            ((occ.start.y + occ.end.y) / 2) * layout.cellSize + layout.cellSize / 2 + layout.gridOriginY;

          const colorIdx = gameState.foundWords.length % rkBandColorCount();
          const color = rkResolvedBandColor(colorIdx);

          for (let i = 0; i < 8; i++) particlePool.current.emit(px, py, color);
        }
      } else {
        // Fallback: Only when occurrences are unavailable.
        // If we have occurrences, we must require coordinate match; otherwise false-positives occur
        // on boards with many repeating letters (e.g., え/も/じ).
        const hasAnyOcc = (gameState.placedWords || []).some((x: any) => Array.isArray(x?.occurrences) && x.occurrences.length > 0);
        if (hasAnyOcc) {
          selectionRef.current = { start: null, end: null };
          setActiveSelection({ start: null, end: null });
          return;
        }

        // Occurrences missing: allow string-based match as last resort.
        const norm = convertToHiragana(chars);
        const rev = convertToHiragana(chars.split('').reverse().join(''));
        const pw = (gameState.placedWords || []).find((x: any) => {
          const w = typeof x?.word === 'string' ? x.word : '';
          if (!w) return false;
          const wn = convertToHiragana(w);
          return wn === norm || wn === rev;
        }) as any;

        if (pw && typeof pw.word === 'string') {
          if (!isKotobaHiroi) {
            if (gameState.foundWords.some((fw) => fw.word === pw.word)) {
              selectionRef.current = { start: null, end: null };
              setActiveSelection({ start: null, end: null });
              return;
            }
          }
          setStreakCount((s) => s + 1);
          onUpdateFound(pw.word, sel.start, sel.end);
          if (!hundredCoop) {
            audioService.noteUserGesture();
            audioService.playCorrectSound();
          }
        }
      }
    }
    selectionRef.current = { start: null, end: null };
    setActiveSelection({ start: null, end: null });
  }, [gameState, layout, streakCount, onUpdateFound, safeFoundCount, totalCount, showAnswers, hundredCoop]);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const displayWords = React.useMemo(() => {
    return [...gameState.placedWords].sort((a, b) => {
      if (a.word.length !== b.word.length) return a.word.length - b.word.length;
      return a.word.localeCompare(b.word);
    });
  }, [gameState.placedWords]);

  // 回答一覧: みつけた語は緑系、未発見はオレンジ枠で区別（盤面は showAnswers 時に未発見正解マスをオレンジ文字に）
  const foundWordSet = React.useMemo(
    () => new Set(gameState.foundWords.map((fw) => fw.word)),
    [gameState.foundWords]
  );

  useEffect(() => {
    if (!foundProgressAfterJoin(safeFoundCount)) return;
    if (totalCount > 1 && safeFoundCount === totalCount - 1 && !isFinished) {
      setShowLastOneBonus(true);
      audioService.playBonusSound();
      const timer = setTimeout(() => setShowLastOneBonus(false), FLY_BANNER_DURATION_SEC * 1000);
      return () => clearTimeout(timer);
    }
  }, [safeFoundCount, totalCount, isFinished]);

  /** ロボ常設: 全問クリアをスナップショットで固定（他端末の「次のお題」で結果が消えない） */
  useEffect(() => {
    if (!isRoboPickupLounge || roboLoungeClearSnapshot) return;
    if (totalCount <= 0 || safeFoundCount < totalCount) return;
    const targetWord = displaySearchWord;
    const snap: RoboLoungeClearSnapshot = {
      targetWord,
      foundWords: [...gameState.foundWords],
    };
    setRoboLoungeClearSnapshot(snap);
    activateRoboLoungeResultsHold(targetWord);
  }, [
    isRoboPickupLounge,
    roboLoungeClearSnapshot,
    safeFoundCount,
    totalCount,
    displaySearchWord,
    gameState.foundWords,
  ]);

  /** 全問クリア直後：ロボ常設は横スクロール演出を省略（結果画面を最優先） */
  useEffect(() => {
    if (!isRoboPickupLounge) return;
    if (!roboLoungeClearSnapshot || isFinished) return;
    setShowLastOneBonus(false);
    setShowClearFlyBonus(false);
  }, [isRoboPickupLounge, roboLoungeClearSnapshot, isFinished]);

  /** 全問クリア直後：ことば探し・みんなであそぶ（ロボ常設以外） */
  useEffect(() => {
    if (isRoboPickupLounge) return;
    if (totalCount <= 0 || safeFoundCount !== totalCount || isFinished) return;
    setShowLastOneBonus(false);
    setShowClearFlyBonus(true);
    audioService.playBonusSound();
    return () => setShowClearFlyBonus(false);
  }, [safeFoundCount, totalCount, isFinished, isRoboPickupLounge, joinedBaselineLockTick]);

  useEffect(() => {
    hundredRoomFinishSentRef.current = false;
  }, [gameState.actualSeed, roomId]);

  useEffect(() => {
    hundredRoundCompleteRef.current =
      isRoboPickupLounge
        ? !!roboLoungeClearSnapshot
        : totalCount > 0 && safeFoundCount === totalCount;
  }, [isRoboPickupLounge, roboLoungeClearSnapshot, totalCount, safeFoundCount]);

  // みんなであそぶ: クリア演出の待ち時間より先にルーム終了を Firestore へ（離脱しても一覧に残らない）
  useEffect(() => {
    if (!hundredCoop || isRoboPickupLounge || isFinished) return;
    if (totalCount <= 0 || safeFoundCount !== totalCount) return;
    if (hundredRoomFinishSentRef.current) return;
    hundredRoomFinishSentRef.current = true;
    void onHundredRoomFinished?.('cleared');
  }, [
    hundredCoop,
    isRoboPickupLounge,
    isFinished,
    totalCount,
    safeFoundCount,
    onHundredRoomFinished,
  ]);

  useEffect(() => {
    return () => {
      if (
        hundredCoopRef.current &&
        !isRoboPickupLoungeRef.current &&
        hundredRoundCompleteRef.current &&
        !hundredRoomFinishSentRef.current
      ) {
        hundredRoomFinishSentRef.current = true;
        void onHundredRoomFinishedRef.current?.('cleared');
      }
    };
  }, []);

  useEffect(() => {
    const roundComplete = isRoboPickupLounge
      ? !!roboLoungeClearSnapshot
      : totalCount > 0 && safeFoundCount === totalCount;
    if (!roundComplete || isFinished) return;

    const delayMs = isRoboPickupLounge ? 0 : clearFlyModalDelayMsRef.current;
    const tid = window.setTimeout(() => {
      const gs = gameStateRef.current;
      const nextConsecutive = consecutiveClearsRef.current + 1;
      setIsFinished(true);
      setDisplayConsecutiveClears(nextConsecutive);
      audioService.playFanfareSound();
      setIsSuccessFlashing(true);
      if (hundredCoop && gs.category?.category === 'pickup' && onHundredPickupClearInterstitial) {
        void onHundredPickupClearInterstitial();
      }
      if (hundredCoop && isRoboPickupLounge) {
        void (async () => {
          if (onLeaveHundredRoom && !hundredClearAutoLeaveDoneRef.current) {
            hundredClearAutoLeaveDoneRef.current = true;
            await onLeaveHundredRoom();
          }
          await onRoboPickupLoungeAutoRefresh?.();
        })();
      } else if (hundredCoop && onLeaveHundredRoom && !hundredClearAutoLeaveDoneRef.current) {
        hundredClearAutoLeaveDoneRef.current = true;
        void onLeaveHundredRoom();
      }

      if (!isRoboPickupLounge) onClear();

      const durationSec = (Date.now() - startTimeRef.current) / 1000;
      const m = Math.floor(durationSec / 60);
      const s = Math.floor(durationSec % 60);
      const durStr = `${m}${t.min}${String(s).padStart(2, '0')}${t.sec}`;
      setClearTime(durStr);
      setClearDate(new Date().toLocaleDateString());
      onSaveHistory({
        id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleString(),
        type: 'TASK_REPORT', tag: 'SUCCESS', 
        message: `${t.logClear}${getCategoryDisplayTitle(String(gs.category?.title || "ことば探し"), language, gs.isKatakana)}`,
        details: { 
          category: String(gs.category?.category || "unknown"), 
          difficulty: gs.difficulty,
          boardCols: gridCols,
          boardRows: gridRows,
          boardLabel: formatBoardDimensions({
            boardCols: gs.boardCols,
            boardRows: gs.boardRows,
            boardSize: gs.difficulty,
          }),
          targetWord: gs.targetWord || gs.category?.words?.[0] || '',
          roomId: hundredCoop ? roomId || undefined : undefined,
          foundCount: safeFoundCount, 
          totalCount: totalCount, 
          duration: durStr,
          mode: hundredCoop ? 'hundred_pickup' : gs.gameMode || 'normal',
        },
        category: gs.category // Add category object for App.tsx fallback
      });
    }, delayMs);

    return () => window.clearTimeout(tid);
    // 最後の正解から、クリア横スクロール終了直後にクリアモーダル（所要時間はラストワンと同じ px/s に合わせた clearFlyModalDelayMs）。deps は最小にする。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- コールバックは ref / 安定参照で遅延内取得
  }, [
    safeFoundCount,
    totalCount,
    isFinished,
    isRoboPickupLounge,
    roboLoungeClearSnapshot,
    joinedBaselineLockTick,
  ]);

  const handleHint = () => {
    if (hundredCoop && !pickupHintButtonVisible) return;

    const normWord = (w: string) => convertToHiragana(String(w ?? '').trim());

    const unfoundOccurrences: { word: string; start: Point; end: Point }[] = [];
    gameState.placedWords.forEach((pw) => {
      pw.occurrences.forEach((occ) => {
        const already = gameState.foundWords.some(
          (fw) =>
            (fw.start.x === occ.start.x &&
              fw.start.y === occ.start.y &&
              fw.end.x === occ.end.x &&
              fw.end.y === occ.end.y) ||
            (fw.start.x === occ.end.x &&
              fw.start.y === occ.end.y &&
              fw.end.x === occ.start.x &&
              fw.end.y === occ.start.y),
        );
        if (!already) {
          unfoundOccurrences.push({ word: pw.word, ...occ });
        }
      });
    });

    if (unfoundOccurrences.length === 0) {
      showToast('ヒントはもうありません');
      return;
    }

    // みんなであそぶ / 探しもの: 探すことばだけ（表記ゆれ イチゴ↔いちご も同一扱い）
    const primaryWord = String(gameState.targetWord ?? gameState.category?.words?.[0] ?? '').trim();
    const useTargetWordOnly = countByOccurrence || isKotobaHiroi;
    let pool = unfoundOccurrences;
    if (useTargetWordOnly && primaryWord) {
      const primaryNorm = normWord(primaryWord);
      pool = unfoundOccurrences.filter((x) => normWord(x.word) === primaryNorm);
    } else if (!useTargetWordOnly) {
      // ソロ等: 単語単位（1語見つけたら他の出現はヒント対象外）
      pool = unfoundOccurrences.filter(
        (x) => !gameState.foundWords.some((fw) => fw.word === x.word),
      );
    }

    if (pool.length === 0) {
      showToast('ヒントはもうありません');
      return;
    }

    const randomOcc = pool[Math.floor(Math.random() * pool.length)];
    vibrate(30);
    setHintWord({ ...randomOcc, startTime: Date.now() });
    setTimeout(() => setHintWord(null), 5000);
  };

  const handleShowAnswers = () => {
    if (hundredCoop) return; // みんなであそぶでは不要
    if (showAnswers) return;
    setShowAnswers(true);
    vibrate(10);
  };

  const handleGenerateSeed = useCallback(() => {
    if (!gameState.category || gameState.actualSeed === undefined) return;
    
    // Use proCode if available, otherwise fallback to legacy format
    const generatedSeed = proCode || `${gameState.category.category}-${gameState.difficulty}-${gameState.actualSeed}`;
    
    navigator.clipboard.writeText(generatedSeed).then(() => {
      vibrate(10);
      showToast(language === 'ja' ? `合言葉 [${generatedSeed}] をコピーしました！` : `Copied seed [${generatedSeed}]!`);
    }).catch(() => {
      // Fallback if clipboard fails
      alert(language === 'ja' ? `合言葉: ${generatedSeed}` : `Seed: ${generatedSeed}`);
    });
  }, [gameState, proCode, language, showToast, vibrate]);

  const progress = Math.min((safeFoundCount / (totalCount || 1)) * 100, 100);

  const [gridLoadStuck, setGridLoadStuck] = useState(false);
  const waitingForHundredBoard =
    hundredCoop &&
    (!gameState.grid || gameState.grid.length === 0) &&
    (showHundredHostStart || showHundredGuestWait);
  useEffect(() => {
    if (gameState.grid?.length) {
      setGridLoadStuck(false);
      return;
    }
    if (waitingForHundredBoard) {
      setGridLoadStuck(false);
      return;
    }
    const tid = window.setTimeout(() => setGridLoadStuck(true), 8_000);
    return () => window.clearTimeout(tid);
  }, [gameState.grid, waitingForHundredBoard]);

  if (!gameState.grid || gameState.grid.length === 0) {
    if (hundredCoop) {
      return null;
    }

    const handleLoadingBack = () => {
      void onBack();
    };

    return (
      <div className="relative flex flex-col h-full w-full items-center justify-center overflow-hidden rk-bg-game-solo-shell">
        <RakudaFloatingBackdrop variant="kotoba" />
        <div className="relative z-10 w-16 h-16 border-4 rounded-xl animate-pulse mb-4 border-rk-amber-300" />
        <p className="relative z-10 font-medium text-rk-slate-700 text-sm">パズルを読み込み中...</p>
        <p className="relative z-10 text-rk-slate-600 text-xs mt-2 px-6 text-center">しばらくお待ちください</p>
        {gridLoadStuck ? (
          <div className="relative z-10 mt-6 flex flex-col items-center gap-2 px-6">
            <p className="text-xs text-rk-slate-500 text-center leading-relaxed">
              時間がかかっています。いったんもどってもう一度お試しください。
            </p>
            <button type="button" className={btnGhost} onClick={handleLoadingBack}>
              もどる
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const displayEmoji = compactMode ? '' : (userEmoji || '🐫').trim() || '🐫';
  const kotobaCategoryTitleDisplayed =
    gameState.gameMode === 'search'
      ? ''
      : getCategoryDisplayTitle(String(gameState.category?.title || ''), language, gameState.isKatakana);
  const kotobaCategoryTitleMultiline = kotobaCategoryTitleDisplayed.includes('\n');
  /** iPad ソロ: ヘッダー・下ボタンを詰めて盤面領域を確保（実幅レイアウト） */
  const tabletSolo = !hundredCoop && isTabletTouchLayout();
  return (
    <div
      style={{
        paddingTop: hundredCoop ? undefined : tabletSolo ? 4 : 8,
        paddingBottom: hundredCoop ? 4 : tabletSolo ? 4 : 8,
        fontFamily: '"M PLUS Rounded 1c", sans-serif',
      }}
      className={`flex flex-col h-full min-h-0 w-full select-none relative items-center ${
        hundredCoop
          ? 'overflow-hidden justify-between pb-[calc(var(--rk-bottom-banner,0px)+env(safe-area-inset-bottom)+12px)] bg-gradient-to-b from-[var(--rk-game-parchment-from)] via-[var(--rk-game-parchment-via)] to-[var(--rk-game-parchment-to)] pt-[max(0.25rem,env(safe-area-inset-top))]'
          : 'overflow-hidden justify-between pb-[calc(var(--rk-bottom-banner,0px)+env(safe-area-inset-bottom)+12px)) rk-bg-game-solo-shell'
      }`}
    >
      <RakudaFloatingBackdrop
        variant={hundredCoop ? 'minna' : 'kotoba'}
        className={hundredCoop ? 'max-md:hidden' : ''}
      />

      {adminStreamLiveBadgeControl && hundredCoop && !isFinished ? (
        <button
          type="button"
          onClick={() => {
            vibrate(10);
            onToggleStreamLiveBadge?.();
          }}
          disabled={!onToggleStreamLiveBadge}
          aria-pressed={streamLiveBadgeEnabled}
          aria-label={
            streamLiveBadgeEnabled
              ? `${RK_STREAM_LIVE_BADGE_LABEL} ON — タップでOFF`
              : `${RK_STREAM_LIVE_BADGE_LABEL} OFF — タップでON`
          }
          className={`fixed left-1/2 -translate-x-1/2 top-[max(0.35rem,env(safe-area-inset-top))] z-[60] px-5 py-1 rounded-lg border-4 text-[22px] md:text-2xl font-black tracking-wide whitespace-nowrap select-none transition-colors active:scale-[0.98] disabled:opacity-40 ${
            streamLiveBadgeEnabled
              ? 'border-rk-red-600 bg-rk-red-600 text-rk-white shadow-lg'
              : 'border-rk-slate-500/35 bg-rk-slate-700/20 text-rk-slate-600/65 shadow-sm'
          }`}
        >
          {RK_STREAM_LIVE_BADGE_LABEL}
        </button>
      ) : null}

      <div
        className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0 overflow-hidden"
        aria-hidden
      >
        <span
          ref={lastFlyMeasureRef}
          className="inline-block font-black tracking-wide whitespace-nowrap text-rk-orange-500"
          style={FLY_BANNER_MEASURE_STYLE}
        >
          {t.lastOne}
        </span>
        <span
          ref={clearFlyMeasureRef}
          className="inline-block font-black tracking-wide whitespace-nowrap text-rk-red-500"
          style={FLY_BANNER_MEASURE_STYLE}
        >
          {t.clearFly}
        </span>
      </div>

      {showLastOneBonus && (
        <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
          <motion.div
            // 右端（親の 100%）の外側から入り、左へ走り抜けて消える
            initial={{ x: '0%' }}
            animate={{ x: `-${LAST_ONE_FLY_X_PERCENT}%` }}
            transition={{ duration: FLY_BANNER_DURATION_SEC, ease: 'linear' }}
            className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap"
            style={{ left: '100%' }}
          >
            <span className="font-black tracking-wide text-rk-orange-500" style={FLY_BANNER_MEASURE_STYLE}>
              {t.lastOne}
            </span>
          </motion.div>
        </div>
      )}
      {showClearFlyBonus && (
        <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
          <motion.div
            initial={{ x: '0%' }}
            animate={{ x: `-${CLEAR_FLY_X_PERCENT}%` }}
            transition={{ duration: clearFlyMotionDurationSec, ease: 'linear' }}
            onAnimationComplete={() => setShowClearFlyBonus(false)}
            className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap"
            style={{ left: '100%' }}
          >
            <span className="font-black tracking-wide text-rk-red-500" style={FLY_BANNER_MEASURE_STYLE}>
              {t.clearFly}
            </span>
          </motion.div>
        </div>
      )}

      {floatingTexts.map(ft => (
        <div
          key={ft.id}
          className="fixed pointer-events-none z-[700] font-medium text-sm text-rk-white whitespace-nowrap"
          style={{ left: ft.x, top: ft.y, WebkitTextStroke: `2px ${ft.color}` }}
        >
          {ft.text}
        </div>
      ))}

      {isFinished && (
        <div
          className={`fixed inset-0 z-[500] flex items-center justify-center p-4 overflow-hidden backdrop-blur-sm ${
            hundredCoop ? 'bg-[color-mix(in_srgb,var(--rk-game-parchment-from)_92%,transparent)]' : 'bg-rk-amber-200/92'
          }`}
        >
          <button
            type="button"
            onClick={leaveFromClearScreen}
            className={`fixed z-[510] left-3 ${btnGhost} p-2 font-medium active:scale-95 transition-transform`}
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
            aria-label="戻る"
          >
            <ChevronLeft size={24} />
          </button>
          <RakudaFloatingBackdrop variant={hundredCoop ? 'minna' : 'kotoba'} className="z-0" />
          
          <div 
            className={`${cardClass} flex flex-col w-[85%] max-w-[450px] relative z-10 max-h-[85vh] overflow-hidden`}
            style={{ paddingTop: '5vh', paddingBottom: '4vh' }}
          >
            <h2 
              className={`text-sm font-medium text-center leading-none px-4 flex-shrink-0 text-rk-slate-700`}
              style={{ marginBottom: '5vh' }}
            >
              {searchModeTimedOut ? 'タイムアップ！' : (displayConsecutiveClears > 1 ? t.consecutiveClear(displayConsecutiveClears) : t.clear)}
            </h2>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar" style={{ marginBottom: '3vh' }}>
              <div 
                className="flex flex-col gap-4 font-bold text-rk-slate-700 text-sm w-full"
                style={{ paddingLeft: '15%', paddingRight: '15%' }}
              >
                {[
                  { label: 'なまえ：', value: `${displayEmoji}${nickname || userId}`, isSelfName: true },
                  { label: t.categoryLabel, value: (
                    <div className="flex items-center gap-1 justify-end">
                      <span className="max-w-[min(100vw-8rem,220px)] text-right whitespace-pre-line line-clamp-3 break-words">
                        {gameState.gameMode === 'search'
                          ? `探しもの：「${displaySearchWord}」`
                          : getCategoryDisplayTitle(String(gameState.category?.title || ''), language, gameState.isKatakana)}
                      </span>
                      {gameState.category?.isKanji && (
                        <span className="bg-rk-sky-50 text-rk-slate-700 text-[10px] px-2 py-1 rounded-xl border border-rk-sky-200 shadow-sm leading-none">漢字</span>
                      )}
                    </div>
                  ), isTruncate: false },
                  { label: t.difficultyLabel, value: `${gridCols}×${gridRows}` },
                  { label: 'こたえの数：', value: `${totalCount}個` },
                  { label: t.timeLabel, value: clearTime },
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between border-b border-rk-slate-50 pb-1 w-full"
                  >
                    <span className="text-rk-slate-400 whitespace-nowrap">{item.label}</span>
                    <span className={`${(item as { isSelfName?: boolean }).isSelfName ? RK_GATE_NICK_DISPLAY_CLASS : ''} ${item.isTruncate ? 'truncate ml-4' : ''}`}>
                      {item.value}
                    </span>
                  </div>
                ))}

                {(isMultiplay || hundredCoop) && (
                  <div className="mt-4 w-full">
                    <div className="text-[10px] text-rk-slate-400 mb-2 border-b border-rk-slate-100 pb-1 flex justify-between items-center">
                      <span>
                        {hundredCoop
                          ? (language === 'ja' ? '参加者ランキング（この局の見つけた数）' : 'Ranking (this round)')
                          : isSyncMode
                            ? (language === 'ja' ? '見つけた人ランキング' : 'Top Finders')
                            : (language === 'ja' ? 'ゴール順位表' : 'Leaderboard')}
                      </span>
                      {!isSyncMode && !hundredCoop && (
                        <span className="animate-pulse text-[10px] bg-rk-success-50 text-rk-slate-700 p-2 rounded-xl border border-rk-success-200">LIVE</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                      {hundredCoop ? (
                        hundredRoundRanking.map((p, idx) => (
                          <div
                            key={p.uid}
                            className={`flex justify-between text-[11px] ${p.uid === userId ? `${RK_GATE_NICK_DISPLAY_CLASS} font-black` : 'text-rk-slate-600'}`}
                          >
                            <span className={`truncate max-w-[160px] ${p.uid === userId ? RK_GATE_NICK_DISPLAY_CLASS : ''}`}>
                              {idx + 1}. {compactMode ? '' : (p.emoji || '👤')} {p.name}
                            </span>
                            <span className="tabular-nums">{p.foundCount}個</span>
                          </div>
                        ))
                      ) : isSyncMode ? (
                        contributors.map(([name, count], idx) => {
                          const player = roomPlayers.find(rp => rp.name === name);
                          const isSelf = name === (nickname || '').trim() || name === nickname;
                          return (
                            <div key={idx} className="flex justify-between text-[11px] text-rk-slate-600">
                              <span className={`truncate max-w-[120px] ${isSelf ? RK_GATE_NICK_DISPLAY_CLASS : ''}`}>{idx + 1}. {compactMode ? '' : (player?.emoji || '👤')} {name}</span>
                              <span>{count}個</span>
                            </div>
                          );
                        })
                      ) : (
                        roomPlayers
                          .filter(p => p.isActive)
                          .sort((a, b) => {
                            if (a.isFinished && b.isFinished) return (a.finishTime || 0) - (b.finishTime || 0);
                            if (a.isFinished) return -1;
                            if (b.isFinished) return 1;
                            return 0;
                          })
                          .map((p, idx) => {
                            const timeStr = p.finishTime ? `${Math.floor(p.finishTime / 60)}:${String(p.finishTime % 60).padStart(2, '0')}` : (language === 'ja' ? 'プレイ中...' : 'Playing...');
                            return (
                              <div key={p.uid} className={`flex justify-between text-[11px] ${p.uid === userId ? `${RK_GATE_NICK_DISPLAY_CLASS} font-black` : 'text-rk-slate-600'}`}>
                                <span className={`truncate max-w-[120px] ${p.uid === userId ? RK_GATE_NICK_DISPLAY_CLASS : ''}`}>{idx + 1}. {compactMode ? '' : (p.emoji || '👤')} {p.name}</span>
                                <span className="tabular-nums">{timeStr}</span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-3 flex-shrink-0" style={{ paddingLeft: '15%', paddingRight: '15%' }}>
              {!searchModeTimedOut && isSoloClear ? (
                <LiveClearReportSoloPanel
                  kind={isKotobaHiroi ? 'hitokoto' : 'kotoba'}
                  showToast={showToast}
                  vibrate={vibrate}
                  adultChallengeShareUrl={adultChallengeShareUrl}
                />
              ) : null}
              {showHundredRoboReplay ? (
                <button
                  type="button"
                  disabled={roboReplayBusy}
                  onClick={() => void handleRakudaRoboReplay()}
                  className={`${btnPrimary} w-full h-11`}
                >
                  {roboReplayBusy ? '準備中…' : `${RAKUDA_ROBO_EMOJI} らくだロボでもう一回`}
                </button>
              ) : null}
              {isFinished && showHundredHostStart ? (
                <div className="w-full">{hundredHostStartButton}</div>
              ) : null}
              {isFinished && showHundredGuestWait ? (
                <p className="text-sm font-medium text-rk-slate-600 text-center leading-snug px-2">
                  前のお題はおわりました。次のお題を待っています。
                </p>
              ) : null}
              <button
                type="button"
                onClick={leaveFromClearScreen}
                className={`${btnGhost} w-full h-11`}
              >
                {hundredCoop ? 'ひと言探しにもどる' : '問題一覧にもどる'}
              </button>
              {hundredCoop && hundredRoundRanking.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5 mt-1 max-w-[220px] md:max-w-[420px] overflow-hidden">
                  {hundredRoundRanking.slice(0, 10).map((p) => (
                    <span
                      key={p.uid}
                      title={p.name}
                      className="inline-flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl border border-rk-slate-200 bg-rk-white text-base md:text-lg shadow-sm"
                    >
                      {compactMode ? '' : p.emoji}
                    </span>
                  ))}
                  {hundredRoundRanking.length > 10 ? (
                    <span className="text-[10px] font-bold text-rk-slate-600 tabular-nums">+{hundredRoundRanking.length - 10}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className={`relative z-10 flex flex-col gap-1.5 w-full max-w-3xl flex-shrink-0 min-h-0 ${hundredCoop ? 'mb-0 px-2' : 'gap-2 px-4 mb-0'}`}>
        {hundredCoop ? (
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex items-start gap-1.5 w-full">
            <RK19QuietRoomBackButton
              onClick={handleHundredBoardBack}
              title={
                hundredCoop && !isFinished && isHundredHost ? '中断（募集も終了）' : 'もどる'
              }
            />
            <div className="flex items-start gap-0.5 min-w-0 flex-1 leading-none pt-0.5">
              <span className="font-black text-rk-amber-900/90 text-[20px] md:text-[24px] shrink-0 pointer-events-none select-none">
                🔎
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-rk-amber-900/90 text-[17px] md:text-[24px] leading-tight pointer-events-none select-none">
                  らくだ珈琲
                </span>
                <span className="mt-0.5 font-bold text-rk-amber-900/75 text-[14px] md:text-[18px] leading-tight pointer-events-none select-none">
                  ひと言探し
                </span>
              </div>
            </div>
            {!isFinished && isHundredHost && !isRoboPickupLounge ? (
              <div className="shrink-0 flex items-center gap-1.5">
                {isKotobaHiroi ? (
                  <button
                    type="button"
                    disabled={hintsToggleBusy}
                    className={`w-[4.25rem] md:w-[5.25rem] h-9 md:h-10 rounded-xl border-2 text-xs md:text-sm font-black shadow-sm active:scale-95 transition-transform flex flex-col items-center justify-center leading-tight ${
                      hundredHintsAllowed
                        ? 'border-rk-sky-400 bg-rk-sky-200/95 text-rk-slate-800'
                        : 'border-rk-slate-300 bg-rk-slate-100 text-rk-slate-500'
                    } ${hintsToggleBusy ? 'opacity-60' : ''}`}
                    onClick={() => void handleHostToggleHints()}
                    aria-label={hundredHintsAllowed ? 'ヒントをオフにする' : 'ヒントをオンにする'}
                    aria-pressed={hundredHintsAllowed}
                  >
                    <span className="text-sm leading-none">☝️</span>
                    <span className="text-[10px] md:text-xs">{hundredHintsAllowed ? 'あり' : 'なし'}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="w-[4.25rem] md:w-[5.25rem] h-9 md:h-10 rounded-xl border-2 border-rk-rose-400 bg-rk-rose-300/95 text-rk-rose-950 text-xs md:text-sm font-black shadow-sm active:scale-95 transition-transform flex items-center justify-center"
                  onClick={() => setShowHostInterruptConfirm(true)}
                  aria-label="ゲームを中断する"
                >
                  中断
                </button>
              </div>
            ) : null}
          </div>
          <div className="w-full flex items-center justify-center gap-2 bg-rk-white rounded-xl border border-rk-slate-200 shadow-sm px-2.5 py-1.5">
            <span className="text-[21px] leading-none shrink-0">{gameState.category?.emoji}</span>
            <div className="flex flex-col items-center justify-center text-center min-w-0 flex-1">
              <div className="flex items-center justify-center gap-1 min-w-0 w-full">
                <h3
                  className={
                    gameState.gameMode === 'search'
                      ? `${pageTopHeadingClass} text-rk-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-full`
                      : kotobaCategoryTitleMultiline
                        ? 'text-xl md:text-2xl font-black tracking-tight leading-snug text-rk-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-full'
                        : `${pageTopHeadingClass} text-rk-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-full`
                  }
                >
                  {gameState.gameMode === 'search' ? (
                    <>
                      <span className="md:hidden">
                        <span className="block">「{displaySearchWord}」</span>
                        <span className="block">をさがせ！</span>
                      </span>
                      <span className="hidden md:inline">「{displaySearchWord}」をさがせ！</span>
                    </>
                  ) : (
                    kotobaCategoryTitleDisplayed
                  )}
                </h3>
                {gameState.category?.isKanji && (
                  <span className="bg-rk-sky-50 text-rk-slate-700 text-[10px] px-2 py-1 rounded-xl border border-rk-sky-200 flex-shrink-0 shadow-sm">漢字</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mt-0.5">
                <span className="text-[14px] md:text-[18px] font-black text-rk-slate-700 tabular-nums leading-none text-center whitespace-nowrap">
                  {gridCols}×{gridRows} {safeFoundCount}/{totalCount}
                </span>
              </div>
            </div>
          </div>
          {!isFinished && (boardParticipants.length > 0 || hundredPresenceLine) ? (
            <div className="w-full flex flex-col items-center gap-0.5 py-0.5" aria-label="参加者">
              {hundredPresenceLine ? (
                <p className="text-center text-[11px] font-medium text-rk-slate-600 leading-snug">
                  {hundredPresenceLine}
                </p>
              ) : null}
              {boardParticipants.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5 flex-wrap w-full">
                  {boardParticipants.slice(0, 12).map((p) => {
                    const isSelf = !!currentFirebaseUid && p.uid === currentFirebaseUid;
                    return (
                      <button
                        type="button"
                        key={p.uid}
                        onClick={() => showBoardParticipantName(p.name, isSelf)}
                        aria-label={`${p.name}の名前を表示`}
                        className={`inline-flex h-[2.1rem] w-[2.1rem] md:h-[2.4rem] md:w-[2.4rem] items-center justify-center rounded-xl border bg-rk-white text-[1.2rem] md:text-[1.35rem] shadow-sm active:scale-95 transition-transform ${
                          isSelf ? 'border-rk-primary ring-2 ring-rk-primary/40' : 'border-rk-slate-200'
                        }`}
                      >
                        <RakudaGreenGateEmoji size="md" greenGate={greenGateByUid[p.uid]}>
                          {p.emoji}
                        </RakudaGreenGateEmoji>
                      </button>
                    );
                  })}
                  {boardParticipants.length > 12 ? (
                    <span className="text-[10px] font-bold text-rk-slate-600 tabular-nums">
                      +{boardParticipants.length - 12}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : (
        <div
          className={`flex justify-between items-center relative ${
            tabletSolo ? 'min-h-[3rem]' : 'min-h-[4.5rem] md:min-h-[6rem]'
          }`}
        >
          <div className="flex gap-0.5 md:gap-1 shrink-0 z-10 min-w-0 max-w-[40%] sm:max-w-[34%] items-start">
            <RK19QuietRoomBackButton
              onClick={handleHundredBoardBack}
              title="もどる"
            />
            <div className="flex items-start gap-0.5 min-w-0 leading-none">
              <span className="font-black text-rk-amber-900/90 text-[24px] shrink-0 pointer-events-none select-none">
                🔎
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-rk-amber-900/90 text-[24px] whitespace-nowrap pointer-events-none select-none">
                  らくだ珈琲
                </span>
                <span className="mt-0.5 font-bold text-rk-amber-900/75 text-[17px] md:text-[18px] whitespace-nowrap pointer-events-none select-none">
                  ことば探し
                </span>
              </div>
            </div>
          </div>

          <div
            className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 bg-rk-white rounded-xl border border-rk-slate-200 shadow-sm z-0 min-w-[200px] md:min-w-[340px] max-w-[calc(100%-5.5rem)] md:max-w-[calc(100%-8rem)] h-full ${tabletSolo ? 'px-2 py-1' : 'px-3 py-2'}`}
          >
            <span className="text-[21px] leading-none">{gameState.category?.emoji}</span>
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-1">
                <h3
                  className={
                    gameState.gameMode === 'search'
                      ? `${pageTopHeadingClass} text-rk-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-[220px] md:max-w-[420px]`
                      : kotobaCategoryTitleMultiline
                        ? 'text-xl md:text-2xl font-black tracking-tight leading-snug text-rk-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-[220px] md:max-w-[420px]'
                        : `${pageTopHeadingClass} text-rk-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-[220px] md:max-w-[420px]`
                  }
                >
                  {gameState.gameMode === 'search' ? (
                    <>
                      <span className="md:hidden">
                        <span className="block">「{displaySearchWord}」</span>
                        <span className="block">をさがせ！</span>
                      </span>
                      <span className="hidden md:inline">「{displaySearchWord}」をさがせ！</span>
                    </>
                  ) : (
                    kotobaCategoryTitleDisplayed
                  )}
                </h3>
                {gameState.category?.isKanji && (
                  <span className="bg-rk-sky-50 text-rk-slate-700 text-[10px] px-2 py-1 rounded-xl border border-rk-sky-200 flex-shrink-0 shadow-sm">漢字</span>
                )}
              </div>
              <div className={`flex items-center justify-center gap-2 ${hundredCoop ? 'mt-0.5' : 'mt-1'}`}>
                <span className={`${hundredCoop ? 'text-[14px] md:text-[18px]' : 'text-[16px] md:text-[21px]'} font-black text-rk-slate-700 tabular-nums leading-none text-center whitespace-nowrap`}>
                  {gridCols}×{gridRows} {safeFoundCount}/{totalCount}
                </span>
                {gameState.gameMode === 'search' && gameState.category?.category === 'search' && !hundredCoop ? (
                  <div className="flex flex-col items-center ml-2 min-w-[100px] md:min-w-[150px]">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-base font-bold text-rk-slate-700 bg-rk-amber-50 px-3 py-2 rounded-xl border border-rk-amber-200 shadow-sm leading-none">
                        {displaySearchWord}
                      </span>
                    </div>
                    {/* 時間制限は設けないため、カウントダウン表示は出さない */}
                  </div>
                ) : null}
                {isMultiplay && (proCode || displayRoomCode) && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <div className={`p-2 rounded-xl text-[10px] font-medium flex items-center gap-1 shadow-sm border ${isSyncMode ? 'bg-rk-sky-50 text-rk-slate-700 border-rk-sky-200' : 'bg-rk-amber-50 text-rk-slate-700 border-rk-amber-200'}`}>
                        <span className="opacity-60">{isSyncMode ? '🤝' : '🏁'}</span>
                        <span>{isSyncMode ? '協力' : '対戦'}</span>
                      </div>
                      {roomPlayers.length > 1 && (
                        <div className="bg-rk-sky-50 text-rk-slate-700 px-2 py-1 rounded-xl text-[10px] font-medium flex items-center gap-1 shadow-sm border border-rk-sky-200">
                          <span className="opacity-60">👤</span>
                          <span>{roomPlayers.length}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-rk-slate-50 text-rk-slate-700 p-2 rounded-xl text-[10px] font-medium flex items-center gap-1 border border-rk-slate-200 self-start">
                      <span className="opacity-60">🏠</span>
                      <span>{displayRoomCode || proCode}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="w-12 h-12 flex-shrink-0" aria-hidden />
        </div>
        )}
        <div className="h-1.5 w-full bg-rk-slate-200/50 rounded-xl overflow-hidden border border-rk-slate-200 mt-1">
          <div className="h-full bg-rk-success-200 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        {roboIdleActive && !isFinished ? (
          <p className="mt-0.5 text-center text-[11px] font-bold text-rk-slate-500 leading-snug">
            {RAKUDA_ROBO_EMOJI} {RAKUDA_ROBO_NAME}が続けています
          </p>
        ) : null}
      </div>

      <AnimatePresence>
        {isMultiplay && roomStatus === 'end' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-rk-amber-200/90 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`${cardClass} w-full max-w-md text-center`}
            >
              <div className="text-sm mb-3">🏁</div>
              <h2 className="text-sm font-medium text-rk-slate-700 mb-2">
                {language === 'ja' ? '終了！' : 'Game Over!'}
              </h2>
              <p className="text-xs text-rk-slate-600 mb-3">
                {language === 'ja' ? '全員がクリアしました！' : 'Everyone has finished!'}
              </p>

              <div className="space-y-2 mb-3">
                {roomPlayers.sort((a, b) => (a.finishTime || 999) - (b.finishTime || 999)).map((player, i) => (
                  <div key={player.uid} className="flex items-center justify-between bg-rk-slate-50 p-3 rounded-xl border border-rk-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-rk-success-50 text-rk-slate-700 rounded-xl border border-rk-success-200 font-medium text-xs">
                        {i + 1}
                      </span>
                      <span className={`font-medium text-sm ${player.uid === userId ? RK_GATE_NICK_DISPLAY_CLASS : 'text-rk-slate-700'}`}>{player.name}</span>
                    </div>
                    <span className="font-mono font-medium text-rk-slate-700 text-sm">
                      {player.finishTime ? `${player.finishTime}s` : '--'}
                    </span>
                  </div>
                ))}
              </div>

              <button 
                onClick={onBack}
                className={`${btnGhost} w-full`}
              >
                {language === 'ja' ? 'タイトルへ戻る' : 'Back to Title'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHostInterruptConfirm ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] flex items-center justify-center bg-rk-slate-900/45 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hundred-host-interrupt-title"
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="max-w-[min(92vw,24rem)] rounded-2xl border-4 border-rk-rose-200 bg-rk-white px-6 py-5 shadow-2xl text-center"
            >
              <p id="hundred-host-interrupt-title" className="text-base font-black text-rk-slate-800 leading-snug">
                中断してもいいですか？
              </p>
              <p className="mt-2 text-xs font-medium text-rk-slate-600 leading-relaxed">
                募集も終了し、他の参加者にも知らせることになります
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={hostInterruptInFlight}
                  className="min-h-[44px] px-4 rounded-xl bg-rk-rose-500 text-rk-white text-sm font-black shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60"
                  onClick={() => void performHostInterrupt()}
                >
                  {hostInterruptInFlight ? '中断中…' : '中断する'}
                </button>
                <button
                  type="button"
                  disabled={hostInterruptInFlight}
                  className="min-h-[44px] px-4 rounded-xl border-2 border-rk-slate-200 bg-rk-white text-rk-slate-800 text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
                  onClick={() => setShowHostInterruptConfirm(false)}
                >
                  キャンセル
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showGuestInterruptedModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] flex items-center justify-center bg-rk-slate-900/45 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hundred-guest-interrupt-title"
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="max-w-[min(92vw,24rem)] rounded-2xl border-4 border-rk-amber-300 bg-rk-amber-50 px-6 py-5 shadow-2xl text-center"
            >
              <p id="hundred-guest-interrupt-title" className="text-base font-black text-rk-amber-950 leading-snug">
                ホストによりゲームは中断されました
              </p>
              <button
                type="button"
                className="mt-4 min-h-[44px] w-full px-4 rounded-xl bg-rk-amber-500 text-rk-white text-sm font-black shadow-sm active:scale-[0.98] transition-transform"
                onClick={() => {
                  setShowGuestInterruptedModal(false);
                  goToRecruitBoard();
                }}
              >
                ひと言探しへ
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        ref={mainContentRef}
        className={`z-10 flex-1 min-h-0 min-w-0 flex items-center justify-center w-full ${
          hundredCoop ? 'px-0.5 overflow-hidden' : 'px-2 sm:px-3 overflow-y-auto overflow-x-hidden'
        }`}
      >
          <div 
          ref={containerRef} 
            className={`relative box-border max-w-full max-h-full bg-rk-white rounded-xl shadow-sm border border-rk-slate-200 overflow-hidden touch-none flex items-center justify-center shrink min-w-0 mx-auto ${hundredCoop ? 'my-0' : 'my-1'}`}
          style={{
            width: layout.boardWidth || layout.boardSize || 'auto',
            maxWidth: '100%',
            height: layout.boardHeight || layout.boardSize || 'auto',
            maxHeight: '100%',
          }} 
        >
          <canvas 
            ref={canvasRef} 
              className="rounded-xl bg-rk-white shadow-sm cursor-crosshair max-w-full max-h-full" 
            onPointerDown={handlePointerDown}
          />

          {showCoordLayer && layout.cellSize > 0 && (
            <div
              className="absolute inset-0 z-[5] pointer-events-none select-none"
              aria-hidden
            >
              {Array.from({ length: gridCols }, (_, col) => (
                <div
                  key={`coord-col-${col}`}
                  className="absolute flex items-center justify-center font-bold text-rk-sky-600 leading-none"
                  style={{
                    left: layout.gridOriginX + col * layout.cellSize,
                    top: 0,
                    width: layout.cellSize,
                    height: layout.coordGutterTop,
                    fontSize: layout.labelFontSize,
                  }}
                >
                  {boardGridColumnLabel(col)}
                </div>
              ))}
              {Array.from({ length: gridRows }, (_, row) => (
                <div
                  key={`coord-row-${row}`}
                  className="absolute flex items-center justify-center font-bold text-rk-sky-600 leading-none tabular-nums"
                  style={{
                    left: 0,
                    top: layout.gridOriginY + row * layout.cellSize,
                    width: layout.coordGutterLeft,
                    height: layout.cellSize,
                    fontSize: layout.labelFontSize,
                  }}
                >
                  {row + 1}
                </div>
              ))}
            </div>
          )}

          {/* Countdown Overlay */}
          {(startCountdown > 0 || showStartText) && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-rk-white/30 backdrop-blur-[2px] pointer-events-none">
              <div className={`font-medium text-rk-slate-700 transition-all duration-300 transform
                ${startCountdown > 0 ? 'text-sm scale-110 animate-pulse' : 'text-sm opacity-0'}
                ${showStartText ? 'text-sm opacity-100' : ''}`}>
                {startCountdown > 0 ? startCountdown : (showStartText ? 'GO!' : '')}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isFinished && !hundredCoop && boardParticipants.length > 0 ? (
        <div
          className="mx-auto w-full max-w-2xl flex-shrink-0 flex flex-col items-center gap-0.5 relative z-10 px-4 mb-2"
          aria-label="参加者"
        >
          <div
            className="flex items-center justify-center gap-1.5 flex-wrap"
            style={{
              width: layout.boardWidth || layout.boardSize ? `${layout.boardWidth || layout.boardSize}px` : '100%',
              maxWidth: '100%',
            }}
          >
            {boardParticipants.slice(0, 12).map((p) => {
              const isSelf = !!userId && p.uid === userId;
              return (
                <span
                  key={p.uid}
                  title={p.name}
                  className={`inline-flex h-[2.1rem] w-[2.1rem] md:h-[2.4rem] md:w-[2.4rem] items-center justify-center rounded-xl border bg-rk-white text-[1.2rem] md:text-[1.35rem] shadow-sm ${
                    isSelf ? 'border-rk-primary ring-2 ring-rk-primary/40' : 'border-rk-slate-200'
                  }`}
                >
                  <RakudaGreenGateEmoji size="md" greenGate={greenGateByUid[p.uid]}>
                    {p.emoji}
                  </RakudaGreenGateEmoji>
                </span>
              );
            })}
            {boardParticipants.length > 12 ? (
              <span className="text-[10px] font-bold text-rk-slate-600 tabular-nums">
                +{boardParticipants.length - 12}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {isRoboPickupLounge && !isFinished ? (
        <div className="relative z-10 w-full max-w-3xl flex-shrink-0 px-2 mt-1 space-y-1.5">
          <RoboPickupLoungeGuide variant="compact" rotateLines title={roboPickupLoungeTitleForRoom(roomId)} />
          {!isFinished && totalCount > 0 && safeFoundCount < totalCount ? (
            <p className="text-center text-[11px] font-medium text-rk-slate-600 leading-snug">
              みんなで {safeFoundCount}/{totalCount} — 全部見つけると結果が出ます
            </p>
          ) : null}
        </div>
      ) : null}

      {!isFinished && hundredCoop && pickupHintButtonVisible && (
        <div
          className="w-full px-4 flex items-center justify-center z-20 flex-shrink-0"
          style={{
            marginBottom: streamMode
              ? 0
              : 'calc(var(--rk-bottom-banner, 0px) + env(safe-area-inset-bottom) + 8px)',
          }}
        >
          <div
            className="w-full"
            style={{
              maxWidth:
                layout.boardWidth || layout.boardSize
                  ? `${layout.boardWidth || layout.boardSize}px`
                  : '100%',
            }}
          >
          <button
            onClick={handleHint}
            className="w-full bg-rk-sky-200 text-rk-slate-700 rounded-xl shadow-sm border border-rk-sky-200 transition-transform flex items-center justify-center gap-2 font-medium active:scale-95 flex-shrink-0 px-4 py-[1.4rem] min-h-[3.15rem]"
          >
            <span className="text-base leading-snug">☝️{t.hint}</span>
          </button>
          </div>
        </div>
      )}

      {/* ことば探しのみ: 広告の直上に固定表示（ボタンが消えないように） */}
      {!isFinished && !hundredCoop && (
        <div
          ref={soloBottomControlsRef}
          className="w-full px-4 z-50 flex flex-col items-center gap-2 flex-shrink-0"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
          }}
        >
          <div
            className="w-full flex flex-col items-stretch gap-2"
            style={{
              maxWidth:
                layout.boardWidth || layout.boardSize
                  ? `${layout.boardWidth || layout.boardSize}px`
                  : '100%',
            }}
          >
          <button
            onClick={handleHint}
            className={`w-full bg-rk-sky-200 text-rk-slate-700 rounded-xl shadow-sm border border-rk-sky-200 transition-transform flex items-center justify-center gap-2 font-medium active:scale-95 flex-shrink-0 px-4 ${tabletSolo ? 'py-4 min-h-[3rem]' : 'py-8 min-h-[4.5rem]'}`}
          >
            <span className={`${tabletSolo ? 'text-base' : 'text-lg'} leading-snug`}>☝️{t.hint}</span>
          </button>

          <div
            className={`bg-rk-success-50 text-rk-slate-700 rounded-xl shadow-sm border border-rk-success-200 transition-colors relative overflow-hidden flex flex-col items-center w-full
              ${showAnswers ? 'max-h-[45vh]' : ''} ${!showAnswers ? 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer' : ''}`}
            onClick={handleShowAnswers}
          >
            <div className={`w-full h-full flex flex-col items-center justify-center ${showAnswers ? 'p-3' : 'p-0'}`}>
              {!showAnswers ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowAnswers();
                  }}
                  className={`w-full flex items-center justify-center gap-2 font-black leading-snug active:scale-95 transition-transform px-4 ${tabletSolo ? 'text-base py-4 min-h-[3rem]' : 'text-lg py-8 min-h-[4.5rem]'}`}
                >
                  <span aria-hidden>🔍</span>
                  <span className="font-black">{t.showAnswers}</span>
                </button>
              ) : (
                <div className="w-full flex flex-col overflow-hidden">
                  <div className="flex flex-col gap-1.5 mb-2 flex-shrink-0">
                    <div className="flex justify-between items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAnswers(false);
                        }}
                        className="text-[10px] font-medium bg-rk-white text-rk-slate-700 p-2 rounded-xl border border-rk-slate-200 hover:bg-rk-slate-50 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"/></svg>
                        とじる
                      </button>
                      <div className="text-[10px] font-medium text-rk-slate-700 tabular-nums bg-rk-white px-2 py-1.5 rounded-xl border border-rk-slate-200 font-black">
                        {safeFoundCount}/{totalCount}
                      </div>
                    </div>
                    <div className="flex justify-center gap-4 text-[9px] font-black text-rk-slate-600 tracking-tight">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rk-success-600 shadow-sm shrink-0" aria-hidden />
                        みつけた
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm border-2 border-rk-orange-500 bg-rk-orange-100 shrink-0" aria-hidden />
                        あと
                      </span>
                    </div>
                  </div>

                  <div className="flex-grow overflow-y-auto custom-scrollbar-white pr-1">
                    <div className="flex flex-wrap gap-x-2 gap-y-1.5 justify-center pb-2">
                      {displayWords.map((pw, i) => {
                        const isAllFound = foundWordSet.has(pw.word);
                        const isHinting = !isAllFound && hintWord?.word === pw.word;
                        return (
                          <div key={i} className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isAllFound) return;
                                const unfoundOcc = pw.occurrences.find(
                                  (occ) =>
                                    !gameState.foundWords.some(
                                      (fw) =>
                                        fw.start.x === occ.start.x &&
                                        fw.start.y === occ.start.y &&
                                        fw.end.x === occ.end.x &&
                                        fw.end.y === occ.end.y
                                    )
                                );
                                if (!unfoundOcc) return;
                                setHintWord({ ...unfoundOcc, word: pw.word, startTime: Date.now() });
                                setTimeout(() => setHintWord(null), 5000);
                              }}
                              disabled={isAllFound}
                              aria-label={
                                isAllFound
                                  ? `みつけた: ${pw.word}`
                                  : `まだ: ${pw.word}（タップでヒント）`
                              }
                              className={`min-w-[2.5rem] px-2.5 py-2 rounded-xl text-xs font-black transition-all border-2 shadow-sm ${
                                isAllFound
                                  ? 'bg-rk-success-600 text-rk-white border-rk-success-800 shadow-rk-success-900/30 cursor-default ring-0'
                                  : isHinting
                                    ? 'bg-rk-amber-200 text-rk-amber-950 border-rk-amber-500 ring-2 ring-rk-amber-400/90 scale-[1.02]'
                                    : 'bg-rk-white text-rk-slate-900 border-rk-orange-400 hover:bg-rk-orange-50 hover:border-rk-orange-500 active:scale-[0.98]'
                              }`}
                              style={{ lineHeight: '0.8' }}
                            >
                              {gameState.category?.isKanji
                                ? pw.word
                                : gameState.isKatakana
                                  ? convertToKatakana(pw.word)
                                  : convertToHiragana(pw.word)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameScreen;