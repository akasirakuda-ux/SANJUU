import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  OUEN_NOTE_COLLECTION,
  OUEN_NOTE_COMMENT_MAX_CHARS,
} from './ouenNoteConfig';
import {
  getOuenNoteCommentValidationError,
  getOuenNoteTopicDraftValidationError,
} from './ouenNoteValidation';
import {
  clipOuenNoteDraft,
  composeOuenNoteBody,
  type OuenNoteTopicDraft,
} from './ouenNoteTopicFormat';

export type OuenNoteTopic = {
  id: string;
  body: string;
  title?: string;
  consultantProfile?: string;
  goal?: string;
  situation?: string;
  feelings?: string;
  triedResearch?: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
  createdAtMs: number;
  commentCount: number;
  lastCommentAtMs?: number;
  deleted?: boolean;
};

export type OuenNoteComment = {
  id: string;
  topicId: string;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
  createdAtMs: number;
  deleted?: boolean;
};

function tsToMs(v: Timestamp | null | undefined): number {
  if (!v || typeof v.toMillis !== 'function') return Date.now();
  return v.toMillis();
}

function parseTopic(id: string, data: DocumentData): OuenNoteTopic {
  const createdAtMs =
    typeof data.createdAtMs === 'number'
      ? data.createdAtMs
      : tsToMs(data.createdAt as Timestamp | undefined);
  const str = (key: string) => {
    const v = data[key];
    return typeof v === 'string' ? v : undefined;
  };
  return {
    id,
    body: String(data.body ?? ''),
    title: str('title'),
    consultantProfile: str('consultantProfile'),
    goal: str('goal'),
    situation: str('situation'),
    feelings: str('feelings'),
    triedResearch: str('triedResearch'),
    authorUid: String(data.authorUid ?? ''),
    authorNick: String(data.authorNick ?? ''),
    authorEmoji: String(data.authorEmoji ?? ''),
    createdAtMs,
    commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
    lastCommentAtMs: typeof data.lastCommentAtMs === 'number' ? data.lastCommentAtMs : undefined,
    deleted: data.deleted === true,
  };
}

function parseComment(id: string, topicId: string, data: DocumentData): OuenNoteComment {
  const createdAtMs =
    typeof data.createdAtMs === 'number'
      ? data.createdAtMs
      : tsToMs(data.createdAt as Timestamp | undefined);
  return {
    id,
    topicId,
    text: String(data.text ?? ''),
    authorUid: String(data.authorUid ?? ''),
    authorNick: String(data.authorNick ?? ''),
    authorEmoji: String(data.authorEmoji ?? ''),
    createdAtMs,
    deleted: data.deleted === true,
  };
}

export function ouenNoteSaveErrorMessage(e: unknown): string {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
  if (code === 'permission-denied') {
    return '保存の権限がありません。ログインし直してからもう一度お試しください';
  }
  if (code === 'unavailable') {
    return 'いま通信できません。少し待ってからもう一度お試しください';
  }
  return '保存できませんでした。しばらくしてからもう一度お試しください';
}

export function subscribeOuenNoteTopics(
  onRows: (rows: OuenNoteTopic[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, OUEN_NOTE_COLLECTION), orderBy('createdAtMs', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => parseTopic(d.id, d.data()))
        .filter((t) => !t.deleted);
      onRows(rows);
    },
    (err) => onError?.(err),
  );
}

export function subscribeOuenNoteComments(
  topicId: string,
  onRows: (rows: OuenNoteComment[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const q = query(
    collection(db, OUEN_NOTE_COLLECTION, topicId, 'comments'),
    orderBy('createdAtMs', 'asc'),
    limit(120),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => parseComment(d.id, topicId, d.data()))
        .filter((c) => !c.deleted);
      onRows(rows);
    },
    (err) => onError?.(err),
  );
}

