import { useCallback, useEffect, useRef, useState } from 'react';
import type { SlidePuzzleArtId } from '../lib/slidePuzzleLogic';
import { SLIDE_PUZZLE_ART_IDS, SLIDE_PUZZLE_GRID_SIZE, isValidSlideBoard, moveSlideTile, slidePuzzleBoardKey } from '../lib/slidePuzzleLogic';
import { writeLastInterstitialDismissedMs } from '../lib/interstitialPolicy';
import { resolveActiveRakudaGate, shouldSuppressAdsForGate } from '../lib/rakudaGate';
import { adService } from '../services/adService';
import { notifyIdleArmActivity, resetIdleArmClock, consumePendingSlideIdleAutoPlay, RAKUDA_SLIDE_IDLE_ARM_EVENT } from '../lib/rakudaIdleArm';
import {
  getSlideIdleAdIntervalMs,
  getSlideIdleCountdownSeconds,
  SLIDE_IDLE_RELEASE_MOVE_MS,
} from '../lib/slidePuzzleIdle/config';
import {
  addIdlePendingCredit,
  applyIdleUndoStep,
  createIdleSnapshot,
  generateIdlePuzzle,
  idleSnapshotRemainingSteps,
  idleSnapshotTotalSteps,
  isIdleCreditBankFull,
  isIdleSnapshotSolved,
  type IdlePuzzleSnapshot,
  type SlideIdleMode,
} from '../lib/slidePuzzleIdle/engine';
import {
  loadSlideIdleSession,
  saveSlideIdleSession,
  storedSessionToIdleSnapshot,
  clearSlideIdleSession,
} from '../lib/slidePuzzleIdle/storage';

export type SlideIdlePhase = 'idle' | 'ad' | 'interval' | 'banking' | 'releasing';

export type UseSlidePuzzleIdleOptions = {
  initialArtId?: SlidePuzzleArtId;
  onIdleCompleted?: () => void;
};

function sleepMs(ms: number, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (isCancelled()) {
      resolve();
      return;
    }
    const id = window.setTimeout(() => {
      resolve();
    }, ms);
    const check = window.setInterval(() => {
      if (isCancelled()) {
        window.clearTimeout(id);
        window.clearInterval(check);
        resolve();
      }
    }, 50);
    window.setTimeout(() => window.clearInterval(check), ms + 60);
  });
}

function buildFreshSnapshot(artId: SlidePuzzleArtId): {
  snapshot: IdlePuzzleSnapshot;
  helpTapMoves: number[];
} {
  const generated = generateIdlePuzzle();
  return {
    snapshot: createIdleSnapshot(artId, generated, 'manual'),
    helpTapMoves: generated.helpTapMoves,
  };
}

function loadInitialSnapshot(artId: SlidePuzzleArtId): {
  snapshot: IdlePuzzleSnapshot;
  helpTapMoves: number[];
} {
  const stored = loadSlideIdleSession();
  if (stored) {
    const restored = storedSessionToIdleSnapshot(stored);
    if (!isValidSlideBoard(restored.board, SLIDE_PUZZLE_GRID_SIZE)) {
      clearSlideIdleSession();
      return buildFreshSnapshot(artId);
    }
    return {
      snapshot: {
        ...restored,
        mode: 'manual',
        exitRequested: false,
      },
      helpTapMoves: [...restored.undoMoves].reverse(),
    };
  }
  return buildFreshSnapshot(artId);
}

