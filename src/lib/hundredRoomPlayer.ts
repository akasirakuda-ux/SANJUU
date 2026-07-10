import {
  collection,
  doc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { HUNDRED_MAX_PLAYERS } from './hundredRoomCapacity';
import {
  countActiveHundredPlayersFromDocs,
  filterPresentHundredPlayers,
  filterRoboLoungeRoundPlayers,
  rosterFromHundredPlayerDoc,
  type CountActiveHundredPlayersOpts,
} from './hundredPlayerPresence';

export type ReconcileHundredRoomPlayerCountOpts = CountActiveHundredPlayersOpts & {
  /** 在室判定外の player doc を削除（ロボお題切替時など） */
  pruneAbsent?: boolean;
};

function shouldKeepHundredPlayerDoc(
  roster: ReturnType<typeof rosterFromHundredPlayerDoc>,
  opts: ReconcileHundredRoomPlayerCountOpts | undefined,
  nowMs: number,
): boolean {
  const present = filterPresentHundredPlayers([roster], { nowMs, windowMs: opts?.windowMs });
  if (present.length === 0) return false;
  if (opts?.roundStartedAt != null) {
    const inRound = filterRoboLoungeRoundPlayers(
      present,
      opts.roundStartedAt,
      opts.foundWords ?? [],
      { nowMs, windowMs: opts?.windowMs },
    );
    return inRound.length > 0;
  }
  return true;
}

/** 前局の player doc を削除（退出漏れ・お題切替後の20人誤表示対策） */
export async function pruneAbsentHundredRoomPlayers(
  roomId: string,
  opts?: ReconcileHundredRoomPlayerCountOpts,
): Promise<number> {
  if (!roomId) return 0;
  const playersSnap = await getDocs(collection(db, 'hundred_rooms', roomId, 'players'));
  const nowMs = opts?.nowMs ?? Date.now();
  const toDelete: string[] = [];
  for (const docSnap of playersSnap.docs) {
    const roster = rosterFromHundredPlayerDoc(docSnap);
    if (!shouldKeepHundredPlayerDoc(roster, opts, nowMs)) {
      toDelete.push(docSnap.id);
    }
  }
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = writeBatch(db);
    for (const uid of toDelete.slice(i, i + 400)) {
      batch.delete(doc(db, 'hundred_rooms', roomId, 'players', uid));
    }
    try {
      await batch.commit();
    } catch (e) {
      const code = getFirestoreErrorCode(e);
      if (code === 'permission-denied') {
        console.warn('[pruneAbsentHundredRoomPlayers] permission-denied (skip batch)', { roomId, batchSize: toDelete.length });
        break;
      }
      throw e;
    }
  }
  return toDelete.length;
}

/** `players` サブコレの在室数で `playerCount` を揃える（退出漏れで満室誤表示になるのを防ぐ） */
export async function reconcileHundredRoomPlayerCount(
  roomId: string,
  opts?: ReconcileHundredRoomPlayerCountOpts,
): Promise<number> {
  if (!roomId) return 0;
  if (opts?.pruneAbsent) {
    try {
      await pruneAbsentHundredRoomPlayers(roomId, opts);
    } catch (e) {
      console.warn('[reconcileHundredRoomPlayerCount] prune failed', { roomId, e });
    }
  }
  const roomRef = doc(db, 'hundred_rooms', roomId);
  const playersSnap = await getDocs(collection(db, 'hundred_rooms', roomId, 'players'));
  const actual = countActiveHundredPlayersFromDocs(playersSnap.docs, opts);
  try {
    await runTransaction(db, async (transaction) => {
      transaction.set(
        roomRef,
        { playerCount: actual, updatedAt: serverTimestamp() },
        { merge: true },
      );
    });
  } catch (e) {
    console.warn('[reconcileHundredRoomPlayerCount] failed', { roomId, e });
  }
  return actual;
}

/** 次のお題開始時 — 前の局の player doc を全削除（待機室ハートビートで満室固定になるのを防ぐ） */
export async function clearHundredRoomPlayersForNewRound(roomId: string): Promise<void> {
  if (!roomId) return;
  const roomRef = doc(db, 'hundred_rooms', roomId);
  const playersSnap = await getDocs(collection(db, 'hundred_rooms', roomId, 'players'));
  const ids = playersSnap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const uid of ids.slice(i, i + 400)) {
      batch.delete(doc(db, 'hundred_rooms', roomId, 'players', uid));
    }
    try {
      await batch.commit();
    } catch (e) {
      const code = getFirestoreErrorCode(e);
      if (code === 'permission-denied') {
        console.warn('[clearHundredRoomPlayersForNewRound] permission-denied (skip batch)', {
          roomId,
          batchSize: ids.length,
        });
        break;
      }
      throw e;
    }
  }
  try {
    await runTransaction(db, async (transaction) => {
      transaction.set(
        roomRef,
        { playerCount: 0, updatedAt: serverTimestamp() },
        { merge: true },
      );
    });
  } catch (e) {
    console.warn('[clearHundredRoomPlayersForNewRound] playerCount reset failed', { roomId, e });
  }
}
export async function leaveHundredRoomPlayer(roomId: string, uid: string): Promise<void> {
  if (!roomId || !uid) return;
  const roomRef = doc(db, 'hundred_rooms', roomId);
  const playerRef = doc(db, 'hundred_rooms', roomId, 'players', uid);
  const MAX_ATTEMPTS = 4;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await runTransaction(db, async (transaction) => {
        const playerSnap = await transaction.get(playerRef);
        const roomSnap = await transaction.get(roomRef);
        if (!playerSnap.exists()) return;
        const stored = roomSnap.data()?.playerCount;
        const count = typeof stored === 'number' ? stored : 0;
        transaction.delete(playerRef);
        transaction.set(
          roomRef,
          {
            playerCount: Math.max(0, count - 1),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
      return;
    } catch (e) {
      if (isHundredJoinRetryableError(e) && attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => window.setTimeout(r, 70 * (attempt + 1)));
        continue;
      }
      console.warn('[leaveHundredRoomPlayer] failed', { roomId, uid, e });
      return;
    }
  }
}

/** 参加前の満室判定（実在 player 数を優先） */
export function isHundredPlayersCollectionFull(
  playerDocsSize: number,
  isHostJoiner: boolean,
): boolean {
  if (isHostJoiner) return false;
  return playerDocsSize >= HUNDRED_MAX_PLAYERS;
}

/** 参加直前: players 在室数で playerCount を揃え、20人未満か返す */
export async function checkHundredRoomJoinCapacity(
  roomId: string,
  opts?: ReconcileHundredRoomPlayerCountOpts & { isHostJoiner?: boolean },
): Promise<{ present: number; full: boolean }> {
  if (!roomId) return { present: 0, full: false };
  if (opts?.isRoboLounge || opts?.isHostJoiner) {
    return { present: 0, full: false };
  }
  await reconcileHundredRoomPlayerCount(roomId, opts);
  const playersSnap = await getDocs(collection(db, 'hundred_rooms', roomId, 'players'));
  const present = countActiveHundredPlayersFromDocs(playersSnap.docs, opts);
  return {
    present,
    full: isHundredPlayersCollectionFull(present, !!opts?.isHostJoiner),
  };
}

export function getFirestoreErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: string }).code);
  }
  return '';
}

/** 同時参加などでトランザクションが衝突したときにリトライする */
export function isHundredJoinRetryableError(error: unknown): boolean {
  const code = getFirestoreErrorCode(error);
  return code === 'failed-precondition' || code === 'aborted';
}

