/**
 * Timestamp / Date / number / クライアント独自オブジェクトなど、Firestore 経由で揺れうる入力。
 * `hundred_public` など募集ドキュメントに `recruitDeadlineAt` を追加する場合もこの別名で型付けすると一覧非表示ロジックを共通化しやすい。
 */
export type FirestoreTimeInput = unknown;

/**
 * Firestore の Timestamp 相当・互換オブジェクト・Date・ミリ秒数 を統一してミリ秒にする。
 * 読み取り専用データが Timestamp / 素の { seconds } などに揺れても一覧ロジックを安定させる。
 */
export function firestoreLikeToMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object') {
    const v = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof v.toMillis === 'function') {
      const m = v.toMillis();
      return typeof m === 'number' && Number.isFinite(m) ? m : null;
    }
    if (typeof v.toDate === 'function') {
      const d = v.toDate();
      if (!(d instanceof Date)) return null;
      const t = d.getTime();
      return Number.isNaN(t) ? null : t;
    }
    const secRaw =
      typeof v.seconds === 'number' && Number.isFinite(v.seconds)
        ? v.seconds
        : typeof (v as { _seconds?: number })._seconds === 'number' &&
            Number.isFinite((v as { _seconds: number })._seconds)
          ? (v as { _seconds: number })._seconds
          : null;
    if (secRaw != null) {
      const nanosKey = v as { nanoseconds?: number; _nanoseconds?: number };
      const ns =
        typeof nanosKey.nanoseconds === 'number' && Number.isFinite(nanosKey.nanoseconds)
          ? nanosKey.nanoseconds
          : typeof nanosKey._nanoseconds === 'number' && Number.isFinite(nanosKey._nanoseconds)
            ? nanosKey._nanoseconds
            : 0;
      return secRaw * 1000 + Math.floor(ns / 1_000_000);
    }
  }
  return null;
}

/**
 * UI 表示用。解釈できない場合は `'—'`。
 * `createdAt` など任意フィールドの日時表示に使う（`toDate()` に直接依存しない）。
 */
export function formatFirestoreTimeJa(
  value: FirestoreTimeInput,
  options?: Intl.DateTimeFormatOptions
): string {
  const ms = firestoreLikeToMillis(value);
  if (ms == null) return '—';
  return new Date(ms).toLocaleString('ja-JP', options);
}

/** 募集の標準所要時間（作成時の recruitDeadlineAt オフセット・createdAt からの仮締切にも使用）。`HundredCreate` と同値。 */
export const HUNDRED_RECRUIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * 連絡帳 `renraku_public` の recruit 行の「作成からの有効/表示」と同じ 5 分。
 * 数値は {@link HUNDRED_RECRUIT_WINDOW_MS} と同じ（意味だけ分ける）。
 */
export const RENRAKU_RECRUIT_TTL_MS = HUNDRED_RECRUIT_WINDOW_MS;

/** 旧データ互換用。プレイ時間は制限しない方針のため、一覧メタでは 0 をそのまま保持する。 */
export const HUNDRED_GAME_TIME_FALLBACK_SEC = 300;

/**
 * `hundred_public` / `hundred_rooms` の `gameTimeLimitSec` を読み取り用に正規化する。
 * - 新仕様: 0 = プレイに時間制限なし（募集の長さは `recruitDeadlineAt`）。
 * - 旧データで正の値が入っている場合はそのまま返す（プレイ用タイマーはクライアントで使わない）。
 * - undefined / 非数 / 負数 → 0
 */
export function normalizeHundredGameTimeLimitSec(sec: unknown): number {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) {
    return 0;
  }
  return sec;
}

/** hundred_public 一覧: recruitDeadlineAt からこの時間を過ぎたらカードを出さない（DB は残す） */
export const HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS = 5 * 60 * 1000;

/**
 * カード・一覧ソート・タイマー表示で共通: 「募集が締まる」表示用の時刻（ミリ秒）。
 *
 * 優先順位（※ createdAt ファーストではない）:
 * 1. `hundred_rooms` の `recruitDeadlineAt`（room が最優先でライブ状態に追随）
 * 2. `hundred_public` の `recruitDeadlineAt`
 * 3. どちらも解釈できなければ `createdAt + {@link HUNDRED_RECRUIT_WINDOW_MS}` から推定
 *
 * 一覧の「締切相当のさらに5分後で非表示」は {@link shouldHideHundredPublicFromListItem}（`recruitDeadlineAt` なし時は
 * `createdAt + {@link HUNDRED_RECRUIT_WINDOW_MS}` を締切相当にする。room メタは見ない）。
 */
export function hundredDisplayDeadlineMs(params: {
  roomRecruitDeadlineAt?: FirestoreTimeInput;
  itemRecruitDeadlineAt?: FirestoreTimeInput;
  itemCreatedAt?: FirestoreTimeInput;
}): number | null {
  const fromRoomOrItem = firestoreLikeToMillis(
    params.roomRecruitDeadlineAt ?? params.itemRecruitDeadlineAt
  );
  if (fromRoomOrItem != null) return fromRoomOrItem;
  const ca = firestoreLikeToMillis(params.itemCreatedAt);
  if (ca != null && ca > 0) return ca + HUNDRED_RECRUIT_WINDOW_MS;
  return null;
}

/**
 * 任意ドキュメントの `recruitDeadlineAt` のみを見て「締切のさらに5分後」で一覧から外すか。
 * `recruitDeadlineAt` が解釈できないときは false（フォールバックなし）。
 * hundred 一覧では {@link shouldHideHundredPublicFromListItem} を使うこと。
 */
export function shouldHideFromPublicListAfterRecruitDeadlineGrace(
  recruitDeadlineAt: FirestoreTimeInput,
  nowMs: number
): boolean {
  const deadlineMs = firestoreLikeToMillis(recruitDeadlineAt);
  if (deadlineMs == null) return false;
  return deadlineMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS < nowMs;
}

/** hundred 募集一覧の締切後グレース判定のエイリアス。一覧表示は {@link shouldHideHundredPublicFromListItem} を使うこと。 */
export const shouldHideHundredPublicFromListAfterGrace = shouldHideFromPublicListAfterRecruitDeadlineGrace;

/**
 * `hundred_public` 一覧の非表示判定。`recruitDeadlineAt` が欠損でも {@link hundredDisplayDeadlineMs} と同じ基準で
 * 「募集締切相当時刻」を求め、そこから {@link HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS} 経過後に一覧から外す。
 * （`hundred_rooms` は参照しない — hundred_public ドキュメントのフィールドのみ）
 */
export function shouldHideHundredPublicFromListItem(
  item: { recruitDeadlineAt?: FirestoreTimeInput; createdAt?: FirestoreTimeInput },
  nowMs: number
): boolean {
  const effectiveMs = hundredDisplayDeadlineMs({
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
  if (effectiveMs == null) return false;
  return effectiveMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS < nowMs;
}
