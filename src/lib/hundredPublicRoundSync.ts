import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { HUNDRED_OPEN_RECRUIT_DEADLINE_MS } from './firestoreTime';
import type { PickupCharset } from './hundredPickupCharset';

/** 次のお題開始後 — 募集一覧（hundred_public）を現行お題に合わせる。欠損時は再作成。 */
export async function syncHundredPublicForNewRound(params: {
  roomId: string;
  targetWord: string;
  boardCols: number;
  boardRows: number;
  pickupCharset: PickupCharset;
}): Promise<void> {
  const { roomId, targetWord, boardCols, boardRows, pickupCharset } = params;
  if (!roomId.trim()) return;

  const roomRef = doc(db, 'hundred_rooms', roomId);
  const roomSnap = await getDoc(roomRef);
  const roomData = roomSnap.exists() ? (roomSnap.data() as Record<string, unknown>) : {};

  const hostUid = typeof roomData.hostUid === 'string' ? roomData.hostUid : '';
  const hostNickname = typeof roomData.hostNickname === 'string' ? roomData.hostNickname : '';
  const hostEmoji = typeof roomData.hostEmoji === 'string' ? roomData.hostEmoji : '';

  const publicPayload = {
    type: 'hundred' as const,
    roomId,
    targetWord,
    pickupCharset,
    hundredMode: 'pickup' as const,
    boardSize: boardCols,
    boardCols,
    boardRows,
    hostUid,
    hostNickname,
    hostEmoji,
    updatedAt: serverTimestamp(),
    recruitDeadlineAt: Timestamp.fromMillis(HUNDRED_OPEN_RECRUIT_DEADLINE_MS),
  };

  let publicId =
    typeof roomData.publicRecruitId === 'string' ? roomData.publicRecruitId.trim() : '';

  if (publicId && !publicId.startsWith('local-')) {
    const pubRef = doc(db, 'hundred_public', publicId);
    const pubSnap = await getDoc(pubRef);
    if (pubSnap.exists()) {
      await setDoc(pubRef, publicPayload, { merge: true });
    } else {
      // お題間に delete されたあとも同じ ID で再掲示（ゲストの selectedHundred.id と揃える）
      await setDoc(pubRef, {
        ...publicPayload,
        createdAt: serverTimestamp(),
        gameTimeLimitSec: 0,
      });
    }
    await setDoc(
      roomRef,
      { recruitDeadlineAt: Timestamp.fromMillis(HUNDRED_OPEN_RECRUIT_DEADLINE_MS) },
      { merge: true },
    );
    return;
  }

  try {
    const byRoom = await getDocs(
      query(collection(db, 'hundred_public'), where('roomId', '==', roomId), limit(1)),
    );
    if (!byRoom.empty) {
      publicId = byRoom.docs[0].id;
      await setDoc(doc(db, 'hundred_public', publicId), publicPayload, { merge: true });
      await setDoc(roomRef, { publicRecruitId: publicId, recruitDeadlineAt: Timestamp.fromMillis(HUNDRED_OPEN_RECRUIT_DEADLINE_MS) }, { merge: true });
      return;
    }
  } catch (e) {
    console.warn('[syncHundredPublicForNewRound] query by roomId failed', e);
  }

  const newRef = doc(collection(db, 'hundred_public'));
  publicId = newRef.id;
  await setDoc(newRef, {
    ...publicPayload,
    createdAt: serverTimestamp(),
    gameTimeLimitSec: 0,
  });
  await setDoc(roomRef, { publicRecruitId: publicId, recruitDeadlineAt: Timestamp.fromMillis(HUNDRED_OPEN_RECRUIT_DEADLINE_MS) }, { merge: true });
}
