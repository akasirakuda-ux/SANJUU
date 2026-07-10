import { deleteDoc, doc, getDoc, type Firestore } from 'firebase/firestore';
import {
  isHundredBetweenRounds,
  isHundredRoomInPlayOrStarting,
  type HundredRoomListMeta,
} from './firestoreTime';
import { parseHundredRoomMeta } from './hundredRoomListMeta';

/**
 * 一緒に遊べない募集掲示を消す。
 * - 終了・取消・部屋欠損
 * - ホスト開始前の控室（あそび中でない）
 * お題とお題のあいだは一覧に出さない（再参加は PublicScreen バナー）。
 * ルール上、ホスト以外は finished / お題間のみ削除可。それ以外は失敗して無視。
 */
export async function cleanupStaleHundredPublicListings(params: {
  db: Firestore;
  items: Array<{ id?: string; roomId?: string; roboPickupLounge?: boolean }>;
  roomMetaByRoomId: Record<string, HundredRoomListMeta>;
  missingRoomIds?: Set<string>;
}): Promise<number> {
  const { db, items, roomMetaByRoomId, missingRoomIds } = params;
  let deleted = 0;
  await Promise.all(
    items.map(async (item) => {
      const id = String(item.id ?? '').trim();
      if (!id || id.startsWith('local-')) return;
      if (item.roboPickupLounge === true) return;
      const roomId = (item.roomId || '').trim();
      if (!roomId) return;
      let room = roomMetaByRoomId[roomId];
      try {
        const freshSnap = await getDoc(doc(db, 'hundred_rooms', roomId));
        if (freshSnap.exists()) {
          room = parseHundredRoomMeta(freshSnap.data() as Record<string, unknown>);
        }
      } catch {
        /* キャッシュメタで続行 */
      }
      const missing = missingRoomIds?.has(roomId) === true;
      const st = room?.status ?? '';
      // プレイ中の掲示は stale キャッシュでも消さない
      if (st === 'playing' || st === 'started') return;
      const notPlayable = !isHundredRoomInPlayOrStarting(room);
      const shouldDelete =
        missing ||
        st === 'finished' ||
        st === 'cancelled' ||
        isHundredBetweenRounds(room) ||
        (st === 'recruiting' && notPlayable);
      if (!shouldDelete) return;
      try {
        await deleteDoc(doc(db, 'hundred_public', id));
        deleted += 1;
      } catch {
        /* 権限なし・既に無い — 無視 */
      }
    }),
  );
  return deleted;
}
