/**
 * らくだ珈琲（単一ハブ）から遷移する全画面のメタ情報。
 * プロダクトの前提（3GB 級・共通プロフィール・単一入口）は **`rakudaHubShell.ts` モジュール先頭**に集約。
 * ミニゲームや没入画面を追加するときは **`ScreenType`（types.ts）を足したうえで、ここに1行追加**し、
 * `AppRouter` に描画分岐を足す。没入・広告・履歴はこの定義から `immersiveScreenPolicy` が導出する。
 */
import type { ScreenType } from '../types';

export interface RakudaScreenMeta {
  /** デバッグ・ドキュメント用の短い名前 */
  labelJa: string;
  /** `useAppShell`: 連絡帳・モーダル・通知等を没入入場時に片付ける */
  closesGlobalOverlays: boolean;
  /** `GlobalOverlays` / `AppLayout`: 下部固定広告バナーとその余白を抑止 */
  suppressesFixedBottomAd: boolean;
  /** しずか没入系: AppHeader 非表示・BGM 停止・静か系グローバル UI 抑止 など */
  quietImmersive: boolean;
  /** 同一 URL で `history.pushState` を積み、戻るでハブへ戻す（`AppRouter`） */
  usesQuietImmersiveHistory: boolean;
  /** `popstate` でハブへ戻った直後、しずかの間のイントロスキップだけリセットする */
  clearsQuietRoomSkipIntroOnPop: boolean;
}

export const RAKUDA_SCREEN_REGISTRY = {
  'seat-selection': {
    labelJa: 'ハブ（席）',
    closesGlobalOverlays: false,
    suppressesFixedBottomAd: true,
    quietImmersive: false,
    usesQuietImmersiveHistory: false,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  select: {
    labelJa: 'ことば探し・選択',
    closesGlobalOverlays: false,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: false,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  game: {
    labelJa: 'ことば探し・プレイ',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: false,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  'quiet-room': {
    labelJa: 'しずかの間',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: true,
    quietImmersive: true,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: true,
  },
  'slide-puzzle': {
    labelJa: 'スライドパズル',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  othello: {
    labelJa: 'リバーシ',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  gomoku: {
    labelJa: '五目並べ',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  'relay-story': {
    labelJa: '連続小説',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  'tile-match': {
    labelJa: 'ペア探し',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  sudoku: {
    labelJa: '9×9数字パズル',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: false,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
  'ouen-note': {
    labelJa: '聞いてほしいノート',
    closesGlobalOverlays: true,
    suppressesFixedBottomAd: true,
    quietImmersive: false,
    usesQuietImmersiveHistory: true,
    clearsQuietRoomSkipIntroOnPop: false,
  },
} as const satisfies Record<ScreenType, RakudaScreenMeta>;

/** `usesQuietImmersiveHistory === true` の画面（`history.state.rk` と対応） */
export type QuietImmersiveHistoryKind = {
  [K in ScreenType]: (typeof RAKUDA_SCREEN_REGISTRY)[K]['usesQuietImmersiveHistory'] extends true
    ? K
    : never;
}[ScreenType];

export function getRakudaScreenMeta(screen: ScreenType): RakudaScreenMeta {
  return RAKUDA_SCREEN_REGISTRY[screen];
}

export function screensMatching(pred: (m: RakudaScreenMeta) => boolean): ReadonlySet<ScreenType> {
  return new Set(
    (Object.keys(RAKUDA_SCREEN_REGISTRY) as ScreenType[]).filter((id) => pred(RAKUDA_SCREEN_REGISTRY[id]))
  );
}