export function useSlidePuzzleIdle(options: UseSlidePuzzleIdleOptions = {}) {
  const initialArtId = options.initialArtId ?? 'r-hero';
  const onIdleCompletedRef = useRef(options.onIdleCompleted);
  onIdleCompletedRef.current = options.onIdleCompleted;

  const initial = useRef(loadInitialSnapshot(initialArtId)).current;
  const [snapshot, setSnapshot] = useState<IdlePuzzleSnapshot>(initial.snapshot);
  const [mode, setMode] = useState<SlideIdleMode>(initial.snapshot.mode);
  const [phase, setPhase] = useState<SlideIdlePhase>('idle');
  const [countdownSeconds, setCountdownSeconds] = useState(getSlideIdleCountdownSeconds());
  const [intervalSeconds, setIntervalSeconds] = useState(0);
  const [idleCompleted, setIdleCompleted] = useState(() => isIdleSnapshotSolved(initial.snapshot));
  const [autoLoopEpoch, setAutoLoopEpoch] = useState(0);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const helpTapMovesRef = useRef<number[]>(initial.helpTapMoves);
  const shuffleBoardKeyRef = useRef(initial.snapshot.boardKeyAtShuffle);

  const countdownTimerRef = useRef<number | null>(null);
  const intervalTickRef = useRef<number | null>(null);
  const autoLoopGenerationRef = useRef(0);
  const skipInitialAdRef = useRef(false);
  const releaseInProgressRef = useRef(false);

  const persistSnapshot = useCallback((next: IdlePuzzleSnapshot) => {
    setSnapshot(next);
    snapshotRef.current = next;
    saveSlideIdleSession(next);
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current != null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const clearIntervalTick = useCallback(() => {
    if (intervalTickRef.current != null) {
      window.clearInterval(intervalTickRef.current);
      intervalTickRef.current = null;
    }
  }, []);

  const bumpAutoLoop = useCallback(() => {
    setAutoLoopEpoch((epoch) => epoch + 1);
  }, []);

  const exitToManual = useCallback(() => {
    autoLoopGenerationRef.current += 1;
    clearIntervalTick();
    setPhase('idle');
    setMode('manual');
    const next: IdlePuzzleSnapshot = {
      ...snapshotRef.current,
      mode: 'manual',
      exitRequested: false,
    };
    persistSnapshot(next);
  }, [clearIntervalTick, persistSnapshot]);

  const resetIdleTimer = useCallback(() => {
    notifyIdleArmActivity();
  }, []);

  const finishIdleComplete = useCallback(
    (finalSnapshot: IdlePuzzleSnapshot) => {
      setIdleCompleted(true);
      setPhase('idle');
      setMode('manual');
      persistSnapshot({ ...finalSnapshot, mode: 'manual', exitRequested: false, pendingCredits: 0 });
      onIdleCompletedRef.current?.();
    },
    [persistSnapshot],
  );

  const releasePendingCredits = useCallback(async () => {
    if (releaseInProgressRef.current) return;
    const credits = snapshotRef.current.pendingCredits;
    if (credits <= 0) return;
    if (modeRef.current !== 'autoPlay') return;

    releaseInProgressRef.current = true;
    autoLoopGenerationRef.current += 1;
    clearIntervalTick();
    setPhase('releasing');

    const movesToPlay = Math.min(credits, idleSnapshotRemainingSteps(snapshotRef.current));
    let current = snapshotRef.current;

    for (let i = 0; i < movesToPlay; i += 1) {
      current = applyIdleUndoStep(current);
      const creditsLeft = Math.max(0, credits - i - 1);
      persistSnapshot({ ...current, mode: 'autoPlay', pendingCredits: creditsLeft, exitRequested: false });
      await sleepMs(SLIDE_IDLE_RELEASE_MOVE_MS, () => false);
    }

    const settled = { ...current, mode: 'autoPlay' as const, pendingCredits: 0, exitRequested: false };
    persistSnapshot(settled);
    releaseInProgressRef.current = false;

    if (isIdleSnapshotSolved(settled)) {
      finishIdleComplete(settled);
      return;
    }

    setPhase('banking');
    bumpAutoLoop();
  }, [bumpAutoLoop, clearIntervalTick, finishIdleComplete, persistSnapshot]);

  const beginAutoPlayFromIdleArm = useCallback(
    (skipInitialAd: boolean) => {
      if (modeRef.current === 'autoPlay') return;
      if (modeRef.current !== 'manual' && modeRef.current !== 'countdown') return;
      if (isIdleSnapshotSolved(snapshotRef.current)) return;

      autoLoopGenerationRef.current += 1;
      clearCountdownTimer();
      clearIntervalTick();
      skipInitialAdRef.current = skipInitialAd;
      resetIdleArmClock();
      setPhase('banking');

      let next: IdlePuzzleSnapshot = {
        ...snapshotRef.current,
        mode: 'autoPlay',
        exitRequested: false,
      };
      if (skipInitialAd) {
        next = addIdlePendingCredit(next);
      }
      persistSnapshot(next);
      setMode('autoPlay');
      bumpAutoLoop();
    },
    [bumpAutoLoop, clearCountdownTimer, clearIntervalTick, persistSnapshot],
  );

  const startNewSession = useCallback(
    (artId: SlidePuzzleArtId) => {
      autoLoopGenerationRef.current += 1;
      clearCountdownTimer();
      clearIntervalTick();
      setPhase('idle');
      setIdleCompleted(false);
      setMode('manual');

      const fresh = buildFreshSnapshot(artId);
      helpTapMovesRef.current = fresh.helpTapMoves;
      shuffleBoardKeyRef.current = fresh.snapshot.boardKeyAtShuffle;
      persistSnapshot(fresh.snapshot);
      resetIdleTimer();
      return fresh;
    },
    [clearCountdownTimer, clearIntervalTick, persistSnapshot, resetIdleTimer],
  );

  const startNewRandomSession = useCallback(() => {
    clearSlideIdleSession();
    const currentArt = snapshotRef.current.artId;
    const candidates = SLIDE_PUZZLE_ART_IDS.filter((id) => id !== currentArt);
    const nextArt =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]!
        : SLIDE_PUZZLE_ART_IDS[0]!;
    return startNewSession(nextArt);
  }, [startNewSession]);

  const tryManualSlide = useCallback(
    (fromIndex: number): boolean => {
      if (modeRef.current !== 'manual') return false;
      const nextBoard = moveSlideTile(snapshotRef.current.board, fromIndex, SLIDE_PUZZLE_GRID_SIZE);
      if (!nextBoard) return false;
      const next: IdlePuzzleSnapshot = { ...snapshotRef.current, board: nextBoard };
      persistSnapshot(next);
      resetIdleTimer();
      return true;
    },
    [persistSnapshot, resetIdleTimer],
  );

  const handleUserActivity = useCallback(() => {
    if (modeRef.current === 'manual') {
      resetIdleTimer();
      return;
    }
    if (modeRef.current === 'countdown') {
      clearCountdownTimer();
      exitToManual();
      resetIdleTimer();
      return;
    }
    if (modeRef.current === 'autoPlay') {
      if (releaseInProgressRef.current) return;
      if (snapshotRef.current.pendingCredits > 0) {
        void releasePendingCredits();
        return;
      }
      if (snapshotRef.current.exitRequested) return;
      const next: IdlePuzzleSnapshot = { ...snapshotRef.current, exitRequested: true };
      persistSnapshot(next);
    }
  }, [clearCountdownTimer, exitToManual, persistSnapshot, releasePendingCredits, resetIdleTimer]);

  useEffect(() => {
    const onArm = () => {
      const pending = consumePendingSlideIdleAutoPlay();
      if (!pending) return;
      beginAutoPlayFromIdleArm(pending.skipInitialAd);
    };
    window.addEventListener(RAKUDA_SLIDE_IDLE_ARM_EVENT, onArm);
    const pendingOnMount = consumePendingSlideIdleAutoPlay();
    if (pendingOnMount) beginAutoPlayFromIdleArm(pendingOnMount.skipInitialAd);
    return () => window.removeEventListener(RAKUDA_SLIDE_IDLE_ARM_EVENT, onArm);
  }, [beginAutoPlayFromIdleArm]);

  useEffect(() => {
    if (mode !== 'countdown') {
      clearCountdownTimer();
      return;
    }

    setCountdownSeconds(getSlideIdleCountdownSeconds());
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearCountdownTimer();
          setMode('autoPlay');
          const next: IdlePuzzleSnapshot = {
            ...snapshotRef.current,
            mode: 'autoPlay',
            exitRequested: false,
          };
          persistSnapshot(next);
          bumpAutoLoop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearCountdownTimer;
  }, [bumpAutoLoop, clearCountdownTimer, mode, persistSnapshot]);

  useEffect(() => {
    if (mode !== 'autoPlay') return;

    const generation = autoLoopGenerationRef.current + 1;
    autoLoopGenerationRef.current = generation;
    let cancelled = false;
    const isCancelled = () =>
      cancelled || autoLoopGenerationRef.current !== generation || releaseInProgressRef.current;

    const waitInterval = async () => {
      const totalMs = getSlideIdleAdIntervalMs();
      const totalSec = Math.max(1, Math.ceil(totalMs / 1000));
      setIntervalSeconds(totalSec);
      clearIntervalTick();

      await new Promise<void>((resolve) => {
        let remaining = totalSec;
        intervalTickRef.current = window.setInterval(() => {
          if (isCancelled()) {
            clearIntervalTick();
            resolve();
            return;
          }
          remaining -= 1;
          setIntervalSeconds(Math.max(0, remaining));
          if (remaining <= 0) {
            clearIntervalTick();
            resolve();
          }
        }, 1000);
      });
    };

    const waitWhileBankFull = async () => {
      setPhase('banking');
      while (!isCancelled()) {
        if (!isIdleCreditBankFull(snapshotRef.current)) return;
        if (snapshotRef.current.pendingCredits === 0 && snapshotRef.current.exitRequested) return;
        await sleepMs(200, isCancelled);
      }
    };

    const runAutoLoop = async () => {
      let skipAd = skipInitialAdRef.current;
      skipInitialAdRef.current = false;

      while (!isCancelled()) {
        if (snapshotRef.current.exitRequested && snapshotRef.current.pendingCredits === 0) {
          exitToManual();
          resetIdleTimer();
          return;
        }

        if (isIdleCreditBankFull(snapshotRef.current)) {
          await waitWhileBankFull();
          if (isCancelled()) return;
          continue;
        }

        if (!skipAd) {
          setPhase('interval');
          await waitInterval();
          if (isCancelled()) return;

          if (snapshotRef.current.exitRequested && snapshotRef.current.pendingCredits === 0) {
            exitToManual();
            resetIdleTimer();
            return;
          }

          if (isIdleCreditBankFull(snapshotRef.current)) {
            continue;
          }

          setPhase('ad');
          try {
            if (!shouldSuppressAdsForGate()) {
              await adService.showSingleGateAd(resolveActiveRakudaGate());
              writeLastInterstitialDismissedMs(Date.now());
            }
          } catch {
            // 広告失敗時もクレジット加算を試みる
          }
          if (isCancelled()) return;

          const credited = addIdlePendingCredit({
            ...snapshotRef.current,
            mode: 'autoPlay',
            exitRequested: false,
          });
          persistSnapshot(credited);
        }
        skipAd = false;

        setPhase('banking');

        if (isIdleSnapshotSolved(snapshotRef.current)) {
          finishIdleComplete(snapshotRef.current);
          return;
        }
      }
    };

    void runAutoLoop();

    return () => {
      cancelled = true;
      autoLoopGenerationRef.current += 1;
      clearIntervalTick();
      if (!releaseInProgressRef.current) {
        setPhase('idle');
      }
    };
  }, [
    autoLoopEpoch,
    clearIntervalTick,
    exitToManual,
    finishIdleComplete,
    mode,
    persistSnapshot,
    resetIdleTimer,
  ]);

  useEffect(() => {
    const onHide = () => {
      saveSlideIdleSession({ ...snapshotRef.current, mode: modeRef.current });
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => {
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  useEffect(
    () => () => {
      clearCountdownTimer();
      clearIntervalTick();
      autoLoopGenerationRef.current += 1;
    },
    [clearCountdownTimer, clearIntervalTick],
  );

  const totalSteps = idleSnapshotTotalSteps(snapshot);
  const canUseStoredHelp =
    mode === 'manual' &&
    snapshot.resolvedStep === 0 &&
    slidePuzzleBoardKey(snapshot.board) === shuffleBoardKeyRef.current &&
    helpTapMovesRef.current.length > 0;

  return {
    snapshot,
    mode,
    phase,
    countdownSeconds,
    intervalSeconds,
    idleCompleted,
    pendingCredits: snapshot.pendingCredits,
    totalSteps,
    artId: snapshot.artId,
    board: snapshot.board,
    resolvedStep: snapshot.resolvedStep,
    resetIdleTimer,
    handleUserActivity,
    tryManualSlide,
    startNewSession,
    startNewRandomSession,
    canUseStoredHelp,
    helpTapMovesRef,
    shuffleBoardKeyRef,
    exitToManual,
    releasePendingCredits,
  };
}
