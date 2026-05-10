'use client';

import { useEffect, useState } from 'react';

export type StableConnectedUiOpts = {
  /** 接続表示に切り替えるまで `connected===true` が続く時間（すぐ閉じる OPEN を無視） */
  showAfterMs?: number;
  /** 試行中表示に戻すまで `connected===false` が続く時間 */
  hideAfterMs?: number;
};

/**
 * 文言・オーバーレイ用。生の `connected` はボタンの disabled などにそのまま使う。
 * 両端を遅延させ、短周期の open/close でも「接続済み」「試行中」が交互に出ないようにする。
 */
export function useStableConnectedUi(connected: boolean, opts?: StableConnectedUiOpts) {
  const showAfterMs = opts?.showAfterMs ?? 260;
  const hideAfterMs = opts?.hideAfterMs ?? 780;

  const [steady, setSteady] = useState(false);

  useEffect(() => {
    let showT: number | undefined;
    let hideT: number | undefined;

    const clear = () => {
      if (showT !== undefined) window.clearTimeout(showT);
      if (hideT !== undefined) window.clearTimeout(hideT);
      showT = undefined;
      hideT = undefined;
    };

    clear();

    if (connected) {
      showT = window.setTimeout(() => setSteady(true), showAfterMs);
    } else {
      hideT = window.setTimeout(() => setSteady(false), hideAfterMs);
    }

    return clear;
  }, [connected, showAfterMs, hideAfterMs]);

  return steady;
}
