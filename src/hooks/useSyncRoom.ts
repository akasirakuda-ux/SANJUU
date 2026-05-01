import { useCallback } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Board } from '../types/board';
import type { GameState } from '../types/game';

export type SyncRoomData = {
  board: Board;
  gameState?: GameState;
};

export const useSyncRoom = () => {
  const createRoom = useCallback(async (board: Board): Promise<string> => {
    const roomId = Math.random().toString(36).slice(2, 8); // 6 chars
    const ref = doc(db, 'syncRooms', roomId);
    await setDoc(ref, {
      board,
      createdAt: serverTimestamp(),
    });
    return roomId;
  }, []);

  const updateBoard = useCallback(async (roomId: string, board: Board) => {
    const ref = doc(db, 'syncRooms', roomId);
    await setDoc(
      ref,
      {
        board,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, []);

  const updateGameState = useCallback(async (roomId: string, patch: Partial<GameState>) => {
    const ref = doc(db, 'syncRooms', roomId);
    const gameStatePatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      gameStatePatch[`gameState.${k}`] = v;
    }
    await setDoc(
      ref,
      {
        ...gameStatePatch,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, []);

  const updateActions = useCallback(async (roomId: string, actions: NonNullable<GameState['actions']>) => {
    const ref = doc(db, 'syncRooms', roomId);
    await setDoc(
      ref,
      {
        'gameState.actions': actions,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, []);

  const subscribeRoom = useCallback(
    (roomId: string, onUpdate: (data: SyncRoomData | null) => void) => {
      const ref = doc(db, 'syncRooms', roomId);
      return onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            console.warn('[syncRooms] document missing', { roomId });
            onUpdate(null);
            return;
          }
          const data = snap.data() as SyncRoomData;
          onUpdate(data);
        },
        (error: any) => {
          console.error('[syncRooms] subscribe error', {
            roomId,
            code: error?.code,
            message: error?.message,
            name: error?.name,
          });
          onUpdate(null);
        }
      );
    },
    []
  );

  return { createRoom, updateBoard, updateGameState, updateActions, subscribeRoom };
};
