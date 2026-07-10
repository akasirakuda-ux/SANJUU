import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  RELAY_STORY_COLLECTION,
  RELAY_STORY_REVIEW_MAX_CHARS,
} from './relayStoryConfig';
import { relayStorySaveErrorMessage } from './relayStoryClient';
import type { RelayStoryReview } from './relayStoryTypes';

function tsToMs(v: Timestamp | null | undefined): number {
  if (!v || typeof v.toMillis !== 'function') return Date.now();
  return v.toMillis();
}

function parseRelayStoryReview(storyId: string, uid: string, data: DocumentData): RelayStoryReview {
  const createdAtMs =
    typeof data.createdAtMs === 'number'
      ? data.createdAtMs
      : tsToMs(data.createdAt as Timestamp | undefined);
  const rating = typeof data.rating === 'number' ? data.rating : 0;
  return {
    id: uid,
    storyId,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    text: String(data.text ?? ''),
    authorUid: String(data.authorUid ?? uid),
    authorNick: String(data.authorNick ?? ''),
    authorEmoji: String(data.authorEmoji ?? ''),
    createdAtMs,
  };
}

export function validateRelayStoryReview(rating: number, text: string): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return '★は1〜5で選んでください';
  }
  const trimmed = text.trim();
  if (trimmed.length > RELAY_STORY_REVIEW_MAX_CHARS) {
    return `レビューは${RELAY_STORY_REVIEW_MAX_CHARS}文字以内にしてください`;
  }
  return null;
}

export { relayStorySaveErrorMessage as relayStoryReviewSaveErrorMessage };

export async function listRelayStoryReviews(storyId: string): Promise<RelayStoryReview[]> {
  const q = query(
    collection(db, RELAY_STORY_COLLECTION, storyId, 'reviews'),
    orderBy('createdAtMs', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseRelayStoryReview(storyId, d.id, d.data()));
}

export async function submitRelayStoryReview(params: {
  storyId: string;
  rating: number;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
}): Promise<void> {
  const err = validateRelayStoryReview(params.rating, params.text);
  if (err) throw new Error(err);
  const trimmed = params.text.trim();
  const storyRef = doc(db, RELAY_STORY_COLLECTION, params.storyId);
  const reviewRef = doc(db, RELAY_STORY_COLLECTION, params.storyId, 'reviews', params.authorUid);
  const nowMs = Date.now();
  const reviewPayload = {
    rating: params.rating,
    text: trimmed,
    authorUid: params.authorUid,
    authorNick: params.authorNick,
    authorEmoji: params.authorEmoji,
    createdAtMs: nowMs,
  };

  await runTransaction(db, async (tx) => {
    const storySnap = await tx.get(storyRef);
    if (!storySnap.exists()) throw new Error('物語が見つかりません');
    const story = storySnap.data();
    if (story.status !== 'complete') throw new Error('完結した物語だけレビューできます');

    const reviewSnap = await tx.get(reviewRef);
    const prevCount = typeof story.reviewCount === 'number' ? story.reviewCount : 0;
    const prevSum = typeof story.ratingSum === 'number' ? story.ratingSum : 0;
    const prevRating =
      reviewSnap.exists() && typeof reviewSnap.data().rating === 'number'
        ? reviewSnap.data().rating
        : 0;

    if (reviewSnap.exists()) {
      const existing = reviewSnap.data();
      const createdAtMs =
        typeof existing.createdAtMs === 'number' ? existing.createdAtMs : nowMs;
      tx.set(reviewRef, { ...reviewPayload, createdAtMs }, { merge: true });
      tx.update(storyRef, {
        ratingSum: prevSum - prevRating + params.rating,
      });
    } else {
      tx.set(reviewRef, reviewPayload);
      tx.update(storyRef, {
        reviewCount: prevCount + 1,
        ratingSum: prevSum + params.rating,
      });
    }
  });
}
