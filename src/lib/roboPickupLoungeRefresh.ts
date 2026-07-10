import { doc, getDoc, runTransaction, serverTimestamp, setDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { normalizePickupCharset, type PickupCharset } from './hundredPickupCharset';
import { buildRoboLoungeRefreshPayload } from './roboPickupLoungeCore';
import { isRoboLoungeRoundComplete, userFoundInRoboLoungeRound, isRoboLoungeRoundIdle } from './roboPickupLoungeFound';
import {
  ROBO_PICKUP_LOUNGE_COLS,
  ROBO_PICKUP_LOUNGE_ROWS,
  RAKUDA_ROBO_PICKUP_LOUNGE_PROFILE,
  resolveRoboPickupLoungeProfile,
  roboLoungeBoardSizeMismatch,
  type RoboPickupLoungeProfile,
} from './roboPickupLoungeConfig';
import { clearHundredRoomPlayersForNewRound, isHundredJoinRetryableError } from './hundredRoomPlayer';
import { firestoreLikeToMillis } from './firestoreTime';

export type RoboLoungeRefreshResult =
  | { ok: true; targetWord: string; pickupCharset: PickupCharset }
  | { ok: false; code: 'no_auth' | 'generating' | 'not_found' | 'incomplete' | 'failed'; message: string };

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t != null) window.clearTimeout(t);
  }
}

type LockFailCode = 'generating' | 'not_found' | 'incomplete' | 'already_ready';

type LockResult =
  | { ok: true; previousTargetWord: string; previousCharset: PickupCharset | null }
  | { ok: false; code: LockFailCode };

type RefreshMode = 'manual' | 'auto' | 'seed' | 'stale';

const ROBO_LOUNGE_STALE_MS = 15 * 60 * 1000;
const ROBO_LOUNGE_GENERATING_STALE_MS = 2 * 60 * 1000;

function isStaleRoboLoungeGenerating(d: Record<string, unknown>): boolean {
  if (d.problemsGenerating !== true) return false;
  const updatedMs = firestoreLikeToMillis(d.updatedAt);
  if (!updatedMs) return true;
  return Date.now() - updatedMs > ROBO_LOUNGE_GENERATING_STALE_MS;
}

