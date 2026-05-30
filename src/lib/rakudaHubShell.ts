/**
 * ## らくだ珈琲ハブ契約（プロダクトの北）
 *
 * - **単一の入り口**: **らくだ珈琲が全ての入り口**。利用者の起点は常に **らくだ珈琲**（`https://rakuda.coffee` 体系）。ミニゲーム・三十・掲示はここから分岐する。
 *   **公開 URL は周知済みのため変えない**（`RAKUDA_CANONICAL_ORIGIN` / `rakudaCommunityBulletinUrl` 等の正は `sanjuuWebOrigin.ts`）。
 * - **低メモリ端末**: 利用デバイスは **約 3GB RAM** 級を想定。重い画面は遅延読み込み・チャンク分割を優先し、ハブは軽く保つ（`AppRouter` の lazy と揃える）。
 * - **シェルに集約するもの**: **共通のことはらくだ珈琲にまとめる** — ゲームに出す **絵文字・ニックネーム**、**しゅっせき簿**、**基本 UI の見た目**（`--rk-*` / Tailwind の `rk` 系）、連絡帳まわり。**個別ミニゲームは「遊び」に専念**し、表示名やトーンはシェルから受け取る。
 * - **規模・楽しさ**: **ひとり**でも **大人数**でも遊べるゲームを増やし、**楽しんでもらう**ことを前提にする（同期・ルームはゲーム側、プロフィールの受け渡しはシェル経由）。
 *
 * ### 新しい「らくだ内ミニゲーム / 没入画面」を足すとき（チェックリスト）
 *
 * 1. `src/types.ts` の `ScreenType` に ID を追加する。
 * 2. `src/lib/rakudaScreenRegistry.ts` に **同じキーで 1 行**追加する（没入・広告・履歴フラグ）。
 * 3. `src/components/AppRouter.tsx` に **描画分岐**と遷移（必要なら `history.pushState`）を足す。
 * 4. `useAppShell` / `GlobalOverlays` で干渉がないか確認する（没入・広告は **本ファイルから import した** `closesGlobalOverlays` 等と `immersiveScreenPolicy` 先頭コメント）。
 *
 * ### スタンプ・出席（しゅっせき）
 *
 * UI は {@link StampCard}、ログからの再計算は `computeStampsFromLogs` / `migrateStampArrays`（実装体は `stampMigration.ts`、**import は本ファイル経由**で揃える）。
 * `UserAccount` 上のフィールド型は {@link RakudaShussekiState}。シェル側の実行箇所は `useAppShell` のマイグレーション effect。
 *
 * ### 基本 UI 色（`index.css` の `--rk-*`）
 *
 * canvas / QR 等で CSS 変数を直接読めないときは {@link rkCssColor}、代表色は {@link rkResolvedAccentPrimary} など（実装は `rkTheme.ts`）。
 *
 * ### 没入・グローバル UI（オーバーレイ／広告帯）
 *
 * 実装は `immersiveScreenPolicy.ts`。**import は本ファイル経由**（`closesGlobalOverlays`・`suppressesQuietImmersiveGlobalChrome` 等）。
 *
 * 三十・別オリジンの遊びへ **プロフィールを渡す** ときは {@link appendRakudaProfileQuery} / {@link hasCompleteRakudaHandoffProfile} を使う（クエリ規約の一箇所化）。
 *
 * ### Firestore 日時・募集締切（`firestoreTime.ts`）
 *
 * `firestoreLikeToMillis` / `formatFirestoreTimeJa` / `hundredDisplayDeadlineMs` / `RENRAKU_RECRUIT_TTL_MS` 等。**利用側（画面・hook）の import は本ファイル経由**。（低層モジュールや自己検証は `firestoreTime.ts` 直読み可。）
 *
 * ### 連絡帳・投稿バリデーション
 *
 * `RENRAKU_VALIDATION_ERROR_MESSAGE` / `validateRenrakuPost` 等は `renrakuContentValidation.ts`。**利用側の import は本ファイル経由**。（`renrakuContentValidation` 自身は循環回避のため `rakudaDisplayNamePolicy` を直接読み、hub 経由にはしない。）
 *
 * ### 全面広告（インタースティシャル）の間隔
 *
 * `INTERSTITIAL_ARM_MS` 等は `interstitialPolicy.ts`。**import は本ファイル経由**。
 *
 * ### Google ログイン・リダイレクト復帰
 *
 * `waitForGoogleSessionRestore` / `consumeGoogleRedirectResult` 等は `authRedirectBootstrap.ts`。**import は本ファイル経由**。
 *
 * ### ログイン状態の表示文言（右上バッジなど）
 *
 * `getAuthLoginDisplay` は `authLoginDisplay.ts`。**import は本ファイル経由**。
 *
 * ### シェル全体トースト
 *
 * `SHOW_TOAST` 経由の `showAppToast` は `appToast.ts`。**import は本ファイル経由**。
 *
 * ### 連絡帳・管理者・表示可否
 *
 * `isRenrakuAdmin` / `isRenrakuEntryVisible` / `RENRAKU_STATUS_*` 等はそれぞれ `renrakuAdmin.ts`・`renrakuVisibility.ts`。**利用側の import は本ファイル経由**。
 *
 * ### 連絡帳・非公開伝言・掲示 TTL（シェル配下の連絡機能）
 *
 * `resolveRenrakuPrivateReplyText` / `renrakuPrivateReplyRef` / `RENRAKU_PRIVATE_INBOX_RAKUDA` / `fetchRenrakuPrivateForAdmin` / `cleanupStalePublicMessages` / `renrakuPrivateModerationBadge` 等。**画面・hook の import は本ファイル経由**。
 * （低層モジュールが hub を読むと循環するため、`renrakuAdminPrivateFetch` 等の **実装ファイル**は `renrakuAdmin` / `renrakuVisibility` を直接 import する。）
 */

