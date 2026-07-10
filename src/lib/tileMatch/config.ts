/**
 * ペア探し（上海型・同じ記号2枚）。
 * ソロ・募集とも準備中ガードなし（`hubAccess.isTileMatchHubLive`）。
 * 設計メモ: `docs/tile-match-game-prep.md`
 */
import { HUNDRED_MAX_PLAYERS } from '../hundredRoomCapacity';

/** 画面・ScreenType 用（実装時に types / AppRouter へ追加） */
export const TILE_MATCH_SCREEN_ID = 'tile-match' as const;

/** Firestore hundred_rooms.hundredMode */
export const TILE_MATCH_HUNDRED_MODE = 'tile_match' as const;

/** みんなであそぶ開始時の遷移オプション */
export type HundredStartOpts = {
  hundredMode?: typeof TILE_MATCH_HUNDRED_MODE | 'pickup' | string;
  /** 待機室で既に読んでいる盤面（再 getDoc ポーリングを省略） */
  preloadedGrid?: string[][];
  preloadedWords?: unknown[];
};

/** 画面・メニュー表示名（確定） */
export const TILE_MATCH_LABEL_JA = 'ペア探し';

/** 席メニュー・募集などの表示用 */
export const TILE_MATCH_EMOJI = '🃏';

/** 連絡帳「ペア探しの問題を作る」フォームへ（例: `/hundred#rk-tile-match-create`） */
export const RAKUDA_TILE_MATCH_CREATE_FRAGMENT = 'rk-tile-match-create';

/** 共同プレイはひと言探しと同じ上限 */
export const TILE_MATCH_MAX_PLAYERS = HUNDRED_MAX_PLAYERS;

/** 上海標準（亀レイアウト） */
export const TILE_MATCH_CLASSIC_TILE_COUNT = 144;

/** 難易度：48 / 96 / 144（確定） */
export const TILE_MATCH_DIFFICULTY_TILE_COUNTS = {
  easy: 48,
  normal: 96,
  hard: 144,
} as const;

export type TileMatchDifficultyId = keyof typeof TILE_MATCH_DIFFICULTY_TILE_COUNTS;

export const TILE_MATCH_DIFFICULTY_LABELS_JA: Record<TileMatchDifficultyId, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
};

/** 1局あたりのヒント回数 */
export const TILE_MATCH_HINT_LIMIT = 3;

/** 1局あたりの一手戻し回数（誤タップ救済。無制限は採用しない） */
export const TILE_MATCH_UNDO_LIMIT = 5;

/** 牌の積み上げは最大3段（layer 0 = 下、1 = 中、2 = 上） */
export const TILE_MATCH_MAX_LAYER = 2;
