import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { GameState, Point, Selection, LogEntry, PlacedWord, WordOccurrence } from '../types';
import { convertToHiragana, convertToKatakana, getCategoryDisplayTitle, getPublicUrl } from '../constants';
import { inviteRoomCodeForShare } from './AppUIHelpers';
import { audioService } from '../services/audioService';
import RakudaFloatingBackdrop from './RakudaFloatingBackdrop';
import { btnGhost, btnPrimary, cardClass } from '../ui/policy';
import { pageTopHeadingClass } from '../ui/typography';
import QRCode from 'qrcode';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { applyHostCancelledHundredGeneration } from '../lib/hundredRecruitCancel';

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
  onUpdateFound: (word: string, start: Point, end: Point, isHint?: boolean) => void;
  onBack: () => void;
  /** みんなであそぶ（掲示板）へ戻す専用導線（任意） */
  onBackToBoard?: () => void | Promise<void>;
  showToast: (msg: string) => void;
  onSaveHistory: (log: LogEntry) => void;
  onSpendPoints: (amount: number) => void;
  onShowFullScreenAd: (count: number) => void;
  vibrate: (pattern?: number | number[]) => void;
  language: 'ja';
  totalPoints: number;
  isOnline: boolean;
  onClear: () => void;
  onClearSeed: () => void;
  userId: string;
  onAddPoints: (amount: number, reason: string) => void;
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
  onBackToTitle?: () => void;
  /** みんなであそぶ協力（同期盤・hundred_rooms） */
  hundredCoop?: boolean;
  hundredRoster?: { uid: string; name: string; emoji: string; foundCount: number }[];
  /** hundred_rooms.hostUid（ホストが離脱するとき確認）。`userId`(アプリUUID)ではなく Firebase Auth の uid と比較する */
  hundredRoomHostUid?: string | null;
  /** Firebase Auth の uid（ホスト判定用） */
  currentFirebaseUid?: string | null;
  onHundredRoomFinished?: (reason: 'timeout' | 'cleared') => void;
  /** 配信モード（軽量化） */
  streamMode?: boolean;
}

const BAND_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA502", "#7BED9F", "#70A1FF", "#FF7F50", "#A29BFE", "#E84393", "#2ED573"];

/**
 * 飛び出しの「速度」= 表示要素の横幅に対する移動量(px)/秒。
 * ラストワンを基準（-200% を 2.4s）とし、クリア文言は実測幅で同じ px/s になるよう所要時間だけ伸ばす。
 */
const FLY_BANNER_DURATION_SEC = 2.4;
const LAST_ONE_FLY_X_PERCENT = 200;
/** 長文でも左に流れ切るよう、自己幅に対する移動 %（ラストワンより多め） */
const CLEAR_FLY_X_PERCENT = 420;
/**
 * クリア結果モーダルまでの待ち・直前の飛び出し演出の所要時間の倍率。
 * 「ラストワン！」と同じ px/s に揃えるため、ここでは等倍（=計算どおりの時間）にする。
 */
const CLEAR_RESULT_OVERLAY_TIMING_SCALE = 1;

/** ラストワン／クリアの実測幅を揃える（見た目の font 系は表示と同一に） */
const FLY_BANNER_MEASURE_STYLE: React.CSSProperties = {
  fontSize: '30vh',
  lineHeight: 1,
  WebkitTextStroke: '12px rgba(255,255,255,0.95)',
  textShadow: '0 10px 0 rgba(255,255,255,0.85)',
};

const getClearPoints = (size: number) => {
  // 難易度（サイズ）に応じた固定得点
  if (size <= 5) return 50;
  if (size <= 8) return 100;
  if (size <= 10) return 150;
  if (size <= 12) return 200;
  return 300;
};