/** hundred_rooms が無いと seed が not_found で止まる — クライアントから最低限の stub を用意 */
export async function ensureRoboPickupLoungeRoomDoc(profile?: RoboPickupLoungeProfile): Promise<void> {
  const p = profile ?? RAKUDA_ROBO_PICKUP_LOUNGE_PROFILE;
  const roomRef = doc(db, 'hundred_rooms', p.roomId);
  const publicRef = doc(db, 'hundred_public', p.publicId);
  const [roomSnap, publicSnap] = await Promise.all([getDoc(roomRef), getDoc(publicRef)]);
  if (roomSnap.exists() && publicSnap.exists()) return;

  const farFuture = new Date('2099-01-01T00:00:00+09:00');
  if (!publicSnap.exists()) {
    await setDoc(publicRef, {
      type: 'hundred',
      roomId: p.roomId,
      roboPickupLounge: true,
      targetWord: '',
      hostUid: p.hostUid,
      hostNickname: p.hostNickname,
      hostEmoji: p.hostEmoji,
      hundredMode: 'pickup',
      hintsEnabled: false,
      gameTimeLimitSec: 0,
      boardSize: ROBO_PICKUP_LOUNGE_COLS,
      boardCols: ROBO_PICKUP_LOUNGE_COLS,
      boardRows: ROBO_PICKUP_LOUNGE_ROWS,
      recruitDeadlineAt: farFuture,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  if (roomSnap.exists()) return;

  await setDoc(roomRef, {
    status: 'recruiting',
    roboPickupLounge: true,
    hostUid: p.hostUid,
    hostNickname: p.hostNickname,
    hostEmoji: p.hostEmoji,
    hundredMode: 'pickup',
    hintsEnabled: false,
    gameTimeLimitSec: 0,
    boardSize: ROBO_PICKUP_LOUNGE_COLS,
    boardCols: ROBO_PICKUP_LOUNGE_COLS,
    boardRows: ROBO_PICKUP_LOUNGE_ROWS,
    publicRecruitId: p.publicId,
    recruitDeadlineAt: farFuture,
    targetWord: '',
    problemsGenerating: false,
    problemsReady: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function roomNeedsRoboLoungeSeed(d: Record<string, unknown>): boolean {
  if (roboLoungeBoardSizeMismatch(d)) return true;
  const targetWord = String(d.targetWord ?? '').trim();
  const gridRows = d.gridRows;
  const hasGrid = Array.isArray(gridRows) && gridRows.length > 0;
  return !targetWord || !hasGrid || d.problemsReady === false;
}

function evaluateRoboLoungeLock(
  d: Record<string, unknown>,
  uid: string | null,
  mode: RefreshMode,
): LockResult | { ok: true; previousTargetWord: string; previousCharset: PickupCharset | null; shouldLock: true } {
  if (d.problemsGenerating === true && !isStaleRoboLoungeGenerating(d)) {
    if (!roboLoungeBoardSizeMismatch(d)) {
      return { ok: false as const, code: 'generating' as const };
    }
  }
  if (mode === 'seed') {
    if (!roomNeedsRoboLoungeSeed(d)) {
      return { ok: false as const, code: 'already_ready' as const };
    }
  } else if (mode === 'stale') {
    const startedMs = firestoreLikeToMillis(d.startedAt);
    if (isRoboLoungeRoundComplete(d.foundWords, d.words)) {
      return { ok: false as const, code: 'incomplete' as const };
    }
    if (
      !isRoboLoungeRoundIdle(
        d.foundWords,
        d.words ?? d.placedWords,
        startedMs,
        firestoreLikeToMillis(d.lastFoundAt),
        Date.now(),
        ROBO_LOUNGE_STALE_MS,
        firestoreLikeToMillis(d.updatedAt),
      )
    ) {
      return { ok: false as const, code: 'incomplete' as const };
    }
  } else if (mode === 'manual') {
    if (!uid || !userFoundInRoboLoungeRound(d.foundWords, uid)) {
      return { ok: false as const, code: 'not_found' as const };
    }
    if (!isRoboLoungeRoundComplete(d.foundWords, d.words)) {
      return { ok: false as const, code: 'incomplete' as const };
    }
  } else if (!isRoboLoungeRoundComplete(d.foundWords, d.words)) {
    return { ok: false as const, code: 'incomplete' as const };
  }
  return {
    ok: true as const,
    previousTargetWord: String(d.targetWord ?? '').trim(),
    previousCharset: normalizePickupCharset(d.pickupCharset),
    shouldLock: true as const,
  };
}

async function acquireRoboLoungeRefreshLock(
  profile: RoboPickupLoungeProfile,
  uid: string | null,
  mode: RefreshMode,
): Promise<LockResult> {
  await ensureRoboPickupLoungeRoomDoc(profile);
  const roomRef = doc(db, 'hundred_rooms', profile.roomId);

  const preSnap = await getDoc(roomRef);
  if (!preSnap.exists()) {
    return { ok: false, code: 'not_found' };
  }
  const preEval = evaluateRoboLoungeLock(preSnap.data() as Record<string, unknown>, uid, mode);
  if (!preEval.ok || !('shouldLock' in preEval)) {
    return preEval;
  }

  const MAX_ATTEMPTS = 4;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) {
          return { ok: false as const, code: 'not_found' as const };
        }
        const evalResult = evaluateRoboLoungeLock(snap.data() as Record<string, unknown>, uid, mode);
        if (!evalResult.ok) {
          return evalResult;
        }
        if (!('shouldLock' in evalResult)) {
          return { ok: false as const, code: 'generating' as const };
        }
        tx.set(roomRef, { problemsGenerating: true, problemsReady: false }, { merge: true });
        return {
          ok: true as const,
          previousTargetWord: evalResult.previousTargetWord,
          previousCharset: evalResult.previousCharset,
        };
      });
    } catch (e) {
      if (isHundredJoinRetryableError(e) && attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => window.setTimeout(r, 70 * (attempt + 1)));
        continue;
      }
      if (isHundredJoinRetryableError(e)) {
        return { ok: false, code: 'generating' };
      }
      throw e;
    }
  }
  return { ok: false, code: 'generating' };
}

