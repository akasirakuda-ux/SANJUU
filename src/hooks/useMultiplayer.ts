import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { tripFirestoreCircuit } from '../lib/firestoreCircuit';

export interface Player {
  uid: string;
  name: string;
  emoji: string;
  isReady: boolean;
  joinedAt: number;
  isHost: boolean;
}

const MAX_ROOM_PLAYERS = 30;

export const useMultiplayer = (
  roomId: string | null,
  nickname: string,
  userEmoji: string,
  userId: string | null,
  isRoomCreator: boolean = false
) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomHostId, setRoomHostId] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<string>('waiting');
  const [isJoined, setIsJoined] = useState(false);
  const isJoinedRef = useRef(false);
  const isJoiningRef = useRef(false);
  const joinRetryAtMsRef = useRef(0);
  const joinBackoffMsRef = useRef(800);

  // 1. Join Room & Presence
  useEffect(() => {
    setIsJoined(false);
    isJoinedRef.current = false;
    isJoiningRef.current = false;
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId || !userId) {
      setPlayers([]);
      setRoomHostId(null);
      setIsJoined(false);
      isJoinedRef.current = false;
      return;
    }

    const currentUid = userId;
    const roomRef = doc(db, 'rooms', roomId);
    const playerRef = doc(db, 'rooms', roomId, 'players', currentUid);
    const playersRef = collection(db, 'rooms', roomId, 'players');
    let joinRetryTimer: number | null = null;

    const joinRoom = async () => {
      if (isJoinedRef.current) return;
      if (isJoiningRef.current) return;
      const now = Date.now();
      if (now < joinRetryAtMsRef.current) return;
      isJoiningRef.current = true;
      try {
        await runTransaction(db, async (transaction) => {
          const roomSnap = await transaction.get(roomRef);
          const roomData = roomSnap.data();
          
          let finalHostId = roomData?.hostId;

          if (isRoomCreator) {
            // 作成者の場合は自分がホストであることを確実にする
            // ただし、既にホストがいる場合は上書きしない（基本的にはありえないが安全のため）
            if (!finalHostId) {
              finalHostId = currentUid;
              transaction.set(roomRef, {
                hostId: currentUid,
                status: 'waiting',
                createdAt: Date.now()
              }, { merge: true });
            }
          } else {
            // ゲストの場合、部屋が存在しないなら作成しない（ホストを待つ）
            if (!roomSnap.exists() || !finalHostId) {
              return;
            }
          }

          const isHost = finalHostId === currentUid;
          transaction.set(playerRef, {
            name: nickname || 'ななし',
            emoji: userEmoji || '👤',
            joinedAt: Date.now(),
            isHost: isHost,
            isReady: isHost
          });
        });
        setIsJoined(true);
        isJoinedRef.current = true;
        joinBackoffMsRef.current = 800;
        joinRetryAtMsRef.current = 0;
      } catch (e: any) {
        console.error("Error joining room:", e);
        // If Firestore is throttling us, stop retry storms.
        tripFirestoreCircuit(db, e, { cooldownMs: 10_000 });

        // Backoff join attempts (covers both 429 and transient failures).
        const next = Math.min(15_000, Math.max(800, joinBackoffMsRef.current));
        joinRetryAtMsRef.current = Date.now() + next;
        joinBackoffMsRef.current = Math.min(15_000, Math.floor(next * 1.8));
        if (joinRetryTimer != null) {
          try { window.clearTimeout(joinRetryTimer); } catch { /* ignore */ }
        }
        joinRetryTimer = window.setTimeout(() => {
          joinRetryTimer = null;
          void joinRoom();
        }, next);
      } finally {
        isJoiningRef.current = false;
      }
    };

    joinRoom();

    // 10. 部屋の状態管理（常に実行）
    // NOTE: 429 時に onSnapshot が内部リトライして batchGet を連打しがちなので、
    // error callback で回路遮断して “嵐” を止める。
    const unsubscribeRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        const data = snapshot.data();
        if (data) {
          setRoomStatus(data.status || 'waiting');
          setRoomHostId(data.hostId || null);

          // ゲストの場合、まだ参加していなくてホストが決まったら参加を試みる
          if (!isJoinedRef.current && !isRoomCreator && (data as any).hostId) {
            joinRoom();
          }
        }
      },
      (err) => {
        tripFirestoreCircuit(db, err, { cooldownMs: 10_000 });
      }
    );

    // 5. 参加者リストのリアルタイム購読（join 後だけ）
    // join 前から players を購読すると、join 失敗時に不要な read/retry が増える。
    const unsubscribePlayers = onSnapshot(
      playersRef,
      (snapshot) => {
        if (!isJoinedRef.current && !isRoomCreator) return;
        const pList = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as Player[];
        
        pList.sort((a, b) => a.joinedAt - b.joinedAt);
        setPlayers(pList);
      },
      (err) => {
        tripFirestoreCircuit(db, err, { cooldownMs: 10_000 });
      }
    );

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
      if (joinRetryTimer != null) {
        try { window.clearTimeout(joinRetryTimer); } catch { /* ignore */ }
        joinRetryTimer = null;
      }
    };
  }, [roomId, userId, nickname, userEmoji, isRoomCreator]);

  // Determine if current user is host based on roomHostId
  const isHost = (userId && roomHostId) ? userId === roomHostId : false;

  const toggleReady = useCallback(async (ready: boolean) => {
    if (!roomId || !userId || isHost) return; // Host is always ready
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    await setDoc(playerRef, { isReady: ready }, { merge: true });
  }, [roomId, userId, isHost]);

  const updateRoomStatus = useCallback(async (status: string) => {
    if (!roomId || !isHost) return;
    const roomRef = doc(db, 'rooms', roomId);
    await setDoc(roomRef, { status }, { merge: true });
  }, [roomId, isHost]);

  return {
    players,
    isHost,
    roomHostId,
    roomStatus,
    isJoined,
    toggleReady,
    updateRoomStatus
  };
};