const GameScreen: React.FC<GameScreenProps> = ({ 
  gameState, onUpdateFound, onBack, onBackToBoard, onSaveHistory, onSpendPoints, onShowFullScreenAd, showToast, vibrate, language, totalPoints, isOnline, onClear, onClearSeed, userId, onAddPoints, onNextProblem, seed, proCode, nickname, isMultiplay = false, isSyncMode = false, roomId = null, shareRoomId = null, roomStartTime = null, consecutiveClears, roomPlayers = [],
  roomStatus = 'playing', onBackToTitle,
  userEmoji = '🐫',
  hundredCoop = false,
  hundredRoster = [],
  hundredRoomHostUid = null,
  currentFirebaseUid = null,
  onHundredRoomFinished,
  streamMode = false,
}) => {
  const displayRoomCode = inviteRoomCodeForShare(shareRoomId, roomId) || null;
  const t = {
    clear: 'おめでとう😊',
    categoryLabel: '分類：',
    answersLabel: '回答数：',
    timeLabel: 'じかん：',
    pointsLabel: 'ポイント：',
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
    hintDesc: '5ポイントで1文字目を表示',
    noPoints: 'ポイントが足りません',
    submitToTeacher: 'らくだ先生に提出する',
    shareWithSeed: (seed: string) => seed ? `合言葉「${seed}」でクリア！` : 'クリアしたよ！',
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

  const requestLeaveGame = useCallback(
    (go: () => void) => {
      if (
        hundredCoop &&
        hundredRoomHostUid &&
        currentFirebaseUid &&
        currentFirebaseUid === hundredRoomHostUid &&
        !window.confirm(
          '参加のみなさんに影響する可能性があります。ホストとしてこの画面を離れますか？'
        )
      ) {
        return;
      }
      go();
    },
    [hundredCoop, hundredRoomHostUid, currentFirebaseUid]
  );

  const [isFinished, setIsFinished] = useState(false);
  const compactStreamMode = !!streamMode && !!hundredCoop && !isFinished;
  // 一般ユーザー向け: hundredCoop（みんなであそぶ）プレイ中に端末が重い兆候が出たら自動で軽量化する
  const [autoCompactMode, setAutoCompactMode] = useState(false);
  const [rakudaQrDataUrl, setRakudaQrDataUrl] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const showAnswersRef = useRef(false);
  useEffect(() => {
    showAnswersRef.current = showAnswers;
  }, [showAnswers]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [submitError, setSubmitError] = useState<string>('');
  const [isSuccessFlashing, setIsSuccessFlashing] = useState(false);
  const [clearTime, setClearTime] = useState("");
  const [clearDate, setClearDate] = useState("");
  const [hintWord, setHintWord] = useState<(WordOccurrence & { word: string, startTime: number }) | null>(null);
  const hintWordRef = useRef<(WordOccurrence & { word: string; startTime: number }) | null>(null);
  useEffect(() => {
    hintWordRef.current = hintWord;
  }, [hintWord]);
  const [sessionPoints, setSessionPoints] = useState(0);
  const sessionPointsRef = useRef(sessionPoints);
  sessionPointsRef.current = sessionPoints;
  const consecutiveClearsRef = useRef(consecutiveClears);
  consecutiveClearsRef.current = consecutiveClears;
  const [streakCount, setStreakCount] = useState(0);
  const [lastGainedPoints, setLastGainedPoints] = useState(0);
  const [showLastOneBonus, setShowLastOneBonus] = useState(false);
  const [showClearFlyBonus, setShowClearFlyBonus] = useState(false);
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
  const clearFlyModalDelayMs = useMemo(
    () => Math.round(clearFlyDurationSec * 1000 * CLEAR_RESULT_OVERLAY_TIMING_SCALE + 150 * CLEAR_RESULT_OVERLAY_TIMING_SCALE),
    [clearFlyDurationSec]
  );
  const clearFlyModalDelayMsRef = useRef(clearFlyModalDelayMs);
  clearFlyModalDelayMsRef.current = clearFlyModalDelayMs;

  const [displayConsecutiveClears, setDisplayConsecutiveClears] = useState(consecutiveClears);
  const [finishedPlayers, setFinishedPlayers] = useState<Set<string>>(new Set());
  const lastFoundWordsCount = useRef(gameState.foundWords.length);
  
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
    if (!isMultiplay || !roomId) return;
    if (gameState.foundWords.length > lastFoundWordsCount.current) {
      const newWord = gameState.foundWords[gameState.foundWords.length - 1];
      // Only notify if it's from another player
      if (newWord && newWord.userName && newWord.userName !== nickname) {
        showToast(`${newWord.userName}さんが「${convertToHiragana(newWord.word)}」をみつけたよ！`);
        audioService.playCorrectSound();
        vibrate(20);
      }
    }
    lastFoundWordsCount.current = gameState.foundWords.length;
  }, [gameState.foundWords, isMultiplay, roomId, nickname, showToast]);

  // Reset finish overlay when a new board arrives (e.g., "next problem")
  useEffect(() => {
    setIsFinished(false);
    setShowAnswers(false);
    setIsSuccessFlashing(false);
    setSessionPoints(0);
    setStreakCount(0);
    setLastGainedPoints(0);
    setShowLastOneBonus(false);
    setShowClearFlyBonus(false);
    setFinishedPlayers(new Set());
    startTimeRef.current = Date.now();
    setClearTime("");
    setClearDate("");
    if (gameState.gameMode === 'search') {
      const limit = Number(gameState.searchTimeLimitSec);
      if (Number.isFinite(limit) && limit > 0) {
        setTimeLeft(limit);
      } else {
        setTimeLeft(1);
      }
    }
    setSubmitStatus('idle');
    setSubmitError('');
  }, [
    // A change in these typically means a new puzzle/round
    gameState.actualSeed,
    gameState.grid.length,
    gameState.placedWords.length,
    gameState.difficulty,
    gameState.isKatakana,
    gameState.category?.category,
    gameState.gameMode,
    gameState.searchTimeLimitSec,
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

  // QR導線は「みんなであそぶ（hundredCoop）」の盤面中だけ表示する（クリア画面には出さない）。
  const showRakudaQr = !!hundredCoop && !isFinished;

  // 参加導線の QR を盤面上部中央に表示（問い合わせ対策）。
  useEffect(() => {
    if (!showRakudaQr) return;
    let cancelled = false;
    void (async () => {
      try {
        const url = 'https://rakuda.coffee/';
        const dataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: 'H',
          margin: 1,
          scale: 6,
          color: { dark: '#5a3d28', light: '#ffffff' },
        });
        if (!cancelled) setRakudaQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setRakudaQrDataUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showRakudaQr]);

  // 貢献者の計算
  const contributors = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const nameByUid = Object.fromEntries(hundredRoster.map((p) => [p.uid, p.name]));
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
  }, [gameState.foundWords, language, hundredRoster]);

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

  const HINT_COST = 25;
  const SHOW_ANSWERS_COST = 50;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const clearModalRef = useRef<HTMLDivElement>(null);
  const soloBottomControlsRef = useRef<HTMLDivElement>(null);
  
  const [layout, setLayout] = useState({ cellSize: 0, padding: 8, boardSize: 0 });
  const [soloBottomControlsPx, setSoloBottomControlsPx] = useState(76);
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
  const lagScoreRef = useRef(0);
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

  // 盤面/進捗が更新されたら「活動あり」とみなして即時描画を許可
  useEffect(() => {
    if (!hundredCoop || isFinished) return;
    lastActivityAtMsRef.current = Date.now();
    forceDrawRef.current = true;
  }, [hundredCoop, isFinished, gameState.foundWords.length, gameState.grid.length, hundredRoster.length]);

  const compactMode = (compactStreamMode || (autoCompactMode && !!hundredCoop && !isFinished));

  const updateLayout = useCallback(() => {
    if (!mainContentRef.current || !canvasRef.current) return;

    const containerWidth = mainContentRef.current.clientWidth;
    const containerHeight = mainContentRef.current.clientHeight;

    // mainContentRef は「盤面領域」そのもの（上下UIは除外済み）なので、
    // ここで広告/ボタン分の予約を引くと二重に縮んで盤面が小さくなる。
    const availableHeight = containerHeight - 12;
    // mainContentRef already has horizontal padding (px-4), so don't subtract again.
    const availableWidth = containerWidth;
    
    let availableSize = Math.min(availableWidth, availableHeight, 800);
    if (availableSize < 0) availableSize = 0;
    
    const diff = Math.max(gameState.difficulty, 3);
    const cellSize = (availableSize - (GRID_PADDING * 2)) / diff;

    setLayout({ cellSize, padding: GRID_PADDING, boardSize: availableSize });

    const dpr = Math.min(window.devicePixelRatio || 1, 1.6); 
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); 

    canvas.width = availableSize * dpr;
    canvas.height = availableSize * dpr;
    canvas.style.width = `${availableSize}px`;
    canvas.style.height = `${availableSize}px`;

    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }, [gameState.difficulty]);

  useEffect(() => {
    updateLayout();
    let resizeTimer: number;
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(updateLayout, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateLayout]);

  // Layout can be temporarily 0-height on mobile while bottom UI settles.
  // Observe size changes so the canvas reliably reflows and draws letters.
  useEffect(() => {
    if (!mainContentRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(mainContentRef.current);
    return () => ro.disconnect();
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
  }, [updateLayout, gameState.grid.length, gameState.difficulty]);

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
      const { cellSize, padding, boardSize } = currentLayout;
      // Mobile layout can be 0 for a moment while UI settles.
      // Keep the RAF loop alive so we recover automatically.
      if (cellSize <= 0 || boardSize <= 0) {
        requestRef.current = requestAnimationFrame(draw);
        return;
      }

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, boardSize, boardSize);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const baseFontSize = cellSize * 0.65;
    const displayFontSize = baseFontSize * 1.2;
    const boardFont = `500 ${displayFontSize}px "M PLUS Rounded 1c"`;

    const ribbonThickness = cellSize * 0.85;
    const ribbonExtension = 0;

    // 1. Layer: Background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, boardSize, boardSize);

    // 2. Layer: Correct Bands (Thick Strikethrough)
      currentGameState.foundWords.forEach(fw => {
      if (!fw.start || !fw.end) return;
      ctx.save();
      ctx.globalAlpha = 0.9; 
      ctx.fillStyle = fw.color;

      const dx = fw.end.x - fw.start.x;
      const dy = fw.end.y - fw.start.y;
      const distInCells = Math.max(Math.abs(dx), Math.abs(dy));
      
      const unitX = distInCells === 0 ? 0 : (dx === 0 ? 0 : dx / distInCells);
      const unitY = distInCells === 0 ? 1 : (dy === 0 ? 0 : dy / distInCells);

      const isDiagonal = unitX !== 0 && unitY !== 0;
      const edgeFactor = isDiagonal ? (cellSize / 2) * 0.75 : (cellSize / 2) + ribbonExtension;
      const x1 = fw.start.x * cellSize + padding + (cellSize / 2) - (unitX * edgeFactor);
      const y1 = fw.start.y * cellSize + padding + (cellSize / 2) - (unitY * edgeFactor);
      const x2 = fw.end.x * cellSize + padding + (cellSize / 2) + (unitX * edgeFactor);
      const y2 = fw.end.y * cellSize + padding + (cellSize / 2) + (unitY * edgeFactor);

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

      ctx.translate(midX, midY);
      ctx.rotate(angle);
      
      drawRoundedRect(ctx, -dist / 2, -ribbonThickness / 2, dist, ribbonThickness, ribbonThickness / 2);
      ctx.fill();
      ctx.restore();
    });

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
      ctx.fillStyle = '#fbbf24'; // Amber-400
      ctx.strokeStyle = '#ffffff';
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

      const ex = (distInCells === 0 ? hint.start.x : hint.end.x) * cellSize + padding + (cellSize / 2);
      const ey = (distInCells === 0 ? hint.start.y : hint.end.y) * cellSize + padding + (cellSize / 2);
      const sx = hint.start.x * cellSize + padding + (cellSize / 2);
      const sy = hint.start.y * cellSize + padding + (cellSize / 2);

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

      const currentThickness = ribbonThickness * (1 + pulse * 0.1);
      drawRoundedRect(ctx, -dist / 2, -currentThickness / 2, dist, currentThickness, currentThickness / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Layer: Letters
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = boardFont;

    const cellOnAnyPlacedOccurrence = (gx: number, gy: number) => {
      for (const pw of currentGameState.placedWords || []) {
        for (const occ of pw.occurrences || []) {
          if (isPointOnSegment(gx, gy, occ.start, occ.end)) return true;
        }
      }
      return false;
    };

    const revealAnswers = showAnswersRef.current;
    currentGameState.grid.forEach((row, y) => {
      row.forEach((char, x) => {
        const cx = x * cellSize + padding + cellSize / 2;
        const cy = y * cellSize + padding + cellSize / 2;
        
        let isFound = false;
        for (let i = 0; i < currentGameState.foundWords.length; i++) {
          if (isPointOnSegment(x, y, currentGameState.foundWords[i].start, currentGameState.foundWords[i].end)) {
            isFound = true;
            break;
          }
        }

        const displayChar = currentGameState.category?.isKanji ? char : (currentGameState.isKatakana ? convertToKatakana(char) : convertToHiragana(char));
        const strokeW = Math.max(2, displayFontSize * 0.1);

        if (isFound) {
          ctx.fillStyle = '#FFFFFF';
          ctx.lineWidth = strokeW;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
          ctx.lineJoin = 'round';
          ctx.strokeText(displayChar, cx, cy);
          ctx.fillText(displayChar, cx, cy);
        } else if (revealAnswers && cellOnAnyPlacedOccurrence(x, y)) {
          ctx.fillStyle = '#c2410c';
          ctx.lineWidth = Math.max(1.5, displayFontSize * 0.07);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.lineJoin = 'round';
          ctx.strokeText(displayChar, cx, cy);
          ctx.fillText(displayChar, cx, cy);
        } else {
          ctx.fillStyle = 'rgb(30, 41, 59)';
          ctx.fillText(displayChar, cx, cy);
        }
      });
    });

    // 5. Layer: Selection Highlight (Green Circles)
    const sel = activeSelectionRef.current;
    if (sel.start && sel.end) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#00c874';

      const dx = sel.end.x - sel.start.x;
      const dy = sel.end.y - sel.start.y;
      const distInCells = Math.max(Math.abs(dx), Math.abs(dy));
      const unitX = distInCells === 0 ? 0 : (dx === 0 ? 0 : dx / distInCells);
      const unitY = distInCells === 0 ? 1 : (dy === 0 ? 0 : dy / distInCells);

      for (let i = 0; i <= distInCells; i++) {
        const cx = (sel.start.x + unitX * i) * cellSize + padding + cellSize / 2;
        const cy = (sel.start.y + unitY * i) * cellSize + padding + cellSize / 2;
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
  const occurrenceKey = React.useCallback((start: Point, end: Point) => {
    return `${start.x},${start.y}-${end.x},${end.y}`;
  }, []);

  // ことば拾いは「出現回数」をカウント（同じ単語を何回も拾う）
  const foundCount = React.useMemo(() => {
    if (!countByOccurrence) {
      // ソロ等: 「単語」単位でカウント（同じ単語が盤面に複数あっても 1つ見つければ正解）
      return new Set(gameState.foundWords.map((fw) => fw.word)).size;
    }
    const keys = new Set<string>();
    gameState.foundWords.forEach((fw) => {
      keys.add(occurrenceKey(fw.start, fw.end));
    });
    return keys.size;
  }, [gameState.foundWords, countByOccurrence, occurrenceKey]);

  const totalCount = React.useMemo(() => {
    if (!countByOccurrence) return gameState.placedWords.length;
    // みんなであそぶ: 出現数を答え数として扱う（表示と一致させる）
    let n = 0;
    gameState.placedWords.forEach((pw: any) => {
      const occs = pw && Array.isArray(pw.occurrences) ? pw.occurrences : [];
      n += occs.length;
    });
    return n;
  }, [gameState.placedWords, countByOccurrence]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isFinished || startCountdown > 0) return;
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
    setHintWord(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left - layout.padding) / layout.cellSize);
    const y = Math.floor((e.clientY - rect.top - layout.padding) / layout.cellSize);
    if (x >= 0 && x < gameState.difficulty && y >= 0 && y < gameState.difficulty) {
      const point = { x, y };
      selectionRef.current = { start: point, end: point };
      setActiveSelection({ start: point, end: point });
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!selectionRef.current.start) return;
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left - layout.padding) / layout.cellSize);
    const y = Math.floor((e.clientY - rect.top - layout.padding) / layout.cellSize);
    if (x >= 0 && x < gameState.difficulty && y >= 0 && y < gameState.difficulty) {
      const newEnd = { x, y };
      const dx = newEnd.x - selectionRef.current.start.x;
      const dy = newEnd.y - selectionRef.current.start.y;
      if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
        selectionRef.current.end = newEnd;
        setActiveSelection({ ...selectionRef.current });
      }
    }
  }, [layout, gameState.difficulty]);

  const handlePointerUp = useCallback(() => {
    forceDrawRef.current = true;
    lastActivityAtMsRef.current = Date.now();
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

        const isLastWord = foundCount === totalCount - 1;
        // 「すべてのこたえ」表示中はポイント獲得なし
        const pointsEarned = isLastWord && !showAnswers ? getClearPoints(gameState.difficulty) : 0;

        if (pointsEarned > 0) {
          setSessionPoints((p) => p + pointsEarned);
        }
        setLastGainedPoints(pointsEarned);
        setStreakCount((s) => s + 1);
        onUpdateFound(pw.word, occ.start, occ.end);
        audioService.playCorrectSound();

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const px =
            ((occ.start.x + occ.end.x) / 2) * layout.cellSize + layout.cellSize / 2 + layout.padding;
          const py =
            ((occ.start.y + occ.end.y) / 2) * layout.cellSize + layout.cellSize / 2 + layout.padding;

          const colorIdx = gameState.foundWords.length % BAND_COLORS.length;
          const color: string = String(BAND_COLORS[colorIdx] || '#000000');

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
          const isLastWord = foundCount === totalCount - 1;
          const pointsEarned = isLastWord && !showAnswers ? getClearPoints(gameState.difficulty) : 0;
          if (pointsEarned > 0) setSessionPoints((p) => p + pointsEarned);
          setLastGainedPoints(pointsEarned);
          setStreakCount((s) => s + 1);
          onUpdateFound(pw.word, sel.start, sel.end);
          audioService.playCorrectSound();
        }
      }
    }
    selectionRef.current = { start: null, end: null };
    setActiveSelection({ start: null, end: null });
  }, [gameState, layout, streakCount, lastGainedPoints, onUpdateFound, foundCount, totalCount, showAnswers]);

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
    if (totalCount > 1 && foundCount === totalCount - 1 && !isFinished) {
      setShowLastOneBonus(true);
      audioService.playBonusSound();
      const timer = setTimeout(() => setShowLastOneBonus(false), FLY_BANNER_DURATION_SEC * 1000);
      return () => clearTimeout(timer);
    }
  }, [foundCount, totalCount, isFinished]);

  /** 全問クリア直後：ことば探し・みんなであそぶ共通。ラストワンと同系の飛び出し演出（非表示はアニメ終了時） */
  useEffect(() => {
    if (totalCount <= 0 || foundCount !== totalCount || isFinished) return;
    setShowLastOneBonus(false);
    setShowClearFlyBonus(true);
    audioService.playBonusSound();
    return () => setShowClearFlyBonus(false);
  }, [foundCount, totalCount, isFinished]);

  useEffect(() => {
    if (totalCount <= 0 || foundCount < totalCount || isFinished) return;

    const tid = window.setTimeout(() => {
      const gs = gameStateRef.current;
      const nextConsecutive = consecutiveClearsRef.current + 1;
      setIsFinished(true);
      setDisplayConsecutiveClears(nextConsecutive);
      audioService.playFanfareSound();
      setIsSuccessFlashing(true);
      if (hundredCoop) onHundredRoomFinished?.('cleared');

      window.setTimeout(() => {
        onShowFullScreenAd(nextConsecutive);
      }, 1500);

      onClear();

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
          foundCount: foundCount, 
          totalCount: totalCount, 
          duration: durStr, 
          points: sessionPointsRef.current 
        },
        category: gs.category // Add category object for App.tsx fallback
      });
    }, clearFlyModalDelayMsRef.current);

    return () => window.clearTimeout(tid);
    // 最後の正解から、クリア横スクロール終了直後にクリアモーダル（所要時間はラストワンと同じ px/s に合わせた clearFlyModalDelayMs）。deps は最小にする。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- コールバックは ref / 安定参照で遅延内取得
  }, [foundCount, totalCount, isFinished]);

  const handleHint = () => {
    if (totalPoints < HINT_COST) {
      showToast(t.noPoints);
      return;
    }

    const unfoundOccurrences: { word: string; start: Point; end: Point }[] = [];
    gameState.placedWords.forEach(pw => {
      pw.occurrences.forEach(occ => {
        if (!isKotobaHiroi) {
          if (gameState.foundWords.some((fw) => fw.word === pw.word)) return;
          unfoundOccurrences.push({ word: pw.word, ...occ });
          return;
        }
        const ok = !gameState.foundWords.some(
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
        if (ok) {
          // ことば拾い: 「こたえの場所」を教える（その出現全体を帯で強調）
          unfoundOccurrences.push({ word: pw.word, ...occ });
        }
      });
    });

    if (unfoundOccurrences.length === 0) return;

    // 探しもの（pickup）は「探すことば」"だけ" をヒントにする（偶然語へフォールバックしない）
    const primaryWord = String(gameState.targetWord ?? gameState.category?.words?.[0] ?? '').trim();
    if (isKotobaHiroi) {
      const primaryPool = primaryWord ? unfoundOccurrences.filter((x) => x.word === primaryWord) : [];
      if (primaryPool.length === 0) {
        showToast('ヒントはもうありません');
        return;
      }
      const randomOcc = primaryPool[Math.floor(Math.random() * primaryPool.length)];
      onSpendPoints(HINT_COST);
      vibrate(30);
      setHintWord({ ...randomOcc, startTime: Date.now() });
      setTimeout(() => setHintWord(null), 5000);
      return;
    }
    const randomOcc = unfoundOccurrences[Math.floor(Math.random() * unfoundOccurrences.length)];
    onSpendPoints(HINT_COST);
    vibrate(30);
    setHintWord({ ...randomOcc, startTime: Date.now() });
    setTimeout(() => setHintWord(null), 5000);
  };

  const handleShowAnswers = () => {
    if (hundredCoop) return; // みんなであそぶでは不要
    if (showAnswers) return;
    if (totalPoints < SHOW_ANSWERS_COST) {
      showToast(t.noPoints);
      return;
    }
    onSpendPoints(SHOW_ANSWERS_COST);
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

  const progress = Math.min((foundCount / (totalCount || 1)) * 100, 100);

  if (!gameState.grid || gameState.grid.length === 0) {
    return (
      <div
        className={`relative flex flex-col h-full w-full items-center justify-center overflow-hidden ${
          hundredCoop
            ? 'bg-gradient-to-b from-[#efe2d1] via-[#f6ede2] to-[#e7d8c4]'
            : 'bg-gradient-to-b from-amber-200/95 via-orange-100 to-amber-300/88'
        }`}
      >
        <RakudaFloatingBackdrop variant={hundredCoop ? 'minna' : 'kotoba'} />
        <div
          className={`relative z-10 w-16 h-16 border-4 rounded-xl animate-pulse mb-4 ${
            hundredCoop ? 'border-red-300' : 'border-amber-300'
          }`}
        ></div>
        <p className="relative z-10 font-medium text-slate-700 text-sm">パズルを読み込み中...</p>
        <p className="relative z-10 text-slate-600 text-xs mt-2">しばらくお待ちください</p>
      </div>
    );
  }

  const displayEmoji = compactMode ? '' : (userEmoji || '🐫').trim() || '🐫';
  return (
    <div
      className={`flex flex-col h-full w-full select-none relative items-center ${
        hundredCoop
          ? // hundredCoop: reserve bottom banner space too (otherwise hint button can hide under ads)
            'overflow-hidden justify-between pb-[calc(var(--rk-bottom-banner,0px)+env(safe-area-inset-bottom)+12px)] bg-gradient-to-b from-[#efe2d1] via-[#f6ede2] to-[#e7d8c4]'
          : // Solo play: allow scrolling so bottom panels never hide behind the fixed ad banner.
            'overflow-y-auto justify-start pb-[calc(var(--rk-bottom-banner,0px)+env(safe-area-inset-bottom)+12px)) bg-gradient-to-b from-amber-200/95 via-orange-100 to-amber-300/88'
      }`}
      style={{ paddingTop: hundredCoop ? 4 : 8, paddingBottom: hundredCoop ? 4 : 8, fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
    >
      <RakudaFloatingBackdrop variant={hundredCoop ? 'minna' : 'kotoba'} />

      {showRakudaQr && (
        <div className="fixed left-1/2 -translate-x-1/2 top-[70px] z-[650] pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              try {
                window.open('https://rakuda.coffee/', '_blank', 'noopener,noreferrer');
              } catch {
                // ignore
              }
            }}
            className="bg-white/95 border border-slate-200 rounded-2xl shadow-sm px-2 py-1.5 flex items-center gap-2 active:scale-95 transition-transform"
            title="https://rakuda.coffee/ を開く"
          >
            {rakudaQrDataUrl ? (
              <img
                src={rakudaQrDataUrl}
                alt="らくだ珈琲 QRコード"
                className="w-[60px] h-[60px] rounded-2xl border border-slate-200 bg-white"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-[60px] h-[60px] rounded-2xl border border-slate-200 bg-slate-50 grid place-items-center">
                <span className="text-[10px] font-black text-slate-500">QR</span>
              </div>
            )}
            <div className="flex flex-col leading-tight text-left">
              <div className="text-[10px] font-black text-slate-700">らくだ珈琲</div>
              <div className="text-[9px] font-medium text-slate-600">
                {rakudaQrDataUrl ? 'QRで参加ページへ' : 'タップで開く'}
              </div>
            </div>
          </button>
        </div>
      )}

      <div
        className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0 overflow-hidden"
        aria-hidden
      >
        <span
          ref={lastFlyMeasureRef}
          className="inline-block font-black tracking-wide whitespace-nowrap text-orange-500"
          style={FLY_BANNER_MEASURE_STYLE}
        >
          {t.lastOne}
        </span>
        <span
          ref={clearFlyMeasureRef}
          className="inline-block font-black tracking-wide whitespace-nowrap text-red-500"
          style={FLY_BANNER_MEASURE_STYLE}
        >
          {t.clearFly}
        </span>
      </div>

      {hundredCoop && !isFinished && (
        <button
          type="button"
          className="fixed top-[76px] right-3 z-[600] w-[68px] h-9 md:w-[84px] md:h-10 rounded-xl border-2 border-rose-400 bg-rose-300/95 backdrop-blur text-rose-950 text-xs md:text-sm font-black shadow-sm active:scale-95 transition-transform flex items-center justify-center"
          onClick={() => {
            if (!window.confirm('中断してもいいですか？')) return;
            // ホストが「中断」で離脱した場合、掲示板側に「募集中」が残らないよう募集を閉じる。
            // `hundred_rooms.publicRecruitId` があれば `hundred_public` を削除し、room を cancelled にする。
            if (
              roomId &&
              hundredRoomHostUid &&
              currentFirebaseUid &&
              currentFirebaseUid === hundredRoomHostUid
            ) {
              void (async () => {
                try {
                  const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
                  const d = snap.exists() ? (snap.data() as any) : null;
                  const publicRecruitId = typeof d?.publicRecruitId === 'string' ? d.publicRecruitId : undefined;
                  await applyHostCancelledHundredGeneration({
                    roomId,
                    hundredPublicDocId: publicRecruitId,
                  });
                } catch (e) {
                  console.warn('[GameScreen] interrupt close recruitment failed', e);
                }
              })();
            }
            // みんなであそぶ: ルームIDを消して退出 → 掲示板へ戻る
            onClearSeed();
            requestLeaveGame(() => {
              if (onBackToBoard) {
                void onBackToBoard();
                return;
              }
              onBack();
            });
          }}
        >
          中断
        </button>
      )}
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
            <span className="font-black tracking-wide text-orange-500" style={FLY_BANNER_MEASURE_STYLE}>
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
            <span className="font-black tracking-wide text-red-500" style={FLY_BANNER_MEASURE_STYLE}>
              {t.clearFly}
            </span>
          </motion.div>
        </div>
      )}

      {floatingTexts.map(ft => (
        <div
          key={ft.id}
          className="fixed pointer-events-none z-[700] font-medium text-sm text-white whitespace-nowrap"
          style={{ left: ft.x, top: ft.y, WebkitTextStroke: `2px ${ft.color}` }}
        >
          {ft.text}
        </div>
      ))}

      {isFinished && (
        <div
          className={`fixed inset-0 z-[500] flex items-center justify-center p-4 overflow-hidden backdrop-blur-sm ${
            hundredCoop ? 'bg-[#efe2d1]/92' : 'bg-amber-200/92'
          }`}
        >
          <RakudaFloatingBackdrop variant={hundredCoop ? 'minna' : 'kotoba'} className="z-0" />
          
          <div 
            ref={clearModalRef} 
            className={`${cardClass} flex flex-col w-[85%] max-w-[450px] relative z-10 max-h-[85vh] overflow-hidden`}
            style={{ paddingTop: '5vh', paddingBottom: '4vh' }}
          >
            <h2 
              className={`text-sm font-medium text-center leading-none px-4 flex-shrink-0 text-slate-700`}
              style={{ marginBottom: '5vh' }}
            >
              {searchModeTimedOut ? 'タイムアップ！' : (displayConsecutiveClears > 1 ? t.consecutiveClear(displayConsecutiveClears) : t.clear)}
            </h2>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar" style={{ marginBottom: '3vh' }}>
              <div 
                className="flex flex-col gap-4 font-bold text-slate-700 text-sm w-full"
                style={{ paddingLeft: '15%', paddingRight: '15%' }}
              >
                {[
                  { label: 'なまえ：', value: `${displayEmoji}${nickname || userId}` },
                  { label: t.categoryLabel, value: (
                    <div className="flex items-center gap-1 justify-end">
                      <span className="max-w-[min(100vw-8rem,220px)] text-right whitespace-pre-line line-clamp-3 break-words">
                        {gameState.gameMode === 'search'
                          ? `探しもの：「${displaySearchWord}」`
                          : getCategoryDisplayTitle(String(gameState.category?.title || ''), language, gameState.isKatakana)}
                      </span>
                      {gameState.category?.isKanji && (
                        <span className="bg-sky-50 text-slate-700 text-[10px] px-2 py-1 rounded-xl border border-sky-200 shadow-sm leading-none">漢字</span>
                      )}
                    </div>
                  ), isTruncate: false },
                  { label: t.difficultyLabel, value: `${gameState.difficulty}×${gameState.difficulty}` },
                  { label: 'こたえの数：', value: `${totalCount}個` },
                  { label: t.timeLabel, value: clearTime },
                  { label: t.pointsLabel, value: `🐫${sessionPoints}`, isGreen: true },
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between border-b border-slate-50 pb-1 w-full"
                  >
                    <span className="text-slate-400 whitespace-nowrap">{item.label}</span>
                    <span className={`${item.isTruncate ? 'truncate ml-4' : ''} ${item.isGreen ? 'text-[#00c874]' : ''}`}>
                      {item.value}
                    </span>
                  </div>
                ))}

                {(isMultiplay || hundredCoop) && (
                  <div className="mt-4 w-full">
                    <div className="text-[10px] text-slate-400 mb-2 border-b border-slate-100 pb-1 flex justify-between items-center">
                      <span>
                        {hundredCoop
                          ? (language === 'ja' ? '参加者ランキング（見つけた数）' : 'Ranking')
                          : isSyncMode
                            ? (language === 'ja' ? '見つけた人ランキング' : 'Top Finders')
                            : (language === 'ja' ? 'ゴール順位表' : 'Leaderboard')}
                      </span>
                      {!isSyncMode && !hundredCoop && (
                        <span className="animate-pulse text-[10px] bg-emerald-50 text-slate-700 p-2 rounded-xl border border-emerald-200">LIVE</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                      {hundredCoop ? (
                        hundredRoster.map((p, idx) => (
                          <div
                            key={p.uid}
                            className={`flex justify-between text-[11px] ${p.uid === userId ? 'text-emerald-600 font-black' : 'text-slate-600'}`}
                          >
                            <span className="truncate max-w-[160px]">
                              {idx + 1}. {compactMode ? '' : (p.emoji || '👤')} {p.name}
                            </span>
                            <span className="tabular-nums">{p.foundCount}個</span>
                          </div>
                        ))
                      ) : isSyncMode ? (
                        contributors.map(([name, count], idx) => {
                          const player = roomPlayers.find(rp => rp.name === name);
                          return (
                            <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                              <span className="truncate max-w-[120px]">{idx + 1}. {compactMode ? '' : (player?.emoji || '👤')} {name}</span>
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
                              <div key={p.uid} className={`flex justify-between text-[11px] ${p.uid === userId ? 'text-emerald-600 font-black' : 'text-slate-600'}`}>
                                <span className="truncate max-w-[120px]">{idx + 1}. {compactMode ? '' : (p.emoji || '👤')} {p.name}</span>
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
                  <button
                disabled={submitStatus === 'sending' || submitStatus === 'sent'}
                onClick={async () => {
                    if (submitStatus === 'sending' || submitStatus === 'sent') return;

                    // ニックネームが空の場合は提出をブロック
                    if (!nickname || nickname.trim() === '') {
                      setSubmitStatus('failed');
                      setSubmitError('なまえが空です');
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: language === 'ja' ? 'なまえを入力してね' : 'Please enter your name',
                        })
                      );
                      showToast(language === 'ja' ? 'なまえを入力してね' : 'Please enter your name');
                      return;
                    }

                    setSubmitStatus('sending');
                    setSubmitError('');
                    vibrate(10);
                    
                    const categoryTitle = getCategoryDisplayTitle(String(gameState.category?.title || ""), language, gameState.isKatakana);
                    const difficultyText = `${gameState.difficulty}×${gameState.difficulty}`;
                    const pointsText = String(totalPoints + sessionPoints);
                    const nameText = nickname || userId;
                    const seedText = seed || "なし";

                    // 検証コードの生成を削除し、ダミーデータを設定
                    const vCode = "DUMMY_DATA";

                    // フローティングテキスト「提出しました！」の表示
                    const btnEl = document.activeElement as HTMLElement | null;
                    const rect = btnEl?.getBoundingClientRect?.();
                    setFloatingTexts(prev => [
                      ...prev, 
                      { 
                        id: Date.now(), 
                        text: '提出しました！ ✅', 
                        x: (rect?.left ?? window.innerWidth / 2) + (rect?.width ?? 0) / 2,
                        y: (rect?.top ?? 120) - 20,
                        life: 2, 
                        color: '#3b82f6'
                      }
                    ]);

                    try {
                      const relayPayload = {
                        seedText,
                        nameText,
                        categoryTitle,
                        difficultyText,
                        totalCount: String(totalCount),
                        clearTime,
                        pointsText,
                        vCode,
                      };

                      // 1) Server-side relay (same origin) to avoid tablet/Safari CORS quirks.
                      // Some deployments (or aggressive SW caches) may return HTML with 200 for /api/*.
                      // In that case, fall back to direct Google Forms submission (no-cors).
                      let ok = false;
                      try {
                        const r = await fetch('/api/submit-to-teacher', {
                          method: 'POST',
                          headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                          },
                          body: JSON.stringify(relayPayload),
                        });
                        const ct = (r.headers.get('content-type') || '').toLowerCase();
                        const json = ct.includes('application/json')
                          ? ((await r.json().catch(() => null)) as any)
                          : null;
                        if (r.ok && json?.ok) ok = true;
                        if (!ok && !r.ok) {
                          throw new Error(json?.error || `http ${r.status}`);
                        }
                      } catch (e) {
                        // ignore and try fallback
                      }

                      if (!ok) {
                        // 2) Fallback: submit directly to Google Forms (no-cors).
                        const formActionUrl =
                          'https://docs.google.com/forms/d/e/1FAIpQLScgx8M30O6TQTAtDxtxb-ftAs7hv3F5WR53iD79XySoa7HETA/formResponse';
                        const formData = new URLSearchParams();
                        formData.append('entry.1199053163', seedText || 'なし');
                        formData.append('entry.372020919', nameText);
                        formData.append('entry.2126071547', categoryTitle);
                        formData.append('entry.1550339233', difficultyText);
                        formData.append('entry.92185271', String(totalCount ?? ''));
                        formData.append('entry.458856475', clearTime);
                        formData.append('entry.2094453691', pointsText);
                        formData.append('entry.390053549', vCode);

                        await fetch(formActionUrl, {
                          method: 'POST',
                          mode: 'no-cors',
                          headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                          body: formData.toString(),
                        });
                        // no-cors returns an opaque response; if fetch resolves, treat as success.
                        ok = true;
                      }

                      if (!ok) throw new Error('submit failed');
                      if (typeof window !== 'undefined' && (window as any).gtag) {
                        (window as any).gtag('event', 'submit_to_teacher', {
                          'event_category': 'engagement',
                          'event_label': nickname
                        });
                      }
                      setSubmitStatus('sent');
                      // 画面がモーダルで覆われても見えるように、グローバルToastにも流す
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: language === 'ja' ? 'らくだ先生に提出しました！' : 'Submitted to teacher!',
                        })
                      );
                      showToast(language === 'ja' ? "らくだ先生に提出しました！" : "Submitted to teacher!");
                      onClearSeed(); // 合言葉を消去
                    } catch (err) {
                      console.error("Submission error:", err);
                      setSubmitStatus('failed');
                      const raw =
                        err instanceof Error
                          ? err.message
                          : typeof err === 'string'
                            ? err
                            : '';
                      const msg = String(raw || String(err) || 'network error').trim() || 'network error';
                      setSubmitError(msg);
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: language === 'ja'
                            ? `提出に失敗しました（${msg}）`
                            : `Submit failed (${msg})`,
                        })
                      );
                    }
                  }}
                  className={`${btnPrimary} w-full h-11 flex items-center justify-center gap-1`}
                >
                  <span className="text-sm">📝</span>
                  {t.submitToTeacher}
                </button>
                {submitStatus !== 'idle' ? (
                  <div className="text-[11px] font-bold text-center">
                    {submitStatus === 'sending' ? (
                      <span className="text-slate-600">送信中…</span>
                    ) : submitStatus === 'sent' ? (
                      <span className="text-emerald-700">送信しました</span>
                    ) : (
                      <span className="text-rose-700">
                        送信に失敗しました{submitError ? `（${submitError}）` : ''}
                      </span>
                    )}
                  </div>
                ) : null}
              
              <div className="flex gap-2">
                {!isMultiplay && (
                  <button
                    onClick={() => {
                      vibrate(10);
                      setIsFinished(false);
                      onNextProblem();
                    }}
                    className={`${btnPrimary} flex-grow h-11`}
                  >
                    {t.nextProblem}
                  </button>
                )}
                <button
                  onClick={() => {
                    vibrate(10);
                    requestLeaveGame(() => {
                      if (hundredCoop && onBackToBoard) {
                        // みんなであそぶ（掲示板）へ戻るときは、ゲーム状態を閉じてから遷移する
                        onClearSeed();
                        void onBackToBoard();
                        return;
                      }
                      // ことば探し（通常）は「問題一覧」へ戻る
                      onBack();
                    });
                  }}
                  className={`${btnGhost} flex-grow h-11`}
                >
                  {hundredCoop ? '掲示板へもどる' : t.back}
                </button>
                <button 
                  onClick={async () => {
                    const resultTitle = searchModeTimedOut ? 'タイムアップ！' : (consecutiveClears > 1 ? t.consecutiveClear(consecutiveClears) : t.clear);
                    const foundWordsList = gameState.foundWords.map(fw => fw.word).join(' ');
                    const contributorText = isMultiplay && contributors.length > 0 
                      ? `\n見つけた人:\n${contributors.map(([name, count]) => `${name}: ${count}個`).join('\n')}`
                      : '';
                    const shareText = `ことば探し Pro\n${resultTitle}\n\n` +
                      `なまえ: ${nickname || userId}\n` +
                      `カテゴリー: ${getCategoryDisplayTitle(String(gameState.category?.title || ""), language, gameState.isKatakana)}\n` +
                      `むつかしさ: ${gameState.difficulty}×${gameState.difficulty}\n` +
                      `こたえの数: ${foundCount}/${totalCount}個\n` +
                      `じかん: ${clearTime}\n` +
                      `ポイント: 🐫${sessionPoints}\n` +
                      `見つけた言葉:\n${foundWordsList}${contributorText}\n\n` +
                      `${getPublicUrl()}\n#ことば探し #WORDSEARCH`;

                    try {
                      await navigator.clipboard.writeText(shareText);
                      showToast(language === 'ja' ? '結果をコピーしました！' : 'Copied to clipboard!');
                      onAddPoints(50, language === 'ja' ? 'SNSシェア' : 'SNS Share');
                    } catch (e) {
                      console.error('Copy failed', e);
                    }
                  }}
                  className={`w-11 h-11 flex items-center justify-center bg-white text-slate-700 rounded-xl shadow-sm active:scale-95 transition-transform border border-slate-200 flex-shrink-0 px-2`}
                  title="Copy Text"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                </button>
                <button 
                  onClick={async () => {
                    if (!isOnline) return;
                    
                    let files: File[] = [];
                    if (clearModalRef.current) {
                      try {
                        const canvas = await html2canvas(clearModalRef.current, {
                          backgroundColor: '#ffffff',
                          scale: 2,
                          logging: false,
                          useCORS: true,
                          allowTaint: true
                        });
                        
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (blob) {
                          files = [new File([blob], 'clear_result.png', { type: 'image/png' })];
                        }
                      } catch (e) {
                        console.error('Screenshot failed', e);
                      }
                    }

                    const resultTitle = searchModeTimedOut ? 'タイムアップ！' : (consecutiveClears > 1 ? t.consecutiveClear(consecutiveClears) : t.clear);
                    const foundWordsList = gameState.foundWords.map(fw => fw.word).join(' ');
                    const contributorText = isMultiplay && contributors.length > 0 
                      ? `\n見つけた人:\n${contributors.map(([name, count]) => `${name}: ${count}個`).join('\n')}`
                      : '';
                    const displaySeed = proCode || seed;
                    const shareText = `ことば探し Pro\n${resultTitle}\n\n` +
                      `なまえ: ${nickname || userId}\n` +
                      `カテゴリー: ${getCategoryDisplayTitle(String(gameState.category?.title || ""), language, gameState.isKatakana)}\n` +
                      `むつかしさ: ${gameState.difficulty}×${gameState.difficulty}\n` +
                      `こたえの数: ${foundCount}/${totalCount}個\n` +
                      `じかん: ${clearTime}\n` +
                      `ポイント: 🐫${sessionPoints}\n` +
                      (displaySeed ? `合言葉: ${displaySeed}\n` : '') +
                      `見つけた言葉:\n${foundWordsList}${contributorText}\n\n` +
                      `${getPublicUrl()}\n#ことば探し #WORDSEARCH`;

                    const shareData: any = {
                      title: 'ことば探し Pro',
                      text: shareText,
                      url: getPublicUrl()
                    };

                    if (files.length > 0 && navigator.canShare && navigator.canShare({ files })) {
                      shareData.files = files;
                    }

                    if (navigator.share) {
                      if (typeof window !== 'undefined' && (window as any).gtag) {
                        (window as any).gtag('event', 'share', {
                          'method': 'navigator_share',
                          'content_type': 'image'
                        });
                      }
                      try { 
                        await navigator.share(shareData); 
                        onAddPoints(50, language === 'ja' ? 'SNSシェア' : 'SNS Share');
                      } catch (e) {
                        if (shareData.files) {
                          try {
                            const { files: _, ...textShareData } = shareData;
                            await navigator.share(textShareData);
                            onAddPoints(50, language === 'ja' ? 'SNSシェア' : 'SNS Share');
                          } catch (e2) {}
                        }
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(shareText);
                        showToast(language === 'ja' ? '結果をコピーしました！' : 'Copied to clipboard!');
                        onAddPoints(50, language === 'ja' ? 'SNSシェア' : 'SNS Share');
                      } catch (e) {}
                    }
                  }} 
                  className={`w-16 h-11 flex items-center justify-center rounded-xl transition-transform flex-shrink-0 px-4 shadow-sm border border-slate-200
                    ${isOnline 
                      ? 'bg-amber-200 text-slate-700 active:scale-95' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                </button>
              </div>
              {hundredCoop && hundredRoster.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5 mt-1 max-w-[220px] md:max-w-[420px] overflow-hidden">
                  {hundredRoster.slice(0, 10).map((p) => (
                    <span
                      key={p.uid}
                      title={p.name}
                      className="inline-flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-base md:text-lg shadow-sm"
                    >
                      {compactMode ? '' : p.emoji}
                    </span>
                  ))}
                  {hundredRoster.length > 10 ? (
                    <span className="text-[10px] font-bold text-slate-600 tabular-nums">+{hundredRoster.length - 10}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className={`flex flex-col gap-2 px-4 w-full max-w-2xl flex-shrink-0 ${hundredCoop ? 'mb-0.5' : ''}`}>
        <div className={`flex justify-between items-center relative ${hundredCoop ? 'min-h-[3.6rem] md:min-h-[4.4rem]' : 'min-h-[4.5rem] md:min-h-[6rem]'}`}>
          <button
            onClick={() => {
              vibrate(10);
              requestLeaveGame(onBack);
            }}
            className={`${hundredCoop ? 'w-9 h-9 md:w-11 md:h-11' : 'w-10 h-10 md:w-14 md:h-14'} flex items-center justify-center ${btnGhost} flex-shrink-0 z-10`}
          >
            <ChevronLeft size={32} strokeWidth={4} />
          </button>
          
          <div className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 shadow-sm z-0 min-w-[220px] md:min-w-[340px] max-w-[calc(100%-6rem)] ${hundredCoop ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${hundredCoop && rakudaQrDataUrl ? 'h-auto' : 'h-full'}`}>
            <span className="text-[21px] leading-none">{gameState.category?.emoji}</span>
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center gap-1">
                <h3
                  className={`${pageTopHeadingClass} text-slate-800 text-center whitespace-pre-line break-words line-clamp-3 max-w-[220px] md:max-w-[420px]`}
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
                    getCategoryDisplayTitle(String(gameState.category?.title || ''), language, gameState.isKatakana)
                  )}
                </h3>
                {gameState.category?.isKanji && (
                  <span className="bg-sky-50 text-slate-700 text-[10px] px-2 py-1 rounded-xl border border-sky-200 flex-shrink-0 shadow-sm">漢字</span>
                )}
              </div>
              <div className={`flex items-center justify-center gap-2 ${hundredCoop ? 'mt-0.5' : 'mt-1'}`}>
                <span className={`${hundredCoop ? 'text-[14px] md:text-[18px]' : 'text-[16px] md:text-[21px]'} font-black text-slate-700 tabular-nums leading-none text-center whitespace-nowrap`}>
                  {gameState.difficulty}×{gameState.difficulty} {foundCount}/{totalCount}
                </span>
                {gameState.gameMode === 'search' && gameState.category?.category === 'search' && (
                  <div className="flex flex-col items-center ml-2 min-w-[100px] md:min-w-[150px]">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-base font-bold text-slate-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 shadow-sm leading-none">
                        {displaySearchWord}
                      </span>
                    </div>
                    {/* 時間制限は設けないため、カウントダウン表示は出さない */}
                  </div>
                )}
                {isMultiplay && (proCode || displayRoomCode) && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <div className={`p-2 rounded-xl text-[10px] font-medium flex items-center gap-1 shadow-sm border ${isSyncMode ? 'bg-sky-50 text-slate-700 border-sky-200' : 'bg-amber-50 text-slate-700 border-amber-200'}`}>
                        <span className="opacity-60">{isSyncMode ? '🤝' : '🏁'}</span>
                        <span>{isSyncMode ? '協力' : '対戦'}</span>
                      </div>
                      {roomPlayers.length > 1 && (
                        <div className="bg-sky-50 text-slate-700 px-2 py-1 rounded-xl text-[10px] font-medium flex items-center gap-1 shadow-sm border border-sky-200">
                          <span className="opacity-60">👤</span>
                          <span>{roomPlayers.length}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50 text-slate-700 p-2 rounded-xl text-[10px] font-medium flex items-center gap-1 border border-slate-200 self-start">
                      <span className="opacity-60">🏠</span>
                      <span>{displayRoomCode || proCode}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

            <div className={`bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-2 flex-shrink-0 ${hundredCoop ? 'p-2 h-9 md:h-11' : 'p-3 h-10 md:h-14'}`}>
              <span className="text-sm leading-none">🐫</span>
              <span className="font-medium text-slate-700 text-sm tabular-nums leading-none">{totalPoints.toLocaleString()}</span>
            </div>
        </div>
        <div className="h-1.5 w-full bg-slate-200/50 rounded-xl overflow-hidden border border-slate-200 mt-1">
          <div className="h-full bg-emerald-200 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Game Over Overlay for Multiplay */}
      <AnimatePresence>
        {isMultiplay && roomStatus === 'end' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-amber-200/90 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`${cardClass} w-full max-w-md text-center`}
            >
              <div className="text-sm mb-3">🏁</div>
              <h2 className="text-sm font-medium text-slate-700 mb-2">
                {language === 'ja' ? '終了！' : 'Game Over!'}
              </h2>
              <p className="text-xs text-slate-600 mb-3">
                {language === 'ja' ? '全員がクリアしました！' : 'Everyone has finished!'}
              </p>

              <div className="space-y-2 mb-3">
                {roomPlayers.sort((a, b) => (a.finishTime || 999) - (b.finishTime || 999)).map((player, i) => (
                  <div key={player.uid} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-slate-700 rounded-xl border border-emerald-200 font-medium text-xs">
                        {i + 1}
                      </span>
                      <span className="font-medium text-slate-700 text-sm">{player.name}</span>
                    </div>
                    <span className="font-mono font-medium text-slate-700 text-sm">
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

      <div
        ref={mainContentRef}
        className={`z-10 flex-grow flex items-center justify-center w-full overflow-hidden ${hundredCoop ? 'px-2' : 'px-4'}`}
      >
          <div 
          ref={containerRef} 
            className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden touch-none flex items-center justify-center" 
          style={{
            width: layout.boardSize || 'auto',
            height: layout.boardSize || 'auto',
            // Solo play: when ads exist, the sticky bottom controls can overlap the board.
            // Reserve space by pushing the board upward.
            marginBottom:
              !hundredCoop && !streamMode
                ? `calc(var(--rk-bottom-banner, 0px) + env(safe-area-inset-bottom) + ${Math.max(0, soloBottomControlsPx - 28) + 8}px)`
                : 0,
          }} 
        >
          <canvas 
            ref={canvasRef} 
              className="rounded-xl shadow-sm cursor-crosshair" 
            onPointerDown={handlePointerDown}
          />

          {/* Countdown Overlay */}
          {(startCountdown > 0 || showStartText) && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/30 backdrop-blur-[2px] pointer-events-none">
              <div className={`font-medium text-slate-700 transition-all duration-300 transform
                ${startCountdown > 0 ? 'text-sm scale-110 animate-pulse' : 'text-sm opacity-0'}
                ${showStartText ? 'text-sm opacity-100' : ''}`}>
                {startCountdown > 0 ? startCountdown : (showStartText ? 'GO!' : '')}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isFinished && hundredCoop && (
        <div
          className="w-full px-4 flex items-center justify-center z-20 flex-shrink-0"
          style={{
            marginTop: hundredCoop ? '-34px' : '-18px',
            // Root AppLayout already reserves bottom banner space; avoid pushing the hint too far up.
            // But in hundredCoop with ads visible, the fixed bottom banner can overlap this button.
            marginBottom: streamMode
              ? 0
              : 'calc(var(--rk-bottom-banner, 0px) + env(safe-area-inset-bottom) + 8px)',
          }}
        >
          <button
            onClick={handleHint}
            disabled={totalPoints < HINT_COST}
            className={`bg-sky-200 text-slate-700 rounded-xl shadow-sm border border-sky-200 transition-transform flex items-center justify-center gap-2 font-medium active:scale-95 flex-shrink-0 px-3 py-4
              ${totalPoints < HINT_COST ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            style={{ width: layout.boardSize || 'auto' }}
          >
            <span className="text-sm">☝️🐫-{HINT_COST}</span>
          </button>
        </div>
      )}

      {/* ことば探しのみ: 広告の直上に固定表示（ボタンが消えないように） */}
      {!isFinished && !hundredCoop && (
        <div
          ref={soloBottomControlsRef}
          className="w-full px-4 z-50 flex flex-col items-center gap-2 sticky"
          style={{
            bottom: 'calc(var(--rk-bottom-banner, 0px) + env(safe-area-inset-bottom) + 8px)',
          }}
        >
          <button
            onClick={handleHint}
            disabled={totalPoints < HINT_COST}
            className={`bg-sky-200 text-slate-700 rounded-xl shadow-sm border border-sky-200 transition-transform flex items-center justify-center gap-2 font-medium active:scale-95 flex-shrink-0 px-3 py-4
              ${totalPoints < HINT_COST ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            style={{ width: layout.boardSize || 'auto' }}
          >
            <span className="text-sm">☝️🐫-{HINT_COST}</span>
          </button>

          <div
            className={`bg-emerald-50 text-slate-700 rounded-xl shadow-sm border border-emerald-200 transition-colors relative overflow-hidden flex flex-col items-center w-full
              ${showAnswers ? 'max-h-[45vh]' : ''} ${!showAnswers ? 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer' : ''}`}
            style={{ width: layout.boardSize || 'auto' }}
            onClick={handleShowAnswers}
          >
            <div className={`w-full h-full flex flex-col items-center justify-center ${showAnswers ? 'p-3' : 'p-0'}`}>
              {!showAnswers ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowAnswers();
                  }}
                  className="w-full flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-transform px-3 py-4"
                >
                  <span>🔍🐫-{SHOW_ANSWERS_COST}</span>
                  <span className="text-sm font-black">{t.showAnswers}</span>
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
                        className="text-[10px] font-medium bg-white text-slate-700 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"/></svg>
                        とじる
                      </button>
                      <div className="text-[10px] font-medium text-slate-700 tabular-nums bg-white px-2 py-1.5 rounded-xl border border-slate-200 font-black">
                        {foundCount}/{totalCount}
                      </div>
                    </div>
                    <div className="flex justify-center gap-4 text-[9px] font-black text-slate-600 tracking-tight">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600 shadow-sm shrink-0" aria-hidden />
                        みつけた
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm border-2 border-orange-500 bg-orange-100 shrink-0" aria-hidden />
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
                                  ? 'bg-emerald-600 text-white border-emerald-800 shadow-emerald-900/30 cursor-default ring-0'
                                  : isHinting
                                    ? 'bg-amber-200 text-amber-950 border-amber-500 ring-2 ring-amber-400/90 scale-[1.02]'
                                    : 'bg-white text-slate-900 border-orange-400 hover:bg-orange-50 hover:border-orange-500 active:scale-[0.98]'
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
      )}
    </div>
  );
};

export default GameScreen;