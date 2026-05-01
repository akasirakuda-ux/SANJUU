import type { FirestoreTimeInput } from '../../lib/firestoreTime';

export interface ActiveUser {
  uid: string;
  name: string;
  emoji: string;
  lastActive: any;
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
  /** 管理者ピン留め（30 日自動削除の対象外） */
  pinned?: boolean;
  /** 管理者による論理削除（`deleted`）／通報非表示（`blocked`） */
  status?: string;
  deletedByAdmin?: boolean;
  blockedByAdmin?: boolean;
  /** 管理者からの返信（renraku_private のみ） */
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
  };
}

export interface BlockedUser {
  id: string;
  userName: string;
  blockedAt: any;
}

export type BulkBlockAuthorPostsHandler = (authorUid: string, authorName?: string) => void | Promise<void>;

/**
 * 募集の掲載時間（5・10・15 分＝300・600・900 秒）。`recruitDeadlineAt` のオフセットに使う。
 */
export type HundredRecruitDurationSec = 300 | 600 | 900;

/** @deprecated 意味は {@link HundredRecruitDurationSec}（募集時間） */
export type HundredGameTimeLimitSec = HundredRecruitDurationSec;

export interface HundredPublicRecruit {
  id: string;
  targetWord: string;
  boardSize: number;
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
};

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
  | 'hundred-create'
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
