export const RK_STREAM_LIVE_BADGE_KEY = 'rk_stream_live_badge_v1';

/** ひと言探しプレイ画面右上のバッジ文言（管理者・配信モード時のみ） */
export const RK_STREAM_LIVE_BADGE_LABEL = 'NOW ON AIR';
export function readStreamLiveBadgeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RK_STREAM_LIVE_BADGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistStreamLiveBadgeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RK_STREAM_LIVE_BADGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}
