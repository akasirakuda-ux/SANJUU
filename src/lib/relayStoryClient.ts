import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  RELAY_STORY_COLLECTION,
  RELAY_STORY_MAX_CHARS,
  relayStoryKindAtStep,
} from './relayStoryConfig';
import type { RelayStory, RelayStorySegment, RelayStoryStatus } from './relayStoryTypes';

function tsToMs(v: Timestamp | null | undefined): number {
  if (!v || typeof v.toMillis !== 'function') return Date.now();
  return v.toMillis();
}

function parseSegment(raw: DocumentData, index: number): RelayStorySegment {
  const createdAtMs =
    typeof raw.createdAtMs === 'number'
      ? raw.createdAtMs
      : tsToMs(raw.createdAt as Timestamp | undefined);
  return {
    kind: (raw.kind as RelayStorySegment['kind']) ?? relayStoryKindAtStep(index),
    text: String(raw.text ?? ''),
    authorUid: String(raw.authorUid ?? ''),
    authorNick: String(raw.authorNick ?? ''),
    authorEmoji: String(raw.authorEmoji ?? ''),
    createdAtMs,
  };
}

function relayStorySegmentPayload(
  stepIndex: number,
  text: string,
  authorUid: string,
  authorNick: string,
  authorEmoji: string,
) {
  return {
    kind: relayStoryKindAtStep(stepIndex),
    text,
    authorUid,
    authorNick,
    authorEmoji,
    /** 配列内では serverTimestamp() 不可のためミリ秒で保存 */
    createdAtMs: Date.now(),
  };
}

export function parseRelayStoryDoc(id: string, data: DocumentData): RelayStory {
  const segmentsRaw = Array.isArray(data.segments) ? data.segments : [];
  const segments = segmentsRaw.map((s, i) => parseSegment(s as DocumentData, i));
  return {
    id,
    title: String(data.title ?? '無題'),
    status: (data.status === 'complete' ? 'complete' : 'open') as RelayStoryStatus,
    currentStep: typeof data.currentStep === 'number' ? data.currentStep : segments.length,
    participantUids: Array.isArray(data.participantUids)
      ? data.participantUids.map((u) => String(u))
      : [],
    segments,
    createdAtMs: tsToMs(data.createdAt as Timestamp | undefined),
    completedAtMs: data.completedAt ? tsToMs(data.completedAt as Timestamp) : undefined,
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
    ratingSum: typeof data.ratingSum === 'number' ? data.ratingSum : 0,
  };
}

export function validateRelayStoryText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'ひとこと書いてください';
  if (trimmed.length > RELAY_STORY_MAX_CHARS) {
    return `${RELAY_STORY_MAX_CHARS}文字以内にしてください`;
  }
  return null;
}

export function resolveRelayStoryAuthor(
  uid: string | null | undefined,
  nickname: string,
  userEmoji: string,
  displayName?: string | null,
  email?: string | null,
): { authorUid: string; authorNick: string; authorEmoji: string } | null {
  if (!uid) return null;
  const authorNick =
    nickname.trim() ||
    (displayName ?? '').trim() ||
    (email ?? '').split('@')[0]?.trim() ||
    'ななし';
  const authorEmoji = userEmoji.trim() || '🐫';
  return { authorUid: uid, authorNick, authorEmoji };
}

export function relayStorySaveErrorMessage(e: unknown): string {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
  if (code === 'permission-denied') {
    return '保存の権限がありません。ログインし直してからもう一度お試しください';
  }
  if (code === 'unavailable') {
    return 'いま通信できません。少し待ってからもう一度お試しください';
  }
  if (e instanceof Error && e.message.includes('serverTimestamp')) {
    return '保存形式の不具合を直しました。ページを開き直してもう一度お試しください';
  }
  if (e instanceof Error && e.message.includes('invalid data')) {
    return '保存できませんでした。ページを開き直してからもう一度お試しください';
  }
  if (e instanceof Error && e.message && e.message.length < 80) {
    return e.message;
  }
  return '保存できませんでした。しばらくしてからもう一度お試しください';
}

export function relayStoryWriteBlockedReason(
  uid: string | null | undefined,
): string | null {
  if (!uid) return 'はじめるにはログインが必要です';
  return null;
}

export async function listRelayStories(max = 40): Promise<RelayStory[]> {
  const q = query(
    collection(db, RELAY_STORY_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseRelayStoryDoc(d.id, d.data()));
}

export async function createRelayStory(params: {
  title: string;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
}): Promise<string> {
  const err = validateRelayStoryText(params.text);
  if (err) throw new Error(err);
  const trimmed = params.text.trim();
  const title = params.title.trim() || trimmed.slice(0, 24);
  const ref = doc(collection(db, RELAY_STORY_COLLECTION));
  await setDoc(ref, {
    title,
    status: 'open',
    currentStep: 1,
    participantUids: [params.authorUid],
    segments: [
      relayStorySegmentPayload(
        0,
        trimmed,
        params.authorUid,
        params.authorNick,
        params.authorEmoji,
      ),
    ],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function appendRelayStorySegment(params: {
  storyId: string;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
}): Promise<void> {
  const err = validateRelayStoryText(params.text);
  if (err) throw new Error(err);
  const trimmed = params.text.trim();
  const ref = doc(db, RELAY_STORY_COLLECTION, params.storyId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('物語が見つかりません');
    const data = snap.data();
    if (data.status !== 'open') throw new Error('この物語はすでに完結しています');
    const step = typeof data.currentStep === 'number' ? data.currentStep : 0;
    if (step >= 4) throw new Error('この物語はすでに完結しています');
    const participantUids: string[] = Array.isArray(data.participantUids)
      ? data.participantUids.map(String)
      : [];
    if (participantUids.includes(params.authorUid)) {
      throw new Error('この物語にはすでに参加しています');
    }
    const segments = Array.isArray(data.segments) ? [...data.segments] : [];
    if (segments.length !== step) throw new Error('順番が更新されました。もう一度開いてください');
    segments.push(
      relayStorySegmentPayload(
        step,
        trimmed,
        params.authorUid,
        params.authorNick,
        params.authorEmoji,
      ),
    );
    const nextStep = step + 1;
    const complete = nextStep >= 4;
    tx.update(ref, {
      segments,
      currentStep: nextStep,
      participantUids: [...participantUids, params.authorUid],
      status: complete ? 'complete' : 'open',
      ...(complete ? { completedAt: serverTimestamp() } : {}),
    });
  });
}

export function canUserWriteOnStory(story: RelayStory, uid: string | null | undefined): boolean {
  if (!uid) return false;
  if (story.status !== 'open' || story.currentStep >= 4) return false;
  return !story.participantUids.includes(uid);
}

/** 読者に見せる話（未公開の結末は含めない） */
export function visibleRelayStorySegments(story: RelayStory): RelayStorySegment[] {
  if (story.status === 'complete') return story.segments;
  return story.segments.slice(0, story.currentStep);
}
