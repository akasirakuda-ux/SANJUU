import { useEffect, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import {
  shouldHideFromSanjuuRecruitBoard,
  type HundredRoomListMeta,
} from '../lib/rakudaHubShell';
import { subscribeOpenReversiRooms, type ReversiRoomDoc } from '../lib/reversiRooms';

export type PlayRecruitKind = 'reversi' | 'hundred';

export type PlayRecruitBadgesByUid = Record<string, PlayRecruitKind[]>;

type HundredPublicItem = {
  hostUid?: string;
  recruitDeadlineAt?: unknown;
  createdAt?: unknown;
  roomId?: string;
};

function parseRoomMeta(data: Record<string, unknown>): HundredRoomListMeta {
  return {
    status: typeof data.status === 'string' ? data.status : 'recruiting',
    playerCount: typeof data.playerCount === 'number' ? data.playerCount : undefined,
    recruitDeadlineAt: data.recruitDeadlineAt,
    hostNickname: typeof data.hostNickname === 'string' ? data.hostNickname : undefined,
    hostEmoji: typeof data.hostEmoji === 'string' ? data.hostEmoji : undefined,
  };
}

function buildBadges(
  reversiRooms: ReversiRoomDoc[],
  hundredItems: HundredPublicItem[],
  hundredRoomMeta: Record<string, HundredRoomListMeta>,
  nowMs: number,
): PlayRecruitBadgesByUid {
  const out: PlayRecruitBadgesByUid = {};

  const push = (uid: string | undefined, kind: PlayRecruitKind) => {
    if (!uid) return;
    const list = out[uid] ?? [];
    if (!list.includes(kind)) list.push(kind);
    out[uid] = list;
  };

  for (const room of reversiRooms) {
    push(room.host?.uid, 'reversi');
  }

  for (const item of hundredItems) {
    const room = item.roomId ? hundredRoomMeta[item.roomId] : undefined;
    if (shouldHideFromSanjuuRecruitBoard(item, room, nowMs)) continue;
    push(item.hostUid, 'hundred');
  }

  return out;
}

/**
 * 掲示板「今、いる人」向け: リバーシ待機ルーム / ひと言探し募集の hostUid → バッジ種別。
 * 手動マークではなく、既存の募集 Firestore データに連動する。
 */
export function useActiveUserPlayRecruitBadges(
  enabled: boolean,
  streamMode: boolean,
): PlayRecruitBadgesByUid {
  const [badges, setBadges] = useState<PlayRecruitBadgesByUid>({});

  useEffect(() => {
    if (!enabled) {
      setBadges({});
      return;
    }

    let reversiRooms: ReversiRoomDoc[] = [];
    let hundredItems: HundredPublicItem[] = [];
    let hundredRoomMeta: Record<string, HundredRoomListMeta> = {};

    const sync = () => {
      setBadges(buildBadges(reversiRooms, hundredItems, hundredRoomMeta, Date.now()));
    };

    const unsubReversi = subscribeOpenReversiRooms(
      (rooms) => {
        reversiRooms = rooms;
        sync();
      },
      (err) => {
        console.warn('[useActiveUserPlayRecruitBadges] reversi_rooms', err);
        reversiRooms = [];
        sync();
      },
    );

    const qPub = query(collection(db, 'hundred_public'), orderBy('createdAt', 'desc'), limit(40));
    const qRooms = query(collection(db, 'hundred_rooms'), limit(60));

    if (!streamMode) {
      const unsubPub = onSnapshot(
        qPub,
        (snap) => {
          hundredItems = snap.docs.map((d) => {
            const data = d.data();
            return {
              hostUid: typeof data.hostUid === 'string' ? data.hostUid : undefined,
              recruitDeadlineAt: data.recruitDeadlineAt,
              createdAt: data.createdAt,
              roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
            };
          });
          sync();
        },
        (err) => {
          console.warn('[useActiveUserPlayRecruitBadges] hundred_public', err);
          hundredItems = [];
          sync();
        },
      );

      const unsubRooms = onSnapshot(
        qRooms,
        (snap) => {
          const next: Record<string, HundredRoomListMeta> = {};
          snap.forEach((d) => {
            next[d.id] = parseRoomMeta(d.data() as Record<string, unknown>);
          });
          hundredRoomMeta = next;
          sync();
        },
        (err) => {
          console.warn('[useActiveUserPlayRecruitBadges] hundred_rooms', err);
        },
      );

      return () => {
        unsubReversi();
        unsubPub();
        unsubRooms();
      };
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const [pubSnap, roomsSnap] = await Promise.all([getDocs(qPub), getDocs(qRooms)]);
        if (cancelled) return;
        hundredItems = pubSnap.docs.map((d) => {
          const data = d.data();
          return {
            hostUid: typeof data.hostUid === 'string' ? data.hostUid : undefined,
            recruitDeadlineAt: data.recruitDeadlineAt,
            createdAt: data.createdAt,
            roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
          };
        });
        const next: Record<string, HundredRoomListMeta> = {};
        roomsSnap.forEach((d) => {
          next[d.id] = parseRoomMeta(d.data() as Record<string, unknown>);
        });
        hundredRoomMeta = next;
        sync();
      } catch (e) {
        if (!cancelled) console.warn('[useActiveUserPlayRecruitBadges] poll failed', e);
      }
    };

    void fetchOnce();
    const timer = window.setInterval(fetchOnce, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubReversi();
    };
  }, [enabled, streamMode]);

  return badges;
}