import type { UserAccount } from '../types';

export const RAKUDA_TARGET_DEVICE_RAM_GB = 3 as const;

/** `UserAccount` のうちしゅっせき簿が載せる部分（YYYY-MM-DD） */
export type RakudaShussekiState = Pick<UserAccount, 'completedDates' | 'specialDates' | 'dailyClearCounts'>;

export type RakudaHandoffProfile = {
  emoji?: string;
  nickname?: string;
};

/** 三十などへ `rkEmoji` / `rkNick` を付与できるか（両方そろっているか） */
export function hasCompleteRakudaHandoffProfile(opts: RakudaHandoffProfile): boolean {
  const emoji = String(opts.emoji ?? '').trim();
  const nick = String(opts.nickname ?? '').trim();
  return !!(emoji && nick);
}

// --- シェルまわりでよく使う参照（ミニゲーム／別画面から import する窓口） ---
export {
  RAKUDA_CANONICAL_ORIGIN,
  RAKUDA_HUNDRED_CREATE_FRAGMENT,
  appendRakudaProfileQuery,
  rakudaCommunityBulletinUrl,
  rakudaHundredHubCreateUrl,
  sanjuuBulletinBoardUrl,
  sanjuuHttpApiOrigin,
  sanjuuRecruitBoardUrlWithRakudaProfile,
  sanjuuTopUrlWithRakudaProfile,
  sanjuuWebOrigin,
} from './sanjuuWebOrigin';

export { RAKUDA_SCREEN_REGISTRY, getRakudaScreenMeta, screensMatching, type RakudaScreenMeta } from './rakudaScreenRegistry';
export type { QuietImmersiveHistoryKind } from './rakudaScreenRegistry';

export type { ScreenType } from '../types';

/** しゅっせき簿モーダル（`GlobalOverlays` からもここ経由で import 可） */
export { default as StampCard } from '../components/StampCard';

export {
  computeStampsFromLogs,
  migrateStampArrays,
  type StampMigrationResult,
} from './stampMigration';

export {
  getDayClearCount,
  getTotalStampCount,
  isSpecialStampDay,
  recordShussekiGamePlay,
  recordSlidePuzzleDailyClear,
} from './shussekiDailyClears';

/** ニックのなりすまし防止（連絡帳・表示名まわりのシェル判定） */
export { rakudaNicknameImpersonationMessage } from './rakudaDisplayNamePolicy';

/** `:root` の `--rk-*` を実行時に解決（canvas / QR 等） */
export {
  rkBandColorCount,
  rkCssColor,
  rkResolvedAccentPrimary,
  rkResolvedBandColor,
  rkResolvedHubBark,
} from './rkTheme';

/** Firestore 経由日時の解釈・表示・募集締切（`firestoreTime.ts`） */
export {
  HUNDRED_GAME_TIME_FALLBACK_SEC,
  HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS,
  HUNDRED_RECRUIT_WINDOW_MS,
  RENRAKU_RECRUIT_TTL_MS,
  firestoreLikeToMillis,
  formatFirestoreTimeJa,
  hundredDisplayDeadlineMs,
  normalizeHundredGameTimeLimitSec,
  shouldHideFromPublicListAfterRecruitDeadlineGrace,
  shouldHideFromSanjuuRecruitBoard,
  shouldHideHundredPublicFromListAfterGrace,
  shouldHideHundredPublicFromListItem,
  type FirestoreTimeInput,
  type HundredRoomListMeta,
} from './firestoreTime';

