import { HUNDRED_MAX_PLAYERS } from './hundredRoomCapacity';
import { isRoboPickupLoungeRecruit } from './roboPickupLoungeConfig';
import { isRoboLoungeRoundComplete } from './roboPickupLoungeFound';

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

/** 募集の標準所要時間（作成時の recruitDeadlineAt オフセット・createdAt からの仮締切にも使用）。 */
export const HUNDRED_RECRUIT_WINDOW_MS = 5 * 60 * 1000;

/** 募集締切なし（いつでも参加）の sentinel。ロボ常設と同じ遠い未来。 */
export const HUNDRED_OPEN_RECRUIT_DEADLINE_MS = Date.parse('2099-01-01T00:00:00+09:00');

/**
 * 締切なし募集 — 最後のお題が終わってから一覧に残す静けさ（配信内のお題間は短い想定）。
 * これを過ぎたら「おわり」とみなして非表示にする。
 */
export const HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS = 15 * 60 * 1000;

/** 一度も始まらなかった締切なし募集を一覧から外す */
export const HUNDRED_OPEN_RECRUIT_ABANDON_MS = 45 * 60 * 1000;

export function isHundredOpenRecruitDeadline(value: FirestoreTimeInput): boolean {
  const ms = firestoreLikeToMillis(value);
  if (ms == null) return false;
  return ms >= HUNDRED_OPEN_RECRUIT_DEADLINE_MS - 24 * 60 * 60 * 1000;
}

