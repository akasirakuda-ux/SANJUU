
export interface WordData {
  word: string;
  reading: string;
  meaning?: string;
}

export interface WordCategory {
  category: string;
  title?: string;
  emoji?: string;
  description?: string;
  source?: string;
  source_info?: string;
  words: (string | WordData)[];
  subCategories?: WordCategory[];
  // 将来の拡張用
  accessType?: 'free' | 'premium' | 'event';
  eventId?: string;
  isKanji?: boolean;
  isPremium?: boolean;
  price?: string;
}

export type LogType = 'BOOT_SEQUENCE' | 'TASK_REPORT' | 'SESSION_HALT' | 'CONFIG_CHANGE' | 'NETWORK_SYNC' | 'VERSION_UPDATE' | 'ADD_ON_ACTIVATED' | 'LIVE_REPORT';

export interface LogEntry {
  id: string;
  timestamp: string; // YYYY.MM.DD HH:mm:ss
  type: LogType;
  tag: string; // e.g. "SYSTEM", "SUCCESS", "PROCESS"
  message: string;
  emoji?: string;
  details?: {
    category?: string;
    difficulty?: number;
    foundCount?: number;
    totalCount?: number;
    duration?: string;
    mode?: string;
    lang?: string;
    points?: number;
    syncStatus?: 'local' | 'synced';
    views?: number;
    avgDuration?: string;
    maxConcurrent?: number;
    likes?: number;
    newSubs?: number;
    chats?: number;
    superChat?: number;
  };
}

export interface TradingCard {
  id: string;
  masterCardId: string; // サーバー側のマスターデータID
  name: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'event';
  acquiredAt: string;
  status: 'available' | 'pending_exchange' | 'locked'; // 交換中のロック状態などを管理
}

export interface UserCard {
  card_id: string;
  serial: string; // 7桁英数字。将来 API で発行
  type: string; // 参加賞・紹介・イベントなど
  created_at: string; // 付与日時
}

export interface AddOnModule {
  moduleId: string;
  title: string;
  type: 'KANJI_PUZZLE' | 'HIRAGANA_PUZZLE';
  version: string;
  categories: WordCategory[];
  activatedAt: string;
}

export interface UserAccount {
  user_id: string; // UUID。ユーザーを一意に識別する
  created_at: string; // 登録日時
  login_count: number; // 参加回数
  cards: UserCard[]; // 所持カード一覧
  totalPoints: number;
  inventory: TradingCard[];
  nickname?: string;
  userEmoji?: string;
  addOns: AddOnModule[];
  completedDates?: string[]; // YYYY-MM-DD
  specialDates?: string[]; // YYYY-MM-DD (Dates with 3+ clears)
  lastSyncAt?: string;
  lastLoginDate?: string; // YYYY-MM-DD
  isOwner?: boolean;
}

export interface MasterData {
  categories: WordCategory[];
}

export type ScreenType =
  | 'select'
  | 'game'
  | 'seat-selection'
  | 'quiet-room'
  | 'worlds-wish';

export interface Point {
  x: number;
  y: number;
}

export interface FoundWord {
  word: string;
  start: Point;
  end: Point;
  color: string;
  isHint?: boolean;
  userName?: string;
  /** みんなであそぶ協力などで回答者 UID を紐づける */
  playerId?: string;
}

export interface WordOccurrence {
  start: Point;
  end: Point;
}

export interface PlacedWord {
  word: string;
  occurrences: WordOccurrence[];
}

export interface Selection {
  start: Point | null;
  end: Point | null;
}

export interface GameState {
  grid: string[][];
  difficulty: number;
  category: WordCategory | null;
  placedWords: PlacedWord[];
  foundWords: FoundWord[];
  sessionId?: string; // みんなであそぶ協力等のマルチプレイ識別用
  actualSeed?: number;
  isKatakana?: boolean;
  gameMode?: 'normal' | 'search';
  targetWord?: string;
  /** 検索モードの制限時間（秒）。みんなであそぶ協力では `useGame` が hundred_rooms の値を正規化（旧 0 は既定秒へ） */
  searchTimeLimitSec?: number;
}
