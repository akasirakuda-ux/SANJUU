import { getSlideIdleArmMs } from './slidePuzzleIdle/config';

/** 5分放置完了 — 応援モード（スライドパズル）向け */
export const RAKUDA_SLIDE_IDLE_ARM_EVENT = 'RAKUDA_SLIDE_IDLE_ARM';

export type SlideIdleArmAutoPlayRequest = {
  /** AppShell が先に全面広告を出した直後なら true（ループ先頭の広告を省略） */
  skipInitialAd: boolean;
};

let pendingAutoPlay: SlideIdleArmAutoPlayRequest | null = null;

/** 全面広告のあと応援モード自動再生を予約（lazy マウント前でも consume で拾える） */
export function requestSlideIdleAutoPlay(skipInitialAd: boolean): void {
  pendingAutoPlay = { skipInitialAd };
  window.dispatchEvent(new CustomEvent(RAKUDA_SLIDE_IDLE_ARM_EVENT));
}

export function consumePendingSlideIdleAutoPlay(): SlideIdleArmAutoPlayRequest | null {
  const req = pendingAutoPlay;
  pendingAutoPlay = null;
  return req;
}

type ProgressListener = (progress: number) => void;
type CompleteListener = () => void;

let armStartMs = Date.now();
/** 同一 arm サイクルで complete を1回だけ */
let completedForArmStartMs = -1;
let tickId: number | null = null;

const progressListeners = new Set<ProgressListener>();
const completeListeners = new Set<CompleteListener>();

function getProgress(): number {
  const armMs = getSlideIdleArmMs();
  return Math.min(1, (Date.now() - armStartMs) / armMs);
}

function emitProgress() {
  const progress = getProgress();
  for (const listener of progressListeners) {
    listener(progress);
  }
  if (progress < 1) return;
  if (completedForArmStartMs === armStartMs) return;
  completedForArmStartMs = armStartMs;
  for (const listener of completeListeners) {
    listener();
  }
}

function ensureTicking() {
  if (tickId != null) return;
  tickId = window.setInterval(emitProgress, 500);
}

export function resetIdleArmClock() {
  armStartMs = Date.now();
  completedForArmStartMs = -1;
  emitProgress();
}

export function notifyIdleArmActivity() {
  resetIdleArmClock();
}

export function subscribeIdleArmProgress(listener: ProgressListener): () => void {
  ensureTicking();
  progressListeners.add(listener);
  listener(getProgress());
  return () => {
    progressListeners.delete(listener);
  };
}

export function subscribeIdleArmComplete(listener: CompleteListener): () => void {
  ensureTicking();
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
}

let activityListenersBound = false;

export function bindIdleArmActivityListeners() {
  if (activityListenersBound || typeof window === 'undefined') return;
  activityListenersBound = true;
  const onActivity = () => notifyIdleArmActivity();
  for (const eventName of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(eventName, onActivity, { passive: true });
  }
  resetIdleArmClock();
}
