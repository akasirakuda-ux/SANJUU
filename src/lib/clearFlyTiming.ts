/**
 * ことば探し（３０含む）のクリア横スクロール → クリア結果モーダルまでのタイミング。
 * ラストワン（-200% / 2.4s）と同じ px/s で「おめでとう😊」が流れ切った直後 + 150ms。
 */

export const FLY_BANNER_DURATION_SEC = 2.4;
export const LAST_ONE_FLY_X_PERCENT = 200;
export const CLEAR_FLY_X_PERCENT = 420;
export const CLEAR_RESULT_OVERLAY_TIMING_SCALE = 1;
export const CLEAR_MODAL_EXTRA_MS = 150;

/** 横幅未計測時のクリア横スクロール秒数（2.4 × 420/200 = 5.04s） */
export function defaultClearFlyDurationSec(): number {
  return FLY_BANNER_DURATION_SEC * (CLEAR_FLY_X_PERCENT / LAST_ONE_FLY_X_PERCENT);
}

/** 完成／最終正解からクリア画面まで（ms）。横幅未計測時は約 5190ms。 */
export function clearFlyModalDelayMs(opts?: {
  lastBannerWidthPx?: number;
  clearBannerWidthPx?: number;
}): number {
  const wl = opts?.lastBannerWidthPx ?? 0;
  const wc = opts?.clearBannerWidthPx ?? 0;
  let clearFlyDurationSec: number;
  if (wl <= 1 || wc <= 1) {
    clearFlyDurationSec = defaultClearFlyDurationSec();
  } else {
    const v = (LAST_ONE_FLY_X_PERCENT / 100) * wl / FLY_BANNER_DURATION_SEC;
    const dist = (CLEAR_FLY_X_PERCENT / 100) * wc;
    clearFlyDurationSec = dist / v;
  }
  return Math.round(
    clearFlyDurationSec * 1000 * CLEAR_RESULT_OVERLAY_TIMING_SCALE +
      CLEAR_MODAL_EXTRA_MS * CLEAR_RESULT_OVERLAY_TIMING_SCALE,
  );
}

export const DEFAULT_CLEAR_FLY_MODAL_DELAY_MS = clearFlyModalDelayMs();
