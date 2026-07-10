import { useEffect, useState } from 'react';
import {
  loadReversiPendingHostRoomCode,
  REVERSI_PENDING_HOST_CHANGED_EVENT,
} from '../lib/reversiConfig';
import { subscribeOpenReversiRooms, subscribeReversiRoom } from '../lib/reversiRooms';

/**
 * メインハブ（seat-selection）向け: リバーシ募集の表示用。
 * - hasOpenRecruits: 他人の参加可能な募集
 * - hasMyHostRecruiting: 自分がホストで募集中（待機）
 */
export function useReversiRecruitHubAlert(
  enabled: boolean,
  myUid: string | null | undefined,
): { hasOpenRecruits: boolean; hasMyHostRecruiting: boolean } {
  const [hasOpenRecruits, setHasOpenRecruits] = useState(false);
  const [hasMyHostRecruiting, setHasMyHostRecruiting] = useState(false);
  const [pendingHostCode, setPendingHostCode] = useState(() =>
    enabled ? loadReversiPendingHostRoomCode() : '',
  );

  useEffect(() => {
    if (!enabled) {
      setPendingHostCode('');
      return;
    }
    setPendingHostCode(loadReversiPendingHostRoomCode());
    const onPendingChanged = () => setPendingHostCode(loadReversiPendingHostRoomCode());
    window.addEventListener(REVERSI_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
    return () => window.removeEventListener(REVERSI_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setHasOpenRecruits(false);
      setHasMyHostRecruiting(false);
      return;
    }

    let fromOpenList = false;
    let fromPendingRoom = false;

    const syncHostWaiting = () => {
      setHasMyHostRecruiting(fromOpenList || fromPendingRoom);
    };

    const unsubHost =
      myUid && pendingHostCode
        ? subscribeReversiRoom(pendingHostCode, (room) => {
            fromPendingRoom =
              !!room && room.status === 'waiting' && room.host.uid === myUid;
            syncHostWaiting();
          })
        : null;

    if (!myUid || !pendingHostCode) {
      fromPendingRoom = false;
    }

    const unsubList = subscribeOpenReversiRooms((rooms) => {
      const joinable = myUid ? rooms.filter((r) => r.host.uid !== myUid) : rooms;
      setHasOpenRecruits(joinable.length > 0);
      if (myUid) {
        fromOpenList = rooms.some((r) => r.host.uid === myUid);
        syncHostWaiting();
      } else {
        setHasMyHostRecruiting(false);
      }
    });

    return () => {
      unsubList();
      unsubHost?.();
    };
  }, [enabled, myUid, pendingHostCode]);

  return { hasOpenRecruits, hasMyHostRecruiting };
}
