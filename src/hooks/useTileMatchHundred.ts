import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { tripFirestoreCircuit } from '../lib/firestoreCircuit';
import { TILE_MATCH_HUNDRED_MODE } from '../lib/tileMatch/config';
import {
  commitTileMatchHint,
  commitTileMatchRemovePair,
  commitTileMatchShuffle,
  mergeTileMatchBoard,
  tileMatchBoardFromFirestore,
} from '../lib/tileMatch/hundredSync';
import type { TileMatchBoard, TileMatchMove } from '../lib/tileMatch/engine';
import { hasRemovablePair, isBoardCleared, tapSlot } from '../lib/tileMatch/engine';
import type { TileMatchParticipant } from '../games/tile-match/TileMatchGame';

export function useTileMatchHundred(
  roomId: string | null,
  opts: {
    nickname: string;
    userEmoji: string;
    hostUid?: string | null;
    onCleared?: () => void;
  }
) {
  const [board, setBoard] = useState<TileMatchBoard | null>(null);
  const [roster, setRoster] = useState<TileMatchParticipant[]>([]);
  const [roomStatus, setRoomStatus] = useState('');
  const [loading, setLoading] = useState(!!roomId);
  const [hintHighlight, setHintHighlight] = useState<{ a: number; b: number } | null>(null);
  const clearedNotifiedRef = useRef(false);
  const localSelectedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!roomId) {
      setBoard(null);
      setRoster([]);
      setLoading(false);
      return;
    }
    clearedNotifiedRef.current = false;
    setLoading(true);
    const ref = doc(db, 'hundred_rooms', roomId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLoading(false);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const mode = typeof d.hundredMode === 'string' ? d.hundredMode : '';
        if (mode !== TILE_MATCH_HUNDRED_MODE) {
          setLoading(false);
          return;
        }
        setRoomStatus(typeof d.status === 'string' ? d.status : '');
        const remote = tileMatchBoardFromFirestore(d.tileMatch);
        if (remote) {
          setBoard((prev) =>
            mergeTileMatchBoard(prev, remote, localSelectedRef.current)
          );
          if (isBoardCleared(remote) && !clearedNotifiedRef.current) {
            clearedNotifiedRef.current = true;
            opts.onCleared?.();
          }
        }
        const hint = d.tileMatchHint as { a?: number; b?: number } | undefined;
        if (hint && typeof hint.a === 'number' && typeof hint.b === 'number') {
          setHintHighlight({ a: hint.a, b: hint.b });
          window.setTimeout(() => setHintHighlight(null), 2200);
        }
        setLoading(false);
      },
      (err) => {
        tripFirestoreCircuit(db as any, err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [roomId, opts.onCleared]);

  useEffect(() => {
    if (!roomId) {
      setRoster([]);
      return;
    }
    const col = collection(db, 'hundred_rooms', roomId, 'players');
    const q = query(col, orderBy('foundCount', 'desc'), limit(40));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TileMatchParticipant[] = snap.docs.map((docSnap) => {
          const x = docSnap.data() as Record<string, unknown>;
          return {
            uid: docSnap.id,
            name: typeof x.name === 'string' && x.name.trim() ? x.name : 'ななし',
            emoji: typeof x.emoji === 'string' ? x.emoji : '🌸',
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setRoster(list);
      },
      (err) => tripFirestoreCircuit(db as any, err)
    );
    return () => unsub();
  }, [roomId]);

  const applyLocalTap = useCallback((slotId: number) => {
    if (!board) return { error: 'no_board' as const };
    const result = tapSlot(board, slotId);
    localSelectedRef.current = result.board.selectedSlotId;
    setBoard(result.board);
    return result;
  }, [board]);

  const submitRemovePair = useCallback(
    async (move: TileMatchMove) => {
      if (!roomId) return { ok: false as const, reason: 'no_room' };
      const name = (opts.nickname || '').trim() || 'ななし';
      const res = await commitTileMatchRemovePair(
        roomId,
        move,
        name,
        opts.userEmoji || '🌸'
      );
      if (res.ok) {
        localSelectedRef.current = null;
      }
      return res;
    },
    [roomId, opts.nickname, opts.userEmoji]
  );

  const requestHint = useCallback(async () => {
    if (!roomId) return null;
    return commitTileMatchHint(roomId);
  }, [roomId]);

  const requestShuffle = useCallback(async () => {
    if (!roomId || !opts.hostUid) return false;
    return commitTileMatchShuffle(roomId, opts.hostUid);
  }, [roomId, opts.hostUid]);

  const checkStuck = useCallback(() => {
    if (!board) return false;
    return !isBoardCleared(board) && !hasRemovablePair(board);
  }, [board]);

  return {
    board,
    setBoard,
    roster,
    roomStatus,
    loading,
    hintHighlight,
    applyLocalTap,
    submitRemovePair,
    requestHint,
    requestShuffle,
    checkStuck,
  };
}
