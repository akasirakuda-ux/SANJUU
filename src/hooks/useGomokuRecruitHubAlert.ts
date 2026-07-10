import { useEffect, useState } from 'react';
import {
  GOMOKU_PENDING_HOST_CHANGED_EVENT,
  loadGomokuPendingHostRoomCode,
} from '../lib/gomokuConfig';
import { subscribeGomokuRoom, subscribeOpenGomokuRooms } from '../lib/gomokuRooms';

/**
 * メインハブ（seat-selection）向け: 五目並べ募集の表示用。
 */
export function useGomokuRecruitHubAlert(
  enabled: boolean,
  myUid: string | null | undefined,
): { hasOpenRecruits: boolean; hasMyHostRecruiting: boolean } {
  const [hasOpenRecruits, setHasOpenRecruits] = useState(false);
  const [hasMyHostRecruiting, setHasMyHostRecruiting] = useState(false);
  const [pendingHostCode, setPendingHostCode] = useState(() =>
    enabled ? loadGomokuPendingHostRoomCode() : '',
  );

  useEffect(() => {
    if (!enabled) {
      setPendingHostCode('');
      return;
    }
    setPendingHostCode(loadGomokuPendingHostRoomCode());
    const onPendingChanged = () => setPendingHostCode(loadGomokuPendingHostRoomCode());
    window.addEventListener(GOMOKU_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
    return () => window.removeEventListener(GOMOKU_PENDING_HOST_CHANGED_EVENT, onPendingChanged);
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
        ? subscribeGomokuRoom(pendingHostCode, (room) => {
            fromPendingRoom =
              !!room && room.status === 'waiting' && room.host.uid === myUid;
            syncHostWaiting();
          })
        : null;

    if (!myUid || !pendingHostCode) {
      fromPendingRoom = false;
    }

    const unsubList = subscribeOpenGomokuRooms((rooms) => {
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
