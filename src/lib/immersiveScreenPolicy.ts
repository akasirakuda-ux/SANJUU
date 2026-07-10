/**
 * 没入・ハブ周りの判定は **`rakudaScreenRegistry.ts` の1表**から導出する。
 * 新しい全面オーバーレイ／静か没入ミニゲームを足すときは、先にレジストリと `ScreenType` を更新し、
 * このモジュール・`useAppShell`・`GlobalOverlays`・`AppLayout`・`AppHeader`・`NetworkStatusHandler`・`AppRouter` を確認する。
 *
 * - **CLOSES_GLOBAL_OVERLAYS** … `useAppShell` が連絡帳・各モーダル・ヒント・通知・全面広告（静か没入時）などを整理
 * - **SUPPRESSES_FIXED_BOTTOM_AD** … 旧: 固定バナー用。現在はバナー未使用だがレジストリの `suppressesFixedBottomAd` と整合のため維持
 * - **QUIET_IMMERSIVE_SCREENS** … AppHeader 非表示・BGM 停止・静か系グローバル UI
 * - **QUIET_IMMERSIVE_HISTORY_SCREENS** / **`QuietImmersiveHistoryKind`** … `AppRouter` の `pushState` / `popstate`
 *
 * **`select` / `game` 全体の履歴スタックは未対応**（意図的）。運用メモは `SANJUU/web/docs/rakuda-ui-spine.md` §5。プロダクトの北は **`rakudaHubShell.ts`**。
 */

import type { ScreenType } from '../types';
import {
  RAKUDA_SCREEN_REGISTRY,
  screensMatching,
  type QuietImmersiveHistoryKind,
} from './rakudaScreenRegistry';

export type { QuietImmersiveHistoryKind };

if (import.meta.env.DEV) {
  for (const id of Object.keys(RAKUDA_SCREEN_REGISTRY) as ScreenType[]) {
    const m = RAKUDA_SCREEN_REGISTRY[id];
    if (m.usesQuietImmersiveHistory && !m.quietImmersive) {
      // eslint-disable-next-line no-console
      console.warn('[rakuda] usesQuietImmersiveHistory は quietImmersive と併用してください:', id);
    }
  }
}

export const CLOSES_GLOBAL_OVERLAYS: ReadonlySet<ScreenType> = screensMatching(
  (m) => m.closesGlobalOverlays
);

export const SUPPRESSES_FIXED_BOTTOM_AD: ReadonlySet<ScreenType> = screensMatching(
  (m) => m.suppressesFixedBottomAd
);

export const QUIET_IMMERSIVE_SCREENS: ReadonlySet<ScreenType> = screensMatching(
  (m) => m.quietImmersive
);

/** `history.state.rk` を載せる画面（ブラウザ戻るでハブ） */
export const QUIET_IMMERSIVE_HISTORY_SCREENS: ReadonlySet<ScreenType> = screensMatching(
  (m) => m.usesQuietImmersiveHistory
);

export const HIDES_APP_HEADER = QUIET_IMMERSIVE_SCREENS;
export const STOPS_HUB_BGM = QUIET_IMMERSIVE_SCREENS;
export const SUPPRESSES_NETWORK_LATENCY_BUBBLES = QUIET_IMMERSIVE_SCREENS;
export const SUPPRESSES_GLOBAL_OFFLINE_CHIP = QUIET_IMMERSIVE_SCREENS;

export function closesGlobalOverlays(screen: string): boolean {
  return CLOSES_GLOBAL_OVERLAYS.has(screen as ScreenType);
}

export function suppressesFixedBottomAd(screen: string): boolean {
  return SUPPRESSES_FIXED_BOTTOM_AD.has(screen as ScreenType);
}

export function suppressesQuietImmersiveGlobalChrome(screen: string): boolean {
  return QUIET_IMMERSIVE_SCREENS.has(screen as ScreenType);
}

export function suppressesNetworkLatencyBubbles(screen: string): boolean {
  return suppressesQuietImmersiveGlobalChrome(screen);
}

export function usesQuietImmersiveHistoryScreen(screen: string): boolean {
  return QUIET_IMMERSIVE_HISTORY_SCREENS.has(screen as ScreenType);
}
