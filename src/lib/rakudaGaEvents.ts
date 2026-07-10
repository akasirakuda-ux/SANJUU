/**
 * GA4 カスタムイベント — トップメニュー・画面の利用状況
 *
 * Analytics での見方（例）:
 * - レポート → エンゲージメント → キーイベント → `rakuda_key_kotoba` / `rakuda_key_hundred_recruit`
 * - レポート → エンゲージメント → イベント → `rakuda_hub_menu` → `menu_id` で内訳
 * - 同 `rakuda_screen` → `screen_id` で SPA 画面の遷移回数
 *
 * キーイベント登録（GA4 管理画面・初回1回）:
 * 管理 → データの表示 → キーイベント → 新しいキーイベント
 * → イベント名 `rakuda_key_kotoba` / `rakuda_key_hundred_recruit` を追加
 */
import { sendGaEvent } from './initGa';
import type { ScreenType } from '../types';
import { getRakudaScreenMeta } from './rakudaScreenRegistry';

/** トップ（席選択）メニューの ID — `menu_id` パラメータにそのまま入る */
export type RakudaHubMenuId =
  | 'kotoba'
  | 'hundred_recruit'
  | 'keijiban'
  | 'reversi'
  | 'gomoku'
  | 'relay_story'
  | 'slide_puzzle'
  | 'sudoku'
  | 'tile_match_recruit'
  | 'quiet_room'
  | 'stamp_card'
  | 'settings'
  | 'guide'
  | 'note';

/** GA4「キーイベント」に登録するイベント名（0358 アカウント） */
export const RAKUDA_GA4_KEY_EVENT_NAMES = {
  kotoba: 'rakuda_key_kotoba',
  hundredRecruit: 'rakuda_key_hundred_recruit',
} as const;

const HUB_MENU_KEY_EVENTS: Partial<Record<RakudaHubMenuId, string>> = {
  kotoba: RAKUDA_GA4_KEY_EVENT_NAMES.kotoba,
  hundred_recruit: RAKUDA_GA4_KEY_EVENT_NAMES.hundredRecruit,
};

export function trackRakudaHubMenu(menuId: RakudaHubMenuId): void {
  sendGaEvent('rakuda_hub_menu', { menu_id: menuId });
  const keyEventName = HUB_MENU_KEY_EVENTS[menuId];
  if (keyEventName) {
    sendGaEvent(keyEventName, { menu_id: menuId, key_event: true });
  }
}

export function trackRakudaScreen(screen: ScreenType): void {
  const meta = getRakudaScreenMeta(screen);
  sendGaEvent('rakuda_screen', {
    screen_id: screen,
    screen_label: meta.labelJa,
  });
}