/** 没入・オーバーレイ・広告抑止（`immersiveScreenPolicy.ts`）。新規画面追加時は `rakudaScreenRegistry` を先に更新 */
export {
  CLOSES_GLOBAL_OVERLAYS,
  HIDES_APP_HEADER,
  QUIET_IMMERSIVE_HISTORY_SCREENS,
  QUIET_IMMERSIVE_SCREENS,
  STOPS_HUB_BGM,
  SUPPRESSES_FIXED_BOTTOM_AD,
  SUPPRESSES_GLOBAL_OFFLINE_CHIP,
  SUPPRESSES_NETWORK_LATENCY_BUBBLES,
  closesGlobalOverlays,
  suppressesFixedBottomAd,
  suppressesNetworkLatencyBubbles,
  suppressesQuietImmersiveGlobalChrome,
  usesQuietImmersiveHistoryScreen,
} from './immersiveScreenPolicy';

/** シェル全体トースト（`appToast.ts`） */
export { showAppToast } from './appToast';

/** 右上ログイン表示（`authLoginDisplay.ts`） */
export { getAuthLoginDisplay, type AuthLoginDisplay, type AuthLoginTone } from './authLoginDisplay';

/** 連絡帳・管理者（`renrakuAdmin.ts`） */
export {
  ensureRenrakuAdminFirestoreAuth,
  isRenrakuAdmin,
  normalizeEmailForRenrakuAdmin,
} from './renrakuAdmin';

/** 連絡帳・タイムライン表示・管理者が書くフィールド（`renrakuVisibility.ts`） */
export {
  RENRAKU_STATUS_ACTIVE,
  RENRAKU_STATUS_BLOCKED,
  RENRAKU_STATUS_DELETED,
  isRenrakuEntryVisible,
  renrakuAdminBlockedFields,
  renrakuAdminSoftDeleteFields,
} from './renrakuVisibility';

/** 掲示・連絡帳のクライアント側投稿チェック（`renrakuContentValidation.ts`） */
export {
  RENRAKU_POST_CLIENT_VALIDATION_DISABLED,
  RENRAKU_VALIDATION_ERROR_MESSAGE,
  validateRenrakuPost,
} from './renrakuContentValidation';

/** 非公開伝言の返信ペイロード・表示解決（`renrakuPrivateReply.ts`） */
export {
  RENRAKU_PRIVATE_REPLY_DOC_ID,
  resolveRenrakuPrivateReplyText,
  type RenrakuPrivateReplyPayload,
} from './renrakuPrivateReply';

/** 非公開返信ドキュメント参照（`renrakuPrivateReplyRef.ts`） */
export { renrakuPrivateReplyRef } from './renrakuPrivateReplyRef';

/** 管理者向け非公開一覧取得（`renrakuAdminPrivateFetch.ts` … 実装は hub を import しない） */
export { fetchRenrakuPrivateForAdmin, type AdminPrivateFetchResult } from './renrakuAdminPrivateFetch';

/** らくだ管理者宛 inbox 定数・ソート（`renrakuPrivateInbox.ts`） */
export { RENRAKU_PRIVATE_INBOX_RAKUDA, sortRenrakuPrivateMessagesNewestFirst } from './renrakuPrivateInbox';

/** 非公開メッセージのモデレーション表示ラベル（`renrakuPrivateStatusBadge.ts` … 実装は `renrakuVisibility` 直） */
export { renrakuPrivateModerationBadge } from './renrakuPrivateStatusBadge';

/** 掲示 `public_messages` の古い投稿削除（連絡帳オープン時のバックグラウンド、`publicMessagesCleanup.ts`） */
export { cleanupStalePublicMessages, PUBLIC_MESSAGES_RETENTION_MS } from './publicMessagesCleanup';

/** 全面広告の表示間隔（`interstitialPolicy.ts`） */
export {
  INTERSTITIAL_ARM_MS,
  INTERSTITIAL_MIN_GAP_MS,
  RK_INTERSTITIAL_LAST_MS_KEY,
  readLastInterstitialDismissedMs,
  writeLastInterstitialDismissedMs,
} from './interstitialPolicy';

/** Google リダイレクト・セッション復帰（`authRedirectBootstrap.ts`） */
export {
  GOOGLE_LOGIN_PENDING_KEY,
  clearGoogleLoginPending,
  clearGoogleSessionUid,
  consumeGoogleRedirectResult,
  expectsGoogleSession,
  getGoogleSessionUid,
  isGoogleLoginPending,
  isGoogleSignedInUser,
  markGoogleLoginPending,
  markGoogleSessionUid,
  pickEffectiveAuthUser,
  waitForAnyGoogleUser,
  waitForGoogleSessionRestore,
} from './authRedirectBootstrap';
