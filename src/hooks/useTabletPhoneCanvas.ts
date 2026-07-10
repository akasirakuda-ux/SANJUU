import { useEffect } from 'react';
import {
  applyViewportForScreen,
  applyViewportForScreenDeferred,
  resetTabletPhoneCanvasSyncCache,
  scheduleTabletPhoneCanvasSync,
  shouldDisablePhoneCanvasForScreen,
  shouldUseTabletPhoneCanvas,
} from '../lib/tabletPhoneCanvas';

/**
 * iPad 等: 画面ごとに viewport を切替。
 * - トップハブ等 → 390px を画面幅に拡大
 * - ことば探し（select/game）・ペア探し → 実幅（切替なしで白画面・極小表示を防ぐ）
 */
export function useTabletPhoneCanvasForScreen(screen: string): void {
  useEffect(() => {
    applyViewportForScreenDeferred(screen);

    const wantPhoneCanvas = shouldUseTabletPhoneCanvas() && !shouldDisablePhoneCanvasForScreen(screen);
    if (!wantPhoneCanvas) {
      return;
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSync = () => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => scheduleTabletPhoneCanvasSync(), 200);
    };

    const onOrientation = () => {
      resetTabletPhoneCanvasSyncCache();
      applyViewportForScreen(screen);
      scheduleSync();
    };

    window.addEventListener('orientationchange', onOrientation);
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('resize', scheduleSync);
    };
  }, [screen]);
}

/** @deprecated screen 引数版を使う */
export function useTabletPhoneCanvas(enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      applyViewportForScreen('game');
      return;
    }
    applyViewportForScreen('seat-selection');
  }, [enabled]);
}
