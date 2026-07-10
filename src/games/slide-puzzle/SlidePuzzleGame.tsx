import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HandHelping, RotateCcw, Sparkles } from 'lucide-react';
import {
  type SlidePuzzleArtId,
  SLIDE_PUZZLE_ART_IDS,
  SLIDE_PUZZLE_GRID_SIZE,
  canSlideTile,
  getSlidePuzzleArt,
  getSlidePuzzleEmptyTile,
  getSlidePuzzleTileCount,
  isSlidePuzzleSolved,
  moveSlideTile,
  slidePuzzleCellLayout,
  slidePuzzleTileBackgroundStyle,
} from '../../lib/slidePuzzleLogic';
import { findSlidePuzzleSolutionMoves } from '../../lib/slidePuzzleSolver';
import { clearFlyModalDelayMs } from '../../lib/clearFlyTiming';
import { useSlidePuzzleIdle } from '../../hooks/useSlidePuzzleIdle';
import {
  SLIDE_IDLE_MAX_PENDING_CREDITS,
  SLIDE_IDLE_RELEASE_MOVE_MS,
} from '../../lib/slidePuzzleIdle/config';
import { RK19QuietRoomBackButton } from '../../ui/baselineParts';
import {
  btnGhostTouch,
  btnPrimaryTouch,
  immersiveHeader,
  immersiveKicker,
  immersiveScreenShell,
  immersiveSubtitle,
  immersiveTitle,
} from '../../ui/policy';
import { vibrate } from '../../lib/utils';
import { audioService } from '../../services/audioService';
import LiveClearReportSoloPanel from '../../components/LiveClearReportSoloPanel';

const SLIDE_ANIM_MS = 340;
const AUTO_MOVE_MS = SLIDE_ANIM_MS + 120;
const SLIDE_BTN = btnPrimaryTouch;
const SLIDE_BTN_GHOST = btnGhostTouch;
const SLIDE_TAB_BTN = 'min-h-12 py-2.5 text-[clamp(0.8rem,3.2vw,0.95rem)] leading-tight';

interface SlidePuzzleGameProps {
  onBack: () => void;
  onRecordShussekiGamePlay: () => number;
}

