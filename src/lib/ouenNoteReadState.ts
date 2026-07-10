import type { OuenNoteComment, OuenNoteTopic } from './ouenNoteClient';

export const RK_OUEN_NOTE_HUB_SEEN_MS_KEY = 'rk_ouen_note_hub_seen_ms';
export const RK_OUEN_NOTE_TOPIC_SEEN_MS_KEY = 'rk_ouen_note_topic_seen_ms';

export const OUEN_NOTE_READ_CHANGED_EVENT = 'rk-ouen-note-read-changed';

function readHubSeenMs(): number {
  try {
    const raw = localStorage.getItem(RK_OUEN_NOTE_HUB_SEEN_MS_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function readTopicSeenMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RK_OUEN_NOTE_TOPIC_SEEN_MS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [id, ms] of Object.entries(parsed)) {
      const n = Number(ms);
      if (typeof id === 'string' && Number.isFinite(n) && n >= 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function writeTopicSeenMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(RK_OUEN_NOTE_TOPIC_SEEN_MS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function notifyReadChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OUEN_NOTE_READ_CHANGED_EVENT));
}

export function topicActivityMs(topic: OuenNoteTopic): number {
  const commentMs = typeof topic.lastCommentAtMs === 'number' ? topic.lastCommentAtMs : 0;
  return Math.max(topic.createdAtMs, commentMs);
}

function isActivityUnreadSince(
  sinceMs: number,
  topic: OuenNoteTopic,
  viewerUid: string | null,
): boolean {
  const activityMs = topicActivityMs(topic);
  if (activityMs <= sinceMs) return false;
  if (topic.authorUid === viewerUid) {
    const commentMs = typeof topic.lastCommentAtMs === 'number' ? topic.lastCommentAtMs : 0;
    if (commentMs <= sinceMs) return false;
  }
  return true;
}

export function getOuenNoteTopicSeenMs(topicId: string): number {
  return readTopicSeenMap()[topicId] ?? 0;
}

export function markOuenNoteHubSeen(atMs: number = Date.now()): void {
  try {
    localStorage.setItem(RK_OUEN_NOTE_HUB_SEEN_MS_KEY, String(atMs));
  } catch {
    /* ignore */
  }
  notifyReadChanged();
}

export function markOuenNoteTopicSeen(topicId: string, atMs: number = Date.now()): void {
  const map = readTopicSeenMap();
  map[topicId] = Math.max(map[topicId] ?? 0, atMs);
  writeTopicSeenMap(map);
  notifyReadChanged();
}

export function isOuenNoteTopicUnread(topic: OuenNoteTopic, viewerUid: string | null): boolean {
  return isActivityUnreadSince(getOuenNoteTopicSeenMs(topic.id), topic, viewerUid);
}

export function isOuenNoteCommentUnread(
  comment: OuenNoteComment,
  topicId: string,
  viewerUid: string | null,
): boolean {
  if (comment.authorUid === viewerUid) return false;
  const seenMs = getOuenNoteTopicSeenMs(topicId);
  return comment.createdAtMs > seenMs;
}

export function ouenNoteHasAnyUnread(
  topics: OuenNoteTopic[],
  viewerUid: string | null,
): boolean {
  const hubSeenMs = readHubSeenMs();
  return topics.some((topic) => isActivityUnreadSince(hubSeenMs, topic, viewerUid));
}
