export const RK_COORD_OVERLAY_KEY = 'rk_coord_overlay_v1';

/**
 * 盤面の座標表示（A,B,C… / 1,2,3…）を ON/OFF。
 * 既定は OFF（既存の通常プレイの見た目を変えない）。
 */
export function readCoordOverlayEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RK_COORD_OVERLAY_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistCoordOverlayEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RK_COORD_OVERLAY_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

