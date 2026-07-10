'use client';

import { useEffect } from 'react';
import {
  resetTabletPhoneCanvasSyncCache,
  restoreDefaultViewport,
  scheduleTabletPhoneCanvasSync,
  syncTabletPhoneCanvasViewport,
} from '../lib/tabletPhoneCanvas';

/** iPad 等: らくだ本体と同じ 390px → 画面幅いっぱい拡大 */
export default function TabletPhoneCanvasSync() {
  useEffect(() => {
    syncTabletPhoneCanvasViewport();

    let resizeTimer: number | null = null;
    const scheduleSync = () => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => scheduleTabletPhoneCanvasSync(), 200);
    };

    const onOrientation = () => {
      resetTabletPhoneCanvasSyncCache();
      scheduleSync();
    };

    window.addEventListener('orientationchange', onOrientation);
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (resizeTimer != null) clearTimeout(resizeTimer);
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('resize', scheduleSync);
      restoreDefaultViewport();
    };
  }, []);

  return null;
}
