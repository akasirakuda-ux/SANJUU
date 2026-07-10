import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** ホストがプレイ中にヒント可否を切り替える（hundred_rooms + 掲示中の hundred_public） */
export async function setHundredRoomHintsEnabled(
  roomId: string,
  hintsEnabled: boolean,
): Promise<void> {
  await setDoc(
    doc(db, 'hundred_rooms', roomId),
    { hintsEnabled },
    { merge: true },
  );

  try {
    const snap = await getDoc(doc(db, 'hundred_rooms', roomId));
    if (!snap.exists()) return;
    const publicRecruitId = (snap.data() as { publicRecruitId?: unknown })?.publicRecruitId;
    if (typeof publicRecruitId !== 'string' || !publicRecruitId.trim()) return;
    if (publicRecruitId.startsWith('local-')) return;
    await setDoc(
      doc(db, 'hundred_public', publicRecruitId.trim()),
      { hintsEnabled },
      { merge: true },
    );
  } catch (e) {
    console.warn('[hundredRoomHints] sync hundred_public hintsEnabled failed', e);
  }
}