export async function createOuenNoteTopic(params: {
  draft: OuenNoteTopicDraft;
  authorUid: string;
  authUser?: import('firebase/auth').User | null;
}): Promise<string> {
  const clipped = clipOuenNoteDraft(params.draft);
  const err = getOuenNoteTopicDraftValidationError(clipped, params.authUser);
  if (err) throw new Error(err);
  const body = composeOuenNoteBody(clipped);
  const authorNick = clipped.postNick.trim().slice(0, 32);
  const authorEmoji = clipped.postEmoji.trim().slice(0, 8) || '🐫';
  const ref = doc(collection(db, OUEN_NOTE_COLLECTION));
  const now = Date.now();
  await setDoc(ref, {
    body,
    title: clipped.title.trim(),
    consultantProfile: clipped.consultantProfile.trim(),
    goal: clipped.goal.trim(),
    situation: clipped.situation.trim(),
    feelings: clipped.feelings.trim(),
    triedResearch: clipped.triedResearch.trim(),
    authorUid: params.authorUid,
    authorNick,
    authorEmoji,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    commentCount: 0,
    deleted: false,
  });
  return ref.id;
}

export async function createOuenNoteComment(params: {
  topicId: string;
  text: string;
  authorUid: string;
  authorNick: string;
  authorEmoji: string;
  authUser?: import('firebase/auth').User | null;
}): Promise<string> {
  const err = getOuenNoteCommentValidationError(
    params.text,
    params.authorNick,
    params.authorEmoji,
    params.authUser,
  );
  if (err) throw new Error(err);
  const topicRef = doc(db, OUEN_NOTE_COLLECTION, params.topicId);
  const commentRef = doc(collection(db, OUEN_NOTE_COLLECTION, params.topicId, 'comments'));
  const now = Date.now();
  await setDoc(commentRef, {
    topicId: params.topicId,
    text: params.text.trim(),
    authorUid: params.authorUid,
    authorNick: params.authorNick.trim().slice(0, 32),
    authorEmoji: params.authorEmoji.trim().slice(0, 8) || '🐫',
    createdAtMs: now,
    createdAt: serverTimestamp(),
    deleted: false,
  });
  // commentCount はルールで increment できないため、読み取り側は comments 長さを優先
  try {
    const topicSnap = await getDocs(
      query(collection(db, OUEN_NOTE_COLLECTION, params.topicId, 'comments'), limit(200)),
    );
    await setDoc(topicRef, { commentCount: topicSnap.size, lastCommentAtMs: now }, { merge: true });
  } catch {
    /* 表示は comments 購読で足りる */
  }
  return commentRef.id;
}

export async function adminSoftDeleteOuenNoteTopic(topicId: string): Promise<void> {
  await setDoc(doc(db, OUEN_NOTE_COLLECTION, topicId), { deleted: true }, { merge: true });
}

export async function adminSoftDeleteOuenNoteComment(topicId: string, commentId: string): Promise<void> {
  await setDoc(
    doc(db, OUEN_NOTE_COLLECTION, topicId, 'comments', commentId),
    { deleted: true },
    { merge: true },
  );
}

export async function adminHardDeleteOuenNoteTopic(topicId: string): Promise<void> {
  const commentsSnap = await getDocs(collection(db, OUEN_NOTE_COLLECTION, topicId, 'comments'));
  await Promise.all(commentsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, OUEN_NOTE_COLLECTION, topicId));
}

export async function adminDeleteOuenReportTarget(report: {
  targetType: 'ouen_note_topic' | 'ouen_note_comment';
  targetId: string;
}): Promise<void> {
  if (report.targetType === 'ouen_note_topic') {
    await adminSoftDeleteOuenNoteTopic(report.targetId);
    return;
  }
  const slash = report.targetId.indexOf('/');
  const topicId = slash >= 0 ? report.targetId.slice(0, slash) : '';
  const commentId = slash >= 0 ? report.targetId.slice(slash + 1) : report.targetId;
  if (!topicId || !commentId) throw new Error('invalid comment target');
  await adminSoftDeleteOuenNoteComment(topicId, commentId);
}
