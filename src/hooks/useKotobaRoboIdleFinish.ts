import { useCallback, useEffect, useRef, useState } from 'react';
import { getKotobaRoboIdleArmMs, pickKotobaRoboFindDelayMs } from '../lib/kotobaRoboIdle/config';
import { listUnfoundOccurrences } from '../lib/kotobaRoboIdle/unfoundOccurrences';
import type { FoundWord, PlacedWord, Point } from '../types';

export type KotobaRoboIdleFinishOptions = {
  enabled: boolean;
  isFinished: boolean;
  /** スタートカウントダウン中は動かさない */
  startCountdown: number;
  countByOccurrence: boolean;
  placedWords: PlacedWord[];
  foundWords: FoundWord[];
  onRoboFind: (word: string, start: Point, end: Point) => void;
  getLastActivityMs: () => number;
  /** ロボが最初の1語を見つけ始めたとき（1回） */
  onRoboStarted?: () => void;
};

/**
 * 5分放置後、らくだロボが残りの正解を粛々と見つけてクリアまで進める。
 * 利用者が戻って操作したら即停止（責めない）。
 */
export function useKotobaRoboIdleFinish(options: KotobaRoboIdleFinishOptions) {
  const {
    enabled,
    isFinished,
    startCountdown,
    countByOccurrence,
    placedWords,
    foundWords,
    onRoboFind,
    getLastActivityMs,
    onRoboStarted,
  } = options;

  const [roboIdleActive, setRoboIdleActive] = useState(false);
  const roboIdleActiveRef = useRef(false);
  const findTimerRef = useRef<number | null>(null);
  const startedNotifiedRef = useRef(false);
  const onRoboFindRef = useRef(onRoboFind);
  const onRoboStartedRef = useRef(onRoboStarted);
  const placedWordsRef = useRef(placedWords);
  const foundWordsRef = useRef(foundWords);

  useEffect(() => {
    onRoboFindRef.current = onRoboFind;
  }, [onRoboFind]);
  useEffect(() => {
    onRoboStartedRef.current = onRoboStarted;
  }, [onRoboStarted]);
  useEffect(() => {
    placedWordsRef.current = placedWords;
  }, [placedWords]);
  useEffect(() => {
    foundWordsRef.current = foundWords;
  }, [foundWords]);

  const clearFindTimer = useCallback(() => {
    if (findTimerRef.current != null) {
      window.clearTimeout(findTimerRef.current);
      findTimerRef.current = null;
    }
  }, []);

  const deactivateRobo = useCallback(() => {
    if (!roboIdleActiveRef.current) return;
    roboIdleActiveRef.current = false;
    setRoboIdleActive(false);
    startedNotifiedRef.current = false;
    clearFindTimer();
  }, [clearFindTimer]);

  const scheduleNextFind = useCallback(() => {
    clearFindTimer();
    if (!roboIdleActiveRef.current || isFinished) return;

    const delayMs = pickKotobaRoboFindDelayMs();
    findTimerRef.current = window.setTimeout(() => {
      findTimerRef.current = null;
      if (!roboIdleActiveRef.current || isFinished) return;

      const idleMs = Date.now() - getLastActivityMs();
      if (idleMs < getKotobaRoboIdleArmMs()) {
        deactivateRobo();
        return;
      }

      const remaining = listUnfoundOccurrences(
        placedWordsRef.current,
        foundWordsRef.current,
        countByOccurrence,
      );
      if (remaining.length === 0) return;

      const next = remaining[0]!;
      if (!startedNotifiedRef.current) {
        startedNotifiedRef.current = true;
        onRoboStartedRef.current?.();
      }
      onRoboFindRef.current(next.word, next.start, next.end);
      scheduleNextFind();
    }, delayMs);
  }, [clearFindTimer, countByOccurrence, deactivateRobo, getLastActivityMs, isFinished]);

  const activateRobo = useCallback(() => {
    if (roboIdleActiveRef.current || isFinished || !enabled) return;
    const remaining = listUnfoundOccurrences(placedWordsRef.current, foundWordsRef.current, countByOccurrence);
    if (remaining.length === 0) return;
    roboIdleActiveRef.current = true;
    setRoboIdleActive(true);
    scheduleNextFind();
  }, [countByOccurrence, enabled, isFinished, scheduleNextFind]);

  // 放置監視（1秒）
  useEffect(() => {
    if (!enabled || isFinished || startCountdown > 0) {
      deactivateRobo();
      return;
    }

    const tick = () => {
      const idleMs = Date.now() - getLastActivityMs();
      if (idleMs >= getKotobaRoboIdleArmMs()) {
        if (!roboIdleActiveRef.current) activateRobo();
        return;
      }
      if (roboIdleActiveRef.current) deactivateRobo();
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
      deactivateRobo();
    };
  }, [activateRobo, deactivateRobo, enabled, getLastActivityMs, isFinished, startCountdown]);

  // foundWords が増えたら次のスケジュールを維持
  useEffect(() => {
    if (!roboIdleActiveRef.current || isFinished) return;
    const remaining = listUnfoundOccurrences(placedWords, foundWords, countByOccurrence);
    if (remaining.length === 0) {
      clearFindTimer();
      return;
    }
    if (findTimerRef.current == null) {
      scheduleNextFind();
    }
  }, [clearFindTimer, countByOccurrence, foundWords, isFinished, placedWords, scheduleNextFind]);

  useEffect(() => {
    return () => clearFindTimer();
  }, [clearFindTimer]);

  return { roboIdleActive };
}
