import type { RelayStoryKind } from './relayStoryConfig';

export type RelayStoryStatus = 'open' | 'complete';

export interface RelayStorySegment {
  kind: RelayStoryKind;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
  createdAtMs: number;
}

export interface RelayStory {
  id: string;
  title: string;
  status: RelayStoryStatus;
  /** 次に書く話の index（0=起 … 3=結）。完結時は 4 */
  currentStep: number;
  participantUids: string[];
  segments: RelayStorySegment[];
  createdAtMs: number;
  completedAtMs?: number;
  /** 読者レビュー件数（完結後） */
  reviewCount?: number;
  /** 読者レビューの★合計（平均 = ratingSum / reviewCount） */
  ratingSum?: number;
}

export interface RelayStoryReview {
  id: string;
  storyId: string;
  rating: number;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
  createdAtMs: number;
}