async function applyRoboLoungeRefresh(
  profile: RoboPickupLoungeProfile,
  payload: NonNullable<ReturnType<typeof buildRoboLoungeRefreshPayload>>,
  startedBy: string,
): Promise<void> {
  const roomRef = doc(db, 'hundred_rooms', profile.roomId);
  const publicRef = doc(db, 'hundred_public', profile.publicId);

  await withTimeout(
    setDoc(
      roomRef,
      {
        status: 'playing',
        hundredMode: 'pickup',
        roboPickupLounge: true,
        hostUid: profile.hostUid,
        hostNickname: profile.hostNickname,
        hostEmoji: profile.hostEmoji,
        pickupCharset: payload.pickupCharset,
        gridRows: payload.gridRows,
        words: payload.words,
        targetWord: payload.targetWord,
        boardSize: payload.boardCols,
        boardCols: payload.boardCols,
        boardRows: payload.boardRows,
        gameTimeLimitSec: 0,
        hintsEnabled: false,
        foundWords: [],
        lastFoundAt: deleteField(),
        endReason: null,
        endedAt: null,
        startedAt: serverTimestamp(),
        startedBy,
        problemsGenerating: false,
        problemsReady: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    12000,
    'set-playing-doc',
  );

  await setDoc(
    publicRef,
    {
      type: 'hundred',
      roomId: profile.roomId,
      roboPickupLounge: true,
      hostUid: profile.hostUid,
      hostNickname: profile.hostNickname,
      hostEmoji: profile.hostEmoji,
      hundredMode: 'pickup',
      hintsEnabled: false,
      targetWord: payload.targetWord,
      pickupCharset: payload.pickupCharset,
      boardSize: payload.boardCols,
      boardCols: payload.boardCols,
      boardRows: payload.boardRows,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await clearHundredRoomPlayersForNewRound(profile.roomId).catch((e) => {
    console.warn('[roboPickupLounge] clear players after refresh failed', e);
  });
}

const MESSAGES: Record<LockFailCode | 'no_auth' | 'failed', string> = {
  generating: '新しいお題を準備しています',
  not_found: '1つ見つけると、全部見つけたあとに次のお題へ進めます',
  incomplete: 'みんなで全部見つけると、次のお題へ進めます',
  already_ready: 'お題は準備済みです',
  no_auth: 'ログインが必要です',
  failed: '次のお題の準備に失敗しました',
};

async function runRoboLoungeRefresh(
  profile: RoboPickupLoungeProfile,
  mode: RefreshMode,
): Promise<RoboLoungeRefreshResult> {
  const uid = auth.currentUser?.uid ?? null;
  if (mode === 'manual' && !uid) {
    return { ok: false, code: 'no_auth', message: MESSAGES.no_auth };
  }

  let lock: LockResult;
  try {
    lock = await acquireRoboLoungeRefreshLock(profile, uid, mode);
  } catch (e) {
    console.warn('[roboPickupLounge] lock failed', e);
    return { ok: false, code: 'failed', message: MESSAGES.failed };
  }

  if (!lock.ok) {
    const code = lock.code;
    const silentCodes: LockFailCode[] = ['generating', 'incomplete', 'already_ready'];
    if (silentCodes.includes(code)) {
      return {
        ok: false,
        code: code === 'generating' ? 'generating' : 'failed',
        message: MESSAGES[code],
      };
    }
    return {
      ok: false,
      code: code === 'not_found' ? 'not_found' : 'failed',
      message: MESSAGES[code],
    };
  }

  try {
    const payload = buildRoboLoungeRefreshPayload({
      previousTargetWord: lock.previousTargetWord,
      previousCharset: lock.previousCharset,
      exclude: lock.previousTargetWord ? [lock.previousTargetWord] : [],
      profile,
    });
    if (!payload) {
      await setDoc(doc(db, 'hundred_rooms', profile.roomId), { problemsGenerating: false }, { merge: true });
      return { ok: false, code: 'failed', message: MESSAGES.failed };
    }
    const startedBy = uid ?? profile.hostUid;
    await applyRoboLoungeRefresh(profile, payload, startedBy);
    return { ok: true, targetWord: payload.targetWord, pickupCharset: payload.pickupCharset };
  } catch (e) {
    console.error('[roboPickupLounge] refresh failed', e);
    await setDoc(doc(db, 'hundred_rooms', profile.roomId), { problemsGenerating: false }, { merge: true }).catch(
      () => {},
    );
    return { ok: false, code: 'failed', message: MESSAGES.failed };
  }
}

function profileFromRoomId(roomId?: string | null): RoboPickupLoungeProfile {
  return resolveRoboPickupLoungeProfile(roomId);
}

/** 見つけた人だけ — 手動で次のお題へ */
export async function refreshRoboPickupLoungeManual(roomId?: string | null): Promise<RoboLoungeRefreshResult> {
  return runRoboLoungeRefresh(profileFromRoomId(roomId), 'manual');
}

/** お題クリア後 — 自動で次のお題を生成（ログイン不要） */
export async function refreshRoboPickupLoungeAuto(roomId?: string | null): Promise<RoboLoungeRefreshResult> {
  return runRoboLoungeRefresh(profileFromRoomId(roomId), 'auto');
}

/** 盤面未生成時 — 初回お題を用意 */
export async function refreshRoboPickupLoungeSeedIfNeeded(roomId?: string | null): Promise<RoboLoungeRefreshResult> {
  const profile = profileFromRoomId(roomId);
  await ensureRoboPickupLoungeRoomDoc(profile);
  return runRoboLoungeRefresh(profile, 'seed');
}

/** 旧10×15などサイズ不一致 — 強制で10×10を再生成 */
export async function refreshRoboPickupLoungeBoardSizeIfNeeded(
  roomId?: string | null,
): Promise<RoboLoungeRefreshResult> {
  const profile = profileFromRoomId(roomId);
  await ensureRoboPickupLoungeRoomDoc(profile);
  const roomRef = doc(db, 'hundred_rooms', profile.roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    return runRoboLoungeRefresh(profile, 'seed');
  }
  const d = snap.data() as Record<string, unknown>;
  if (!roboLoungeBoardSizeMismatch(d)) {
    return { ok: false, code: 'already_ready', message: MESSAGES.already_ready };
  }
  if (d.problemsGenerating === true && !isStaleRoboLoungeGenerating(d)) {
    await setDoc(roomRef, { problemsGenerating: false, problemsReady: false }, { merge: true });
  }
  return runRoboLoungeRefresh(profile, 'seed');
}

/** 15分放置（誰も見つけない）— 自動で次のお題へ */
export async function refreshRoboPickupLoungeStale(roomId?: string | null): Promise<RoboLoungeRefreshResult> {
  return runRoboLoungeRefresh(profileFromRoomId(roomId), 'stale');
}
