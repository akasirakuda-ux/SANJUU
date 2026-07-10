/** 連続小説 — 起承転結の4話で1本完結 */
export const RELAY_STORY_KINDS = ['起', '承', '転', '結'] as const;
export type RelayStoryKind = (typeof RELAY_STORY_KINDS)[number];

export const RELAY_STORY_STEP_COUNT = RELAY_STORY_KINDS.length;

/** 1話あたりの最大文字数。手書き・読み手・作者双方が目で追える浅さを優先（まず200で試す） */
export const RELAY_STORY_MAX_CHARS = 200;

/** UI用：起承転結それぞれの文字数ルール */
export const RELAY_STORY_CHAR_RULE_LABEL = `起・承・転・結、それぞれ${RELAY_STORY_MAX_CHARS}文字まで`;

/**
 * 投稿時の利用許諾（著作権の全面譲渡ではなく、商用利用を含む利用許諾）。
 * 子ども・保護者にも読める長さを優先。
 */
export const RELAY_STORY_POSTING_NOTICE =
  'ここに投稿した物語は、らくだ珈琲（運営：らくだ）がサイト内での表示・宣伝・配信・広告などの収益化に利用できるものとします。投稿をもって、この利用にご同意いただいたものとみなします。';

export const RELAY_STORY_COLLECTION = 'rk_relay_stories';

/** 読者レビュー本文の最大文字数 */
export const RELAY_STORY_REVIEW_MAX_CHARS = 300;

export function relayStoryAverageRating(reviewCount?: number, ratingSum?: number): number | null {
  const count = reviewCount ?? 0;
  const sum = ratingSum ?? 0;
  if (count <= 0 || sum <= 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

export function relayStoryRatingSummaryLabel(reviewCount?: number, ratingSum?: number): string | null {
  const avg = relayStoryAverageRating(reviewCount, ratingSum);
  if (avg == null) return null;
  const count = reviewCount ?? 0;
  return `★${avg}（${count}件）`;
}

export function relayStoryKindAtStep(stepIndex: number): RelayStoryKind {
  return RELAY_STORY_KINDS[Math.max(0, Math.min(RELAY_STORY_STEP_COUNT - 1, stepIndex))];
}

export function relayStoryProgressLabel(segmentCount: number, complete: boolean): string {
  if (complete) return '完結';
  if (segmentCount <= 0) return 'はじまり';
  const kind = relayStoryKindAtStep(segmentCount - 1);
  return `${kind}まで`;
}

/** 今日のお題（段階A）— タイトル先頭で判定 */
export function isTodayRelayPromptTitle(title: string): boolean {
  return String(title ?? '').trim().startsWith('今日のお題');
}
