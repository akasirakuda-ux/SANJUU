import type { Firestore } from 'firebase/firestore';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { isProtectedRenrakuAdminUid } from '../constants/renrakuAdmin';

/** 掲示板投稿の保持期間（30 日）— みんなの会話のみ。連絡事項（postKind=announcement）は永久 */
export const PUBLIC_MESSAGES_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** 1 回の連絡帳オープンで試みる削除の上限（軽量化） */
const MAX_DELETES_PER_RUN = 40;

const PAGE_SIZE = 35;

/**
 * public_messages 1 件と reactions サブコレクションを削除（管理者削除・TTL 削除の共通処理）
 */
export async function deletePublicMessagePost(db: Firestore, postId: string): Promise<void> {
  const postRef = doc(db, 'public_messages', postId);
  const reactionSnap = await getDocs(collection(db, 'public_messages', postId, 'reactions'));
  const batch = writeBatch(db);
  reactionSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(postRef);
  await batch.commit();
}

/**
 * 30 日より古く、かつ pinned でない投稿をページングして削除する。
 * 連絡帳を開いたタイミングでバックグラウンド実行想定。
 */
export async function cleanupStalePublicMessages(db: Firestore): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - PUBLIC_MESSAGES_RETENTION_MS);
  let deleted = 0;
  let lastVisible: QueryDocumentSnapshot | null = null;

  for (let page = 0; page < 50 && deleted < MAX_DELETES_PER_RUN; page++) {
    const qRef = lastVisible
      ? query(
          collection(db, 'public_messages'),
          where('createdAt', '<', cutoff),
          orderBy('createdAt', 'asc'),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        )
      : query(
          collection(db, 'public_messages'),
          where('createdAt', '<', cutoff),
          orderBy('createdAt', 'asc'),
          limit(PAGE_SIZE)
        );

    const snap = await getDocs(qRef);
    if (snap.empty) break;

    lastVisible = snap.docs[snap.docs.length - 1];
    const deletable = snap.docs.filter((d) => {
      const data = d.data();
      if (data.pinned === true) return false;
      if (data.postKind == 'announcement') return false;
      if (isProtectedRenrakuAdminUid(data.fromUserUid)) return false;
      return true;
    });

    for (const d of deletable) {
      if (deleted >= MAX_DELETES_PER_RUN) break;
      try {
        await deletePublicMessagePost(db, d.id);
        deleted += 1;
      } catch (e) {
        console.warn('[cleanupStalePublicMessages] skip', d.id, e);
      }
    }

    if (snap.size < PAGE_SIZE) break;
  }

  return deleted;
}
