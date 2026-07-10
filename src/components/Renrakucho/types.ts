import type { FirestoreTimeInput } from '../../lib/firestoreTime';

export interface ActiveUser {
  uid: string;
  name: string;
  emoji: string;
  lastActive: any;
  /** らくだにいるが盤面・掲示板は見ていない（食事など） */
  onBreak?: boolean;
  /** 自分から「一緒に遊ぶ？」合図（手動・30分） */
  playInvite?: boolean;
  /** 緑ゲート有効期限（ミリ秒・在席 heartbeat で同期） */
  greenUntilMs?: number | null;
}

export interface Message {
  id: string;
  message: string;
  fromUser: string;
  /** 掲示板（public_messages）投稿者の絵文字 */
  fromUserEmoji?: string;
  fromUserUid?: string;
  createdAt: any;
  isRead?: boolean;
  /** 募集は renraku_public、コミュニティ掲示は public_messages、非公開は renraku_private（管理者タイムラインのみ） */
  type?: 'recruit' | 'community' | 'private';
  /** 掲示板投稿種別: announcement=らくだ連絡 / chat=みんなの会話（未指定は chat） */
  postKind?: 'announcement' | 'chat';
  /** 管理者ピン留め（30 日自動削除の対象外） */
  pinned?: boolean;
  /** 管理者による論理削除（`deleted`）／通報非表示（`blocked`） */
  status?: string;
  deletedByAdmin?: boolean;
  blockedByAdmin?: boolean;
  /** 管理者から返信済み（本文は private_reply サブコレクション） */
  hasReply?: boolean;
  /** @deprecated 旧データ互換。新規返信は private_reply のみに保存 */
  replyMessage?: string;
  /** @deprecated 旧: らくだからの贈り物（一文字絵文字）。互換のため残す */
  replyEmoji?: string;
  /** 返信を保存した時刻（renraku_private のみ） */
  replyAt?: any;
  roomInfo?: {
    category: string;
    difficulty: string;
    targetWord?: string;
    url: string;
    /** ことば探し以外の対戦募集（リバーシ・五目並べ） */
    game?: 'reversi' | 'gomoku';
    roomCode?: string;
  };
}

export interface BlockedUser {
  id: string;
  userName: string;
  blockedAt: any;
}

export type BulkBlockAuthorPostsHandler = (authorUid: string, authorName?: string) => void | Promise<void>;

/**
 * 募集の掲載時間（0・5・10・15 分）。0 は最短の募集枠用。`recruitDeadlineAt` のオフセットに使う。
 */
export type HundredRecruitDurationSec = 0 | 300 | 600 | 900;

/** @deprecated 意味は {@link HundredRecruitDurationSec}（募集時間） */
export type HundredGameTimeLimitSec = HundredRecruitDurationSec;

/** みんなであそぶのゲーム種別（未指定はひと言探し pickup） */
export type HundredPlayMode = 'pickup' | 'tile_match';

/** ひと言探しの文字種（未指定は hiragana） */
export type PickupCharset = 'hiragana' | 'digit' | 'latin' | 'emoji';

export interface HundredPublicRecruit {
  id: string;
  targetWord: string;
  /** pickup（既定）または tile_match（ペア探し） */
  hundredMode?: HundredPlayMode;
  /** ひと言探し: hiragana | digit | latin | emoji */
  pickupCharset?: PickupCharset;
  /** ペア探しの難易度 */
  tileMatchDifficulty?: 'easy' | 'normal' | 'hard';
  /** 列数（後方互換: 正方形のみのとき boardRows 省略可） */
  boardSize: number;
  boardCols?: number;
  boardRows?: number;
  createdAt: any;
  type: 'hundred';
  roomId?: string;
  hostUid?: string;
  /** 募集主の表示名（hundred_public / hundred_rooms に保存） */
  hostNickname?: string;
  /** 募集主の絵文字（hundred_public / hundred_rooms に保存） */
  hostEmoji?: string;
  /**
   * 募集締切（通常は作成から5分。Firestore Timestamp）。
   * 一覧の「締切のさらに5分後」非表示は `PublicScreen` でこのフィールドのみ参照し、未定義のときは非表示ルールをかけない。
   */
  recruitDeadlineAt?: FirestoreTimeInput;
  /**
   * プレイ時間（秒）。新規募集は 0（制限なし）。旧データのみ正の値がありうる。`normalizeHundredGameTimeLimitSec`。
   */
  gameTimeLimitSec?: number;
  /** ひと言探し: 盤面のヒントボタンを許可するか（未設定は true） */
  hintsEnabled?: boolean;
  /** 🤖 らくだロボ常設ひと言探し（募集を消さない） */
  roboPickupLounge?: boolean;
}

/** 一覧用: hundred_rooms のライブ状態（roomId →） */
export type HundredRoomListMeta = {
  status: string;
  playerCount?: number;
  recruitDeadlineAt?: FirestoreTimeInput;
  hostNickname?: string;
  hostEmoji?: string;
  /** プレイ時間（秒）。0 = 制限なし。正規化は `normalizeHundredGameTimeLimitSec` */
  gameTimeLimitSec?: number;
  endReason?: string;
  /** 現行お題の開始（ロボ常設） */
  startedAt?: FirestoreTimeInput;
};

/** 管理者の伝言受信箱の読み込み状態 */
export type AdminPrivateInboxLoadState = 'idle' | 'loading' | 'ok' | 'denied' | 'error';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type RenrakuchoPublicScreenState =
  | 'list'
  | 'closed'
  | 'hundred-detail'
  | 'hundred-wait'
  | 'hundred-board';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}
