import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * `hundred_public` 一覧に載せた募集だけ Firebase ドキュメント ID がある。
 * 一覧に出さない募集は `id` が `local-{roomId}` のプレースホルダ。
 */
/** 終了・取消後に掲示板へ残った `hundred_public` を掃除する（`publicRecruitId` 欠損時も roomId で探す） */
export async function deleteHundredPublicForFinishedRoom(
  roomId: string,
  publicRecruitId?: string,
): Promise<void> {
  const rid = roomId.trim();
  if (!rid) return;
  const preferred = (publicRecruitId ?? '').trim();
  if (preferred && !preferred.startsWith('local-')) {
    await deleteDoc(doc(db, 'hundred_public', preferred)).catch(() => {});
  }
  try {
    const snap = await getDocs(
      query(collection(db, 'hundred_public'), orderBy('createdAt', 'desc'), limit(120)),
    );
    await Promise.all(
      snap.docs
        .filter((d) => {
          const data = d.data() as { roomId?: unknown };
          return typeof data.roomId === 'string' && data.roomId.trim() === rid;
        })
        .map((d) => deleteDoc(d.ref).catch(() => {})),
    );
  } catch (e) {
    console.warn('[deleteHundredPublicForFinishedRoom] scan fallback', e);
  }
}

export function hundredPublicListingDocId(recruit: { id?: string }): string | undefined {
  const id = String(recruit.id ?? '').trim();
  if (!id || id.startsWith('local-')) return undefined;
  return id;
}

/**
 * ホストが問題生成をキャンセルしたとき:
 * - hundred_rooms を「取消」にし problemsGenerating を落とす
 * - hundred_public の募集ドキュメントを削除（一覧から消す。「募集をとじる」と同様）
 */
export async function applyHostCancelledHundredGeneration(params: {
  roomId: string;
  /** `hundred_public` のドキュメント ID（`selectedHundred.id`） */
  hundredPublicDocId: string | undefined;
  endReason?: 'generation_cancelled' | 'recruitment_closed' | 'host_interrupted';
}): Promise<void> {
  const { roomId, hundredPublicDocId, endReason = 'generation_cancelled' } = params;
  await setDoc(
    doc(db, 'hundred_rooms', roomId),
    {
      problemsGenerating: false,
      status: 'cancelled',
      endReason,
    },
    { merge: true }
  ).catch((e) => {
    console.warn('[applyHostCancelledHundredGeneration] hundred_rooms', e);
  });
  if (hundredPublicDocId) {
    await deleteDoc(doc(db, 'hundred_public', hundredPublicDocId)).catch((e) => {
      console.warn('[applyHostCancelledHundredGeneration] hundred_public delete', e);
    });
  }
}

/**
 * ホストがペア探し／ひと言探しから離れるとき: 募集中・進行中なら取消＋掲示板削除。
 * すでに取消済みで `hundred_public` だけ残っている場合は削除のみ試す。
 */
export async function closeHundredRecruitmentAsHostIfActive(roomId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
  if (!snap.exists()) return;
  const d = snap.data() as {
    hostUid?: unknown;
    status?: unknown;
    publicRecruitId?: unknown;
  };
  if (d.hostUid !== uid) return;
  const publicRecruitId =
    typeof d.publicRecruitId === 'string' && d.publicRecruitId.trim()
      ? d.publicRecruitId.trim()
      : undefined;
  const st = typeof d.status === 'string' ? d.status : 'recruiting';
  if (st === 'finished' || st === 'cancelled') {
    await deleteHundredPublicForFinishedRoom(roomId, publicRecruitId);
    return;
  }
  await applyHostCancelledHundredGeneration({
    roomId,
    hundredPublicDocId: publicRecruitId,
    endReason: 'host_interrupted',
  });
}
