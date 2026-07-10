/** localStorage: 最後に全面広告（インタースティシャル）を閉じた時刻 */
export const RK_INTERSTITIAL_LAST_MS_KEY = 'rk_interstitial_last_shown_ms';

/** この時間以上経過したら「次の自然な区切り」で出してよいフラグを立てる */
export const INTERSTITIAL_ARM_MS = 120_000;

/** 連続表示防止: 直近の表示から最低この秒数空ける */
export const INTERSTITIAL_MIN_GAP_MS = 60_000;

export function readLastInterstitialDismissedMs(): number {
  try {
    const raw = localStorage.getItem(RK_INTERSTITIAL_LAST_MS_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    // ignore
  }
  return Date.now();
}

export function writeLastInterstitialDismissedMs(ms: number): void {
  try {
    localStorage.setItem(RK_INTERSTITIAL_LAST_MS_KEY, String(Math.round(ms)));
  } catch {
    // ignore
  }
}
