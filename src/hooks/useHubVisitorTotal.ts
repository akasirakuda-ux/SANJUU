import { useLayoutEffect, useState } from 'react';
import {
  hubVisitorTotalForDisplay,
  mergeHubVisitorTotals,
  readLocalHubVisitorTotal,
  recordHubVisitOncePerSession,
  subscribeHubVisitorTotal,
} from '../lib/hubVisitorStats';

/** 累計来場者数（トップ・配信モードOFF時のみ） */
export function useHubVisitorTotal(enabled: boolean) {
  const [hubVisitorTotal, setHubVisitorTotal] = useState<number>(() =>
    enabled ? hubVisitorTotalForDisplay(readLocalHubVisitorTotal()) : 0,
  );

  useLayoutEffect(() => {
    if (!enabled) return;

    void recordHubVisitOncePerSession().then((total) => {
      setHubVisitorTotal(hubVisitorTotalForDisplay(Math.max(total, readLocalHubVisitorTotal())));
    });

    return subscribeHubVisitorTotal((total) => {
      setHubVisitorTotal(hubVisitorTotalForDisplay(mergeHubVisitorTotals(total)));
    });
  }, [enabled]);

  if (!enabled) return undefined;
  return hubVisitorTotalForDisplay(Math.max(hubVisitorTotal, readLocalHubVisitorTotal()));
}
