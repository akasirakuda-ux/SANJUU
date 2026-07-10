import type { SlidePuzzleArtId } from '../slidePuzzleLogic';
import { isValidSlideBoard, slidePuzzleBoardKey, SLIDE_PUZZLE_GRID_SIZE } from '../slidePuzzleLogic';import {
  SLIDE_IDLE_SESSION_STORAGE_KEY,
  SLIDE_IDLE_SESSION_TTL_MS,
  SLIDE_IDLE_SESSION_VERSION,
} from './config';
import type { IdlePuzzleSnapshot, SlideIdleMode } from './engine';

export type SlideIdleSessionV1 = {
  version: typeof SLIDE_IDLE_SESSION_VERSION;
  artId: SlidePuzzleArtId;
  board: number[];
  undoMoves: number[];
  resolvedStep: number;
  pendingCredits?: number;
  mode: SlideIdleMode;
  exitRequested: boolean;
  boardKeyAtShuffle: string;
  savedAtMs: number;
};

export type SlideIdleStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

let storageBackend: SlideIdleStorageLike | null = null;

/** テスト用: localStorage の差し替え */
export function setSlideIdleStorageBackend(backend: SlideIdleStorageLike | null): void {
  storageBackend = backend;
}

function resolveStorage(): SlideIdleStorageLike | null {
  if (storageBackend) return storageBackend;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function isSlideIdleSessionExpired(
  session: Pick<SlideIdleSessionV1, 'savedAtMs'>,
  nowMs: number = Date.now(),
): boolean {
  return nowMs - session.savedAtMs > SLIDE_IDLE_SESSION_TTL_MS;
}

export function idleSnapshotToStoredSession(
  snapshot: IdlePuzzleSnapshot,
  savedAtMs: number = Date.now(),
): SlideIdleSessionV1 {
  return {
    version: SLIDE_IDLE_SESSION_VERSION,
    artId: snapshot.artId,
    board: [...snapshot.board],
    undoMoves: [...snapshot.undoMoves],
    resolvedStep: snapshot.resolvedStep,
    pendingCredits: snapshot.pendingCredits,
    mode: snapshot.mode,
    exitRequested: snapshot.exitRequested,
    boardKeyAtShuffle: snapshot.boardKeyAtShuffle,
    savedAtMs,
  };
}

export function storedSessionToIdleSnapshot(session: SlideIdleSessionV1): IdlePuzzleSnapshot {
  return {
    artId: session.artId,
    board: [...session.board],
    undoMoves: session.undoMoves,
    resolvedStep: session.resolvedStep,
    pendingCredits:
      typeof session.pendingCredits === 'number' && Number.isFinite(session.pendingCredits)
        ? Math.max(0, Math.floor(session.pendingCredits))
        : 0,
    mode: session.mode,
    exitRequested: session.exitRequested,
    boardKeyAtShuffle: session.boardKeyAtShuffle,
  };
}

function parseStoredSession(raw: string): SlideIdleSessionV1 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const s = parsed as Partial<SlideIdleSessionV1>;
    if (s.version !== SLIDE_IDLE_SESSION_VERSION) return null;
    if (s.artId !== 'r-hero' && s.artId !== 'thumbs-up') return null;
    if (!Array.isArray(s.board) || !Array.isArray(s.undoMoves)) return null;
    if (!isValidSlideBoard(s.board, SLIDE_PUZZLE_GRID_SIZE)) return null;
    if (typeof s.resolvedStep !== 'number' || !Number.isFinite(s.resolvedStep)) return null;
    if (s.mode !== 'manual' && s.mode !== 'countdown' && s.mode !== 'autoPlay') return null;
    if (typeof s.exitRequested !== 'boolean') return null;
    if (typeof s.boardKeyAtShuffle !== 'string') return null;
    if (typeof s.savedAtMs !== 'number' || !Number.isFinite(s.savedAtMs)) return null;
    if (!s.board.every((n) => Number.isInteger(n))) return null;
    if (!s.undoMoves.every((n) => Number.isInteger(n))) return null;
    return s as SlideIdleSessionV1;
  } catch {
    return null;
  }
}

export function loadSlideIdleSession(options?: {
  nowMs?: number;
  clearIfExpired?: boolean;
}): SlideIdleSessionV1 | null {
  const storage = resolveStorage();
  if (!storage) return null;

  const raw = storage.getItem(SLIDE_IDLE_SESSION_STORAGE_KEY);
  if (!raw) return null;

  const session = parseStoredSession(raw);
  if (!session) {
    storage.removeItem(SLIDE_IDLE_SESSION_STORAGE_KEY);
    return null;
  }

  const nowMs = options?.nowMs ?? Date.now();
  if (isSlideIdleSessionExpired(session, nowMs)) {
    if (options?.clearIfExpired !== false) {
      storage.removeItem(SLIDE_IDLE_SESSION_STORAGE_KEY);
    }
    return null;
  }

  return session;
}

export function saveSlideIdleSession(
  snapshot: IdlePuzzleSnapshot,
  options?: { savedAtMs?: number },
): boolean {
  const storage = resolveStorage();
  if (!storage) return false;

  const session = idleSnapshotToStoredSession(snapshot, options?.savedAtMs ?? Date.now());
  try {
    storage.setItem(SLIDE_IDLE_SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSlideIdleSession(): void {
  resolveStorage()?.removeItem(SLIDE_IDLE_SESSION_STORAGE_KEY);
}

/** 盤面キーがシャッフル直後と一致するか（お手伝い/自動1手の前提確認） */
export function idleSnapshotMatchesShuffleOrigin(snapshot: IdlePuzzleSnapshot): boolean {
  return slidePuzzleBoardKey(snapshot.board) === snapshot.boardKeyAtShuffle && snapshot.resolvedStep === 0;
}

export function createMemorySlideIdleStorage(): SlideIdleStorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}