const SlidePuzzleGame: React.FC<SlidePuzzleGameProps> = ({ onBack, onRecordShussekiGamePlay }) => {
  const autoMovesRef = useRef<number[]>([]);
  const autoTimerRef = useRef<number | null>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(280);
  const wasCompletedRef = useRef(false);
  const completeDelayTimerRef = useRef<number | null>(null);
  const helpRequestRef = useRef(0);
  const didRecordClearRef = useRef(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const idle = useSlidePuzzleIdle({
    onIdleCompleted: () => {
      audioService.noteUserGesture();
      audioService.playSlidePuzzleCompleteSound();
    },
  });

  const {
    mode,
    phase,
    board,
    artId,
    resolvedStep,
    totalSteps,
    countdownSeconds,
    intervalSeconds,
    idleCompleted,
    pendingCredits,
    resetIdleTimer,
    handleUserActivity,
    tryManualSlide,
    startNewSession,
    startNewRandomSession,
  } = idle;

  const boardRef = useRef(board);
  boardRef.current = board;

  const [manualMoveCount, setManualMoveCount] = useState(0);
  const [todayClearCount, setTodayClearCount] = useState(0);
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isSearchingHelp, setIsSearchingHelp] = useState(false);
  const [autoHighlightTileId, setAutoHighlightTileId] = useState<number | null>(null);
  const [slideTransitionEnabled, setSlideTransitionEnabled] = useState(true);
  const [autoSolveNotice, setAutoSolveNotice] = useState<string | null>(null);

  const emptyTile = getSlidePuzzleEmptyTile(SLIDE_PUZZLE_GRID_SIZE);
  const tileCount = getSlidePuzzleTileCount(SLIDE_PUZZLE_GRID_SIZE);
  const emptyIndex = board.indexOf(emptyTile);
  const solved = useMemo(() => isSlidePuzzleSolved(board, SLIDE_PUZZLE_GRID_SIZE), [board]);
  const art = useMemo(() => getSlidePuzzleArt(artId), [artId]);
  const isManualMode = mode === 'manual';
  const isInteractiveLocked = !isManualMode || isAutoSolving || isSearchingHelp;

  const handleBack = useCallback(() => {
    vibrate(10);
    onBack();
  }, [onBack]);

  const playSlideSfx = useCallback(() => {
    audioService.noteUserGesture();
    audioService.playSlideSound();
  }, []);

  const stopAutoSolve = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    autoMovesRef.current = [];
    setAutoHighlightTileId(null);
    setIsAutoSolving(false);
  }, []);

  const playNextAutoMoveRef = useRef<() => void>(() => {});

  playNextAutoMoveRef.current = () => {
    const moves = autoMovesRef.current;
    if (moves.length === 0) {
      stopAutoSolve();
      return;
    }
    const nextIndex = moves.shift()!;
    const current = boardRef.current;
    setAutoHighlightTileId(current[nextIndex]);
    const next = moveSlideTile(current, nextIndex, SLIDE_PUZZLE_GRID_SIZE);
    if (!next) {
      stopAutoSolve();
      return;
    }
    tryManualSlide(nextIndex);
    setManualMoveCount((count) => count + 1);
    vibrate(6);
    playSlideSfx();
    autoTimerRef.current = window.setTimeout(() => playNextAutoMoveRef.current(), AUTO_MOVE_MS);
  };

  useEffect(() => () => stopAutoSolve(), [stopAutoSolve]);

  const puzzleComplete =
    (solved && isManualMode && !isAutoSolving && !idleCompleted) || idleCompleted;

  /** ３０（ことば探し）と同じ：完成からクリア画面まで約 5.2 秒 */
  useEffect(() => {
    if (!puzzleComplete) {
      setShowCompleteModal(false);
      wasCompletedRef.current = false;
      if (completeDelayTimerRef.current != null) {
        window.clearTimeout(completeDelayTimerRef.current);
        completeDelayTimerRef.current = null;
      }
      return;
    }

    if (wasCompletedRef.current || completeDelayTimerRef.current != null) return;

    wasCompletedRef.current = true;
    if (solved && isManualMode && !isAutoSolving && !idleCompleted) {
      audioService.noteUserGesture();
      audioService.playSlidePuzzleCompleteSound();
    }

    completeDelayTimerRef.current = window.setTimeout(() => {
      completeDelayTimerRef.current = null;
      setShowCompleteModal(true);
    }, clearFlyModalDelayMs());

    return () => {
      if (completeDelayTimerRef.current != null) {
        window.clearTimeout(completeDelayTimerRef.current);
        completeDelayTimerRef.current = null;
      }
    };
  }, [puzzleComplete, solved, isManualMode, isAutoSolving, idleCompleted]);

  const handlePointerActivity = useCallback(() => {
    handleUserActivity();
  }, [handleUserActivity]);

  const handleTileTap = useCallback(
    (tileId: number) => {
      if (!isManualMode || solved || isAutoSolving || isSearchingHelp) return;
      const fromIndex = board.indexOf(tileId);
      if (!canSlideTile(board, fromIndex, SLIDE_PUZZLE_GRID_SIZE)) return;
      if (!tryManualSlide(fromIndex)) return;
      setManualMoveCount((count) => count + 1);
      vibrate(8);
      playSlideSfx();
    },
    [board, isAutoSolving, isManualMode, isSearchingHelp, playSlideSfx, solved, tryManualSlide],
  );

  const applyShuffle = useCallback(
    (nextArtId?: SlidePuzzleArtId) => {
      startNewSession(nextArtId ?? artId);
      setManualMoveCount(0);
      vibrate(12);
    },
    [artId, startNewSession],
  );

  const handleShuffle = useCallback(() => {
    helpRequestRef.current += 1;
    setIsSearchingHelp(false);
    stopAutoSolve();
    setAutoSolveNotice(null);
    applyShuffle();
  }, [applyShuffle, stopAutoSolve]);

  const handleArtChange = useCallback(
    (nextArtId: SlidePuzzleArtId) => {
      helpRequestRef.current += 1;
      setIsSearchingHelp(false);
      stopAutoSolve();
      setAutoSolveNotice(null);
      applyShuffle(nextArtId);
      vibrate(10);
    },
    [applyShuffle, stopAutoSolve],
  );

  const startAutoSolvePlayback = useCallback((moves: number[]) => {
    autoMovesRef.current = [...moves];
    setIsAutoSolving(true);
    autoTimerRef.current = window.setTimeout(() => playNextAutoMoveRef.current(), AUTO_MOVE_MS);
    vibrate(10);
  }, []);

  const handleAutoSolve = useCallback(() => {
    if (!isManualMode || solved || isAutoSolving || isSearchingHelp) return;
    stopAutoSolve();
    setAutoSolveNotice(null);
    audioService.noteUserGesture();

    const requestId = helpRequestRef.current + 1;
    helpRequestRef.current = requestId;

    setIsSearchingHelp(true);
    const boardSnapshot = board;
    window.setTimeout(() => {
      if (helpRequestRef.current !== requestId) return;
      const moves = findSlidePuzzleSolutionMoves(boardSnapshot);
      if (helpRequestRef.current !== requestId) return;
      setIsSearchingHelp(false);
      if (!moves) {
        setAutoSolveNotice('この並びはお手伝いできませんでした。「混ぜる」でもう一度試してください。');
        vibrate(12);
        return;
      }
      if (moves.length === 0) return;
      startAutoSolvePlayback(moves);
    }, 0);
  }, [
    board,
    isAutoSolving,
    isManualMode,
    isSearchingHelp,
    solved,
    startAutoSolvePlayback,
    stopAutoSolve,
  ]);

  const handlePlayAgain = useCallback(() => {
    handleShuffle();
  }, [handleShuffle]);

  const handleCancelCountdown = useCallback(() => {
    handleUserActivity();
    resetIdleTimer();
  }, [handleUserActivity, resetIdleTimer]);

  /** iPad 等: 親領域の min(幅,高さ) で盤を正方形に固定（aspect-ratio だけだと縦長に伸びる） */
  useLayoutEffect(() => {
    const el = boardAreaRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const next = Math.floor(Math.min(w, h));
      setBoardPx((prev) => (prev === next ? prev : next));
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
  }, []);

  const releaseAnimMs = SLIDE_IDLE_RELEASE_MOVE_MS;
  const slideTransition = slideTransitionEnabled
    ? phase === 'releasing'
      ? `left ${releaseAnimMs}ms cubic-bezier(0.22, 1, 0.36, 1), top ${releaseAnimMs}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${releaseAnimMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : `left ${SLIDE_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${SLIDE_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${SLIDE_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : 'none';

  const autoPlayPhaseLabel = useMemo(() => {
    if (phase === 'ad') return '広告を読み込み中…';
    if (phase === 'releasing') return '応援を届けています…';
    if (phase === 'interval') return `次の応援まであと ${intervalSeconds} 秒`;
    if (pendingCredits > 0) {
      return `応援 ${pendingCredits}手 たまっています — タップで届ける`;
    }
    return '応援をためています…';
  }, [intervalSeconds, pendingCredits, phase]);

  const autoPlayShowsPuzzle =
    mode === 'autoPlay' && (phase === 'releasing' || (phase === 'banking' && pendingCredits > 0));

  const showManualComplete =
    showCompleteModal && solved && isManualMode && !isAutoSolving && !idleCompleted;
  const showIdleComplete = showCompleteModal && idleCompleted;

  useEffect(() => {
    if (!showCompleteModal) {
      didRecordClearRef.current = false;
      return;
    }
    if (didRecordClearRef.current) return;
    didRecordClearRef.current = true;
    setTodayClearCount(onRecordShussekiGamePlay());
  }, [onRecordShussekiGamePlay, showCompleteModal]);

  const handleChallengeAnother = useCallback(() => {
    helpRequestRef.current += 1;
    stopAutoSolve();
    setAutoSolveNotice(null);
    startNewRandomSession();
    setManualMoveCount(0);
    vibrate(12);
  }, [startNewRandomSession, stopAutoSolve]);

  return (
    <div
      className={`${immersiveScreenShell} bg-gradient-to-b from-rk-violet-100 via-rk-indigo-50 to-rk-violet-100 text-rk-slate-800`}
      onPointerDown={handlePointerActivity}
    >
      <header className={immersiveHeader}>
        <div className="absolute left-0 top-0 z-10">
          <RK19QuietRoomBackButton onClick={handleBack} title="らくだ珈琲のトップへもどる" />
        </div>
        <p className={`${immersiveKicker} text-rk-violet-900/75`}>らくだ珈琲</p>
        <h1 className={`${immersiveTitle} text-rk-violet-950`}>スライドパズル</h1>
        <p className={`${immersiveSubtitle} text-rk-indigo-900/75`}>3×3 · 絵をそろえよう</p>
      </header>

      <div
        className="w-full max-w-md shrink-0 mb-2 grid grid-cols-2 gap-1.5 rounded-xl border border-rk-violet-300/80 bg-rk-white/80 p-1"
        role="tablist"
        aria-label="絵の選択"
      >
        {SLIDE_PUZZLE_ART_IDS.map((id) => {
          const option = getSlidePuzzleArt(id);
          const active = artId === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={isInteractiveLocked}
              className={[
                SLIDE_TAB_BTN,
                'rounded-lg px-2 font-bold transition-colors',
                active
                  ? 'bg-rk-violet-200 text-rk-violet-950 shadow-sm'
                  : 'bg-transparent text-rk-indigo-900/70',
                isInteractiveLocked ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
              onClick={() => handleArtChange(id)}
            >
              {option.labelJa}
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-md shrink-0 flex items-stretch justify-between gap-2 mb-2 font-medium">
        <span className="rounded-xl border border-rk-violet-300/80 bg-rk-white/80 px-3 min-h-12 inline-flex items-center justify-center text-[0.9em] leading-none shrink-0">
          {isManualMode
            ? `手数 ${manualMoveCount}`
            : phase === 'releasing'
              ? `届け中 ${resolvedStep} / ${totalSteps}`
              : pendingCredits > 0
                ? `ため ${pendingCredits} / ${SLIDE_IDLE_MAX_PENDING_CREDITS}`
                : `${resolvedStep} / ${totalSteps}`}
        </span>
        <button
          type="button"
          className={`${SLIDE_BTN_GHOST} inline-flex flex-1 items-center justify-center gap-1.5`}
          onClick={handleShuffle}
          disabled={isInteractiveLocked}
        >
          <RotateCcw className="size-[1.1em] shrink-0" aria-hidden />
          混ぜる
        </button>
      </div>

      <div
        ref={boardAreaRef}
        className="flex-1 min-h-0 w-full max-w-md flex items-center justify-center my-1 relative"
      >
        <div
          className={[
            'relative shrink-0 rounded-2xl border-4 border-rk-violet-400/70 bg-rk-white shadow-md overflow-hidden',
            mode === 'autoPlay' && !autoPlayShowsPuzzle ? 'opacity-[0.18]' : '',
          ].join(' ')}
          style={{ width: boardPx, height: boardPx }}
          role="grid"
          aria-label="3×3スライドパズル"
        >
          {isSearchingHelp && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-rk-white/70 font-bold text-rk-violet-950 text-[0.9em]">
              考え中…
            </div>
          )}
          <div
            className="absolute border border-rk-violet-200/80 bg-rk-violet-50"
            style={{
              ...slidePuzzleCellLayout(emptyIndex, SLIDE_PUZZLE_GRID_SIZE),
              transition: slideTransition,
            }}
            aria-hidden
          />

          {Array.from({ length: tileCount - 1 }, (_, tileId) => {
            const cellIndex = board.indexOf(tileId);
            const movable =
              isManualMode &&
              !solved &&
              !isAutoSolving &&
              !isSearchingHelp &&
              canSlideTile(board, cellIndex, SLIDE_PUZZLE_GRID_SIZE);
            const autoActive = isAutoSolving && autoHighlightTileId === tileId;
            const layout = slidePuzzleCellLayout(cellIndex, SLIDE_PUZZLE_GRID_SIZE);

            const tileBg = slidePuzzleTileBackgroundStyle(tileId, SLIDE_PUZZLE_GRID_SIZE, art);

            return (
              <button
                key={`${artId}-tile-${tileId}`}
                type="button"
                role="gridcell"
                aria-label={`ピース ${tileId + 1}`}
                disabled={!movable}
                onClick={() => handleTileTap(tileId)}
                className={[
                  'absolute border border-rk-violet-200/80 bg-rk-white overflow-hidden',
                  movable ? 'cursor-pointer z-10' : 'cursor-default',
                  autoActive ? 'ring-2 ring-rk-success-300 z-20 shadow-md' : '',
                  movable ? 'ring-2 ring-rk-violet-300/80 z-10' : '',
                ].join(' ')}
                style={{
                  ...layout,
                  transition: slideTransition,
                  transform: autoActive ? 'scale(1.03)' : 'scale(1)',
                  backgroundImage: `url(${art.url})`,
                  backgroundRepeat: 'no-repeat',
                  ...tileBg,
                }}
              />
            );
          })}
        </div>

        <AnimatePresence>
          {mode === 'countdown' && (
            <motion.div
              className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-rk-violet-950/25 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-full max-w-xs rounded-2xl border border-rk-white/30 bg-rk-white/90 p-4 text-center shadow-lg">
                <p className="text-[0.95em] font-bold text-rk-violet-950 leading-snug">
                  {countdownSeconds}秒後に応援（放置）モードを開始します…
                </p>
                <button
                  type="button"
                  className={`${SLIDE_BTN_GHOST} mt-3 w-full`}
                  onClick={handleCancelCountdown}
                >
                  キャンセル
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'autoPlay' && !autoPlayShowsPuzzle && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-black/92 px-4 text-center pointer-events-none">
            <p className="text-[0.82em] text-rk-white/55 font-medium">{autoPlayPhaseLabel}</p>
            <p className="mt-3 text-[1.05em] font-bold text-rk-white/75">
              {resolvedStep} / {totalSteps} ピース
            </p>
            <p className="mt-4 text-[0.75em] text-rk-white/40 leading-snug max-w-[16rem]">
              {pendingCredits > 0
                ? '画面をタップすると、ためた応援が一気に届きます'
                : 'クレジットがたまったらタップ。なければタップで手動モードへ'}
            </p>
          </div>
        )}

        {autoPlayShowsPuzzle && (
          <div className="absolute inset-x-0 top-3 z-40 flex justify-center pointer-events-none px-3">
            <p className="rounded-full bg-rk-violet-950/80 px-3 py-1.5 text-[0.78em] font-bold text-rk-white/95 text-center leading-snug max-w-full">
              {autoPlayPhaseLabel}
            </p>
          </div>
        )}
      </div>

      {isManualMode && (
        <div className="w-full max-w-md shrink-0 mt-1 space-y-2">
          <p className="text-[0.78em] text-rk-indigo-900/70 text-center leading-snug px-1">
            {isSearchingHelp
              ? '正解の並べ方を考えています…'
              : isAutoSolving
              ? 'お手伝い中… ピースが自動で動いています。'
              : '光っているピースをタップ。お手伝いはいまの並びから最短でそろえます。'}
          </p>

          <button
            type="button"
            className={`${SLIDE_BTN} w-full inline-flex items-center justify-center gap-2`}
            onClick={handleAutoSolve}
            disabled={solved || isAutoSolving || isSearchingHelp}
          >
            <HandHelping className="size-[1.15em] shrink-0" aria-hidden />
            <span className="text-center leading-snug">
              {isSearchingHelp ? '考え中…' : 'お手伝い（自動でそろえる）'}
            </span>
          </button>

          {autoSolveNotice && (
            <p className="text-[0.78em] text-rk-indigo-900/80 text-center leading-snug px-1">{autoSolveNotice}</p>
          )}
        </div>
      )}

      <AnimatePresence>
        {showCompleteModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-rk-violet-950/35 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-rk-violet-200 bg-rk-white p-4 text-center shadow-xl text-[clamp(0.9375rem,3.6vw,1.0625rem)]"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-rk-success-100 text-rk-success-700">
                <Sparkles className="size-[1.4em]" aria-hidden />
              </div>
              <h2 className="text-[1.1em] font-black text-rk-violet-950 leading-tight">
                {showIdleComplete ? '応援モードで完成！' : 'そろった！'}
              </h2>
              <p className="mt-1.5 text-[0.9em] text-rk-indigo-900/80 leading-snug">
                {showIdleComplete
                  ? `${totalSteps}手の応援で絵がそろいました。`
                  : `${manualMoveCount}手で完成しました。`}
              </p>
              {todayClearCount > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rk-success-200 bg-rk-success-50 px-3 py-2">
                  <span className="text-lg leading-none" aria-hidden>
                    🐫
                  </span>
                  <p className="text-[0.88em] font-bold text-rk-success-900 leading-snug">
                    しゅっせき簿にスタンプがたまった！
                  </p>
                </div>
              )}
              {showManualComplete ? (
                <div className="mt-3 text-left">
                  <LiveClearReportSoloPanel kind="slide-puzzle" vibrate={vibrate} />
                </div>
              ) : null}
              <button type="button" className={`${SLIDE_BTN} mt-3 w-full`} onClick={handleChallengeAnother}>
                もう1枚挑戦する
              </button>
              <button type="button" className={`${SLIDE_BTN_GHOST} mt-2 w-full`} onClick={handlePlayAgain}>
                同じ絵でもう一度
              </button>
              <button type="button" className={`${SLIDE_BTN_GHOST} mt-2 w-full`} onClick={handleBack}>
                トップへもどる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SlidePuzzleGame;
