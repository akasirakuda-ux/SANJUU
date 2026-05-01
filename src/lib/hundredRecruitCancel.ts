import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * ホストが問題生成をキャンセルしたとき:
 * - hundred_rooms を「取消」にし problemsGenerating を落とす
 * - hundred_public の募集ドキュメントを削除（一覧から消す。「募集をとじる」と同様）
 */
export async function applyHostCancelledHundredGeneration(params: {
  roomId: string;
  /** `hundred_public` のドキュメント ID（`selectedHundred.id`） */
  hundredPublicDocId: string | undefined;
}): Promise<void> {
  const { roomId, hundredPublicDocId } = params;
  await setDoc(
    doc(db, 'hundred_rooms', roomId),
    {
      problemsGenerating: false,
      status: 'cancelled',
      endReason: 'generation_cancelled',
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