/** 募集締切なし（いつでも参加）— `hundred_public` または `hundred_rooms` のどちらか */
export function hundredRecruitHasOpenDeadline(
  item: { recruitDeadlineAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
): boolean {
  return (
    isHundredOpenRecruitDeadline(item.recruitDeadlineAt) ||
    isHundredOpenRecruitDeadline(room?.recruitDeadlineAt)
  );
}

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
 * プレイ中カードを募集一覧に残す時間（締切+{@link HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS} のあと）。
 * 途中参加用。DB が `playing` のままでも、この時間を過ぎたら一覧から外す。
 */
export const HUNDRED_IN_PLAY_BOARD_VISIBLE_MS = 3 * 60 * 60 * 1000;

/** 作成からこの時間を過ぎた `playing` は古いゴミとみなして非表示（締切欠損の保険） */
export const HUNDRED_IN_PLAY_MAX_STALE_FROM_CREATED_MS = 24 * 60 * 60 * 1000;

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

/** `hundred_rooms` 一覧メタ（三十募集一覧・ハブバッジと共有） */
export type HundredRoomListMeta = {
  status: string;
  playerCount?: number;
  recruitDeadlineAt?: FirestoreTimeInput;
  hostNickname?: string;
  hostEmoji?: string;
  gameTimeLimitSec?: number;
  hundredMode?: string;
  tileMatchDifficulty?: string;
  targetWord?: string;
  pickupCharset?: string;
  boardSize?: number;
  boardCols?: number;
  boardRows?: number;
  roboPickupLounge?: boolean;
  /** 現行お題の開始（ロボ常設の「お題開始」表示用） */
  startedAt?: FirestoreTimeInput;
  /** らくだロボ — お題クリア判定用（一覧非表示） */
  foundWords?: unknown;
  words?: unknown;
  placedWords?: unknown;
  problemsGenerating?: boolean;
  problemsReady?: boolean;
  /** gridRows の有無（words 未ロード時の盤面判定用） */
  gridRowsPresent?: boolean;
  endReason?: string;
  endedAt?: FirestoreTimeInput;
};

/** お題とお題のあいだ（締切なし・status recruiting・前局終了済み） */
export function isHundredBetweenRounds(room: HundredRoomListMeta | undefined): boolean {
  if (!room) return false;
  if ((room.status ?? 'recruiting') !== 'recruiting') return false;
  const er = room.endReason;
  return er === 'cleared' || er === 'timeout';
}

/**
 * お題終了処理の途中でホストが次のお題を始めたか。
 * 遅延した onHundredRoomFinished が次局の playing / hundred_public を上書きしないための判定。
 */
export function hasHundredAdvancedPastFinishRound(
  finishedRoundStartedAtMs: number | null,
  room: HundredRoomListMeta | undefined,
): boolean {
  if (!room) return false;
  if (room.problemsGenerating === true) return true;

  const st = room.status ?? '';
  if (st !== 'playing' && st !== 'started') return false;
  if (room.problemsReady !== true) return false;

  const freshStartedMs = firestoreLikeToMillis(room.startedAt);
  if (
    finishedRoundStartedAtMs != null &&
    freshStartedMs != null &&
    freshStartedMs > finishedRoundStartedAtMs
  ) {
    return true;
  }

  const foundLen = Array.isArray(room.foundWords) ? room.foundWords.length : 0;
  if (
    foundLen === 0 &&
    freshStartedMs != null &&
    finishedRoundStartedAtMs != null &&
    freshStartedMs > finishedRoundStartedAtMs
  ) {
    return true;
  }

  return false;
}

/** 一覧用 — プレイ中に盤面があるか（words 欠損・空配列の誤判定を避ける） */
function hundredRoomHasActiveBoard(room: HundredRoomListMeta | undefined): boolean {
  if (!room) return false;
  if (room.problemsReady === true) return true;
  if (room.gridRowsPresent === true) return true;
  const placedWords = room.words ?? room.placedWords;
  return Array.isArray(placedWords) && placedWords.length > 0;
}

/** プレイ中だが参加者がいない（クリア後に全員退室したゴミ募集） */
export function isHundredAbandonedPlayingRoom(
  room: HundredRoomListMeta | undefined,
  nowMs: number,
): boolean {
  if (!room || !isHundredRoomInPlay(room.status)) return false;
  // 盤面が載っているプレイ中は放置扱いにしない（お題切替後の playerCount 0 対策）
  if (hundredRoomHasActiveBoard(room)) return false;
  // playerCount 未同期のプレイ中を放置扱いにしない（一覧から消えないように）
  if (typeof room.playerCount !== 'number') return false;
  if (room.playerCount > 0) return false;
  const foundLen = Array.isArray(room.foundWords) ? room.foundWords.length : 0;
  // 正解が進んでいる局はプレイ中として一覧に残す
  if (foundLen > 0) return false;
  const startedAtMs = firestoreLikeToMillis(room.startedAt);
  if (startedAtMs == null) return false;
  return nowMs - startedAtMs >= 60_000;
}

/**
 * 締切なし募集が「継続中」ではなく「おわり」とみなすか。
 * プレイ中・生成中・お題間の短い待機は false（一覧に残す）。
 */
export function isHundredOpenRecruitSessionEnded(
  item: { createdAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
  nowMs: number,
): boolean {
  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return true;
  if (isHundredRoomInPlay(st)) {
    const placedWords = room?.words ?? room?.placedWords;
    const placedWordsKnown =
      room != null &&
      (room.words !== undefined ||
        room.placedWords !== undefined ||
        room.problemsReady === true ||
        room.gridRowsPresent === true);
    if (placedWordsKnown && room && isRoboLoungeRoundComplete(room.foundWords, placedWords)) {
      return true;
    }
    if (isHundredAbandonedPlayingRoom(room, nowMs)) {
      return true;
    }
    const startedAtMs = firestoreLikeToMillis(room?.startedAt);
    const hasBoard = hundredRoomHasActiveBoard(room);
    // 待機室など盤面フィールド未ロードのメタでは「盤面なし＝終了」にしない
    if (placedWordsKnown && !hasBoard && room?.problemsGenerating !== true) {
      return true;
    }
    if (startedAtMs != null && nowMs - startedAtMs >= HUNDRED_IN_PLAY_BOARD_VISIBLE_MS) {
      return true;
    }
    return false;
  }
  if (room?.problemsGenerating === true) return false;

  const endedAtMs = firestoreLikeToMillis(room?.endedAt);
  if (endedAtMs != null && nowMs - endedAtMs >= HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS) {
    return true;
  }

  const createdMs = firestoreLikeToMillis(item.createdAt);
  // お題間なのに endedAt 欠損（旧データ）→ createdAt 基準で消す
  if (endedAtMs == null && isHundredBetweenRounds(room)) {
    if (createdMs != null && nowMs - createdMs >= HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS) {
      return true;
    }
  }

  const startedAtMs = firestoreLikeToMillis(room?.startedAt);
  // recruiting なのに startedAt だけ残る → 最後開始からアイドル経過で消す
  if (
    endedAtMs == null &&
    st === 'recruiting' &&
    startedAtMs != null &&
    nowMs - startedAtMs >= HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS
  ) {
    return true;
  }

  if (
    endedAtMs == null &&
    startedAtMs == null &&
    !isHundredBetweenRounds(room) &&
    createdMs != null &&
    nowMs - createdMs >= HUNDRED_OPEN_RECRUIT_ABANDON_MS
  ) {
    return true;
  }

  return false;
}

/** ひと言探し等がプレイ中（途中参加可） */
export function isHundredRoomInPlay(status: string | undefined): boolean {
  return status === 'playing' || status === 'started';
}

/** 一覧表示用 — status 以外（盤面生成中・開始時刻）も「あそび中」扱い */
export function isHundredRoomInPlayOrStarting(room: HundredRoomListMeta | undefined): boolean {
  if (!room) return false;
  // お題とお題のあいだは「あそび中」にしない（startedAt 残骸で誤表示しない）
  if (isHundredBetweenRounds(room)) return false;
  const st = room.status ?? 'recruiting';
  if (st === 'recruiting') {
    return room.problemsGenerating === true;
  }
  if (isHundredRoomInPlay(st)) return true;
  if (room.problemsGenerating === true) return true;
  if (room.problemsReady === true) return true;
  if (room.startedAt != null) return true;
  const words = room.words ?? room.placedWords;
  if (Array.isArray(words) && words.length > 0) return true;
  return false;
}

/** プレイ中カードを一覧から外すか（締切+猶予+途中参加窓を過ぎたか） */
export function isHundredInPlayPastBoardVisibleWindow(
  item: { recruitDeadlineAt?: FirestoreTimeInput; createdAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
  nowMs: number
): boolean {
  const createdMs = firestoreLikeToMillis(item.createdAt);
  if (createdMs != null && nowMs > createdMs + HUNDRED_IN_PLAY_MAX_STALE_FROM_CREATED_MS) {
    return true;
  }
  const effectiveMs = hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: room?.recruitDeadlineAt,
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
  if (effectiveMs == null) return false;
  return (
    effectiveMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS + HUNDRED_IN_PLAY_BOARD_VISIBLE_MS < nowMs
  );
}

/** 募集一覧（三十・掲示板）でカードを出し続ける最長: 締切相当 + {@link HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS} */
export function isHundredRecruitPastBoardVisibleWindow(
  item: { recruitDeadlineAt?: FirestoreTimeInput; createdAt?: FirestoreTimeInput },
  room: HundredRoomListMeta | undefined,
  nowMs: number
): boolean {
  const effectiveMs = hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: room?.recruitDeadlineAt,
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
  if (effectiveMs == null) return false;
  return effectiveMs + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS < nowMs;
}

/**
 * 三十 `/sanjuu/recruit-board` と同じ非表示判定。
 * 終了・取消・満員・締切済み（未開始）・一覧グレース経過後は非表示。
 * **プレイ中**は **締切+猶予+3時間** まで一覧に残す（途中参加）。それ以降・作成24時間超は非表示（`finished` 未更新の古い部屋対策）。
 */
export type ShouldHideSanjuuRecruitBoardOptions = {
  /** roomId あり・getDoc 済み・`hundred_rooms` が無い（終了後に掲示だけ残った等） */
  roomDocMissing?: boolean;
};

export function shouldHideFromSanjuuRecruitBoard(
  item: {
    recruitDeadlineAt?: FirestoreTimeInput;
    createdAt?: FirestoreTimeInput;
    roomId?: string;
    roboPickupLounge?: boolean;
  },
  room: HundredRoomListMeta | undefined,
  nowMs: number,
  options?: ShouldHideSanjuuRecruitBoardOptions
): boolean {
  if (options?.roomDocMissing) return true;
  // 🤖 らくだロボ／絵文字ロボ（常設）は、クリア・準備中でも募集一覧から消さない。
  // 入室後の待機表示（作成中など）で吸収する。
  if (isRoboPickupLoungeRecruit(item)) return false;

  // room メタ未取得のあいだは出さない（終わった募集が一瞬出るのを防ぐ）。
  if (!room && (item.roomId || '').trim()) return true;

  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return true;

  // お題とお題のあいだ・ホスト開始前の控室: 一緒に遊べないので一覧に出さない。
  // 「参加＝いま盤面で一緒に遊べる席」だけを載せる（戻る導線は PublicScreen の再参加バナー）。
  if (isHundredBetweenRounds(room)) return true;
  if (!isHundredRoomInPlayOrStarting(room)) return true;

  // 全問クリア済み（status が playing のまま残った募集は一覧から外す。次局開始後は foundWords が空になり再表示）
  const placedWords = room?.words ?? room?.placedWords;
  if (room && isRoboLoungeRoundComplete(room.foundWords, placedWords)) {
    return true;
  }

  if (isHundredAbandonedPlayingRoom(room, nowMs)) {
    return true;
  }

  // playing だが盤面が無い（終了処理後に words だけ消えたゴミ）
  const foundLen = Array.isArray(room?.foundWords) ? room.foundWords.length : 0;
  if (
    room &&
    isHundredRoomInPlay(st) &&
    foundLen > 0 &&
    (!Array.isArray(placedWords) || placedWords.length === 0) &&
    room.problemsGenerating !== true
  ) {
    return true;
  }

  // いつでも参加（締切なし）: 放置で非表示。あそび中は途中参加可。
  if (hundredRecruitHasOpenDeadline(item, room)) {
    return isHundredOpenRecruitSessionEnded(item, room, nowMs);
  }

  return isHundredInPlayPastBoardVisibleWindow(item, room, nowMs);
}
