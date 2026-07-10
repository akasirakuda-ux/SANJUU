/**
 * `npm run test:slide-puzzle-idle` で実行（storage 部分）
 */
import assert from 'node:assert/strict';
import { SLIDE_IDLE_SESSION_TTL_MS } from './config';
import {
  createIdleSnapshot,
  generateIdlePuzzle,
} from './engine';
import {
  clearSlideIdleSession,
  createMemorySlideIdleStorage,
  idleSnapshotToStoredSession,
  isSlideIdleSessionExpired,
  loadSlideIdleSession,
  saveSlideIdleSession,
  setSlideIdleStorageBackend,
  storedSessionToIdleSnapshot,
} from './storage';

const memory = createMemorySlideIdleStorage();
setSlideIdleStorageBackend(memory);

const generated = generateIdlePuzzle({ seed: 7 });
const snapshot = createIdleSnapshot('r-hero', generated, 'autoPlay');
snapshot.exitRequested = true;

assert.equal(saveSlideIdleSession(snapshot, { savedAtMs: 1_000_000 }), true);

const loaded = loadSlideIdleSession({ nowMs: 1_000_000 + 1000 });
assert.ok(loaded);
assert.equal(loaded!.artId, 'r-hero');
assert.equal(loaded!.mode, 'autoPlay');
assert.equal(loaded!.exitRequested, true);
assert.equal(loaded!.resolvedStep, 0);

const roundTrip = storedSessionToIdleSnapshot(loaded!);
assert.deepEqual(roundTrip.board, snapshot.board);
assert.deepEqual(roundTrip.undoMoves, snapshot.undoMoves);

const expiredSession = idleSnapshotToStoredSession(snapshot, 0);
assert.equal(isSlideIdleSessionExpired(expiredSession, SLIDE_IDLE_SESSION_TTL_MS + 1), true);

saveSlideIdleSession(snapshot, { savedAtMs: 0 });
const expiredLoad = loadSlideIdleSession({
  nowMs: SLIDE_IDLE_SESSION_TTL_MS + 1,
  clearIfExpired: true,
});
assert.equal(expiredLoad, null);
assert.equal(memory.getItem('rakuda_slide_idle_session_v1'), null);

saveSlideIdleSession(snapshot, { savedAtMs: 5_000_000 });
clearSlideIdleSession();
assert.equal(loadSlideIdleSession({ nowMs: 5_000_000 }), null);

setSlideIdleStorageBackend(null);

console.log('[slidePuzzleIdle/storage.selftest] OK');
