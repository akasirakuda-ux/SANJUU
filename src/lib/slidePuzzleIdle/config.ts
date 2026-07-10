import {
  SLIDE_PUZZLE_GRID_SIZE,
  SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT,
  type SlidePuzzleGridSize,
} from '../slidePuzzleLogic';

/** LocalStorage キー（放置セッション） — v2: 3×3 盤面のみ */
export const SLIDE_IDLE_SESSION_STORAGE_KEY = 'rakuda_slide_idle_session_v2';

export const SLIDE_IDLE_SESSION_VERSION = 2 as const;

/** 中断再開の有効期限（3時間） */
export const SLIDE_IDLE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;

/** 放置検知（本番 5分） */
export const SLIDE_IDLE_ARM_MS = 5 * 60 * 1000;

/** 自動モード移行前的カウントダウン */
export const SLIDE_IDLE_COUNTDOWN_MS = 3 * 1000;

/** 広告終了後の休憩（Google 規約 + 既存 interstitialPolicy と揃える） */
export const SLIDE_IDLE_AD_INTERVAL_MS = 60 * 1000;

/** 本番 / Debug で切り替える放置時間 */
export function getSlideIdleArmMs(): number {
  return import.meta.env.DEV ? 20_000 : SLIDE_IDLE_ARM_MS;
}

/** 本番 / Debug で切り替える広告間インターバル */
export function getSlideIdleAdIntervalMs(): number {
  return import.meta.env.DEV ? 15_000 : SLIDE_IDLE_AD_INTERVAL_MS;
}

export function getSlideIdleCountdownSeconds(): number {
  return Math.ceil(SLIDE_IDLE_COUNTDOWN_MS / 1000);
}

/** 自動スライドのアニメ待ち（SlidePuzzleGame と揃える） */
export const SLIDE_IDLE_SLIDE_ANIM_MS = 340;

/** タップ解放時の連続スライド間隔（ササッと感） */
export const SLIDE_IDLE_RELEASE_MOVE_MS = 280;

/** 広告1本ごとに +1 するが、盤面に溜められる上限 */
export const SLIDE_IDLE_MAX_PENDING_CREDITS = 10;

export const SLIDE_IDLE_GRID_SIZE: SlidePuzzleGridSize = SLIDE_PUZZLE_GRID_SIZE;

export const SLIDE_IDLE_SHUFFLE_MOVE_COUNT = SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT;
