/**
 * `npm run test:slide-puzzle-idle` で実行（engine 部分）
 */
import assert from 'node:assert/strict';
import { SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT } from '../slidePuzzleLogic';
import {
  addIdlePendingCredit,
  applyIdleUndoStep,
  createIdleSnapshot,
  generateIdlePuzzle,
  idleSnapshotMaxBankableCredits,
  isIdleCreditBankFull,
  isIdleSnapshotSolved,
  verifyHelpTapMovesSolve,
} from './engine';
import { SLIDE_IDLE_MAX_PENDING_CREDITS } from './config';

const generated = generateIdlePuzzle({ seed: 42 });
assert.equal(generated.undoMoves.length, SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT);
assert.equal(generated.helpTapMoves.length, SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT);
assert.equal(
  verifyHelpTapMovesSolve(generated.board, generated.helpTapMoves),
  true,
  'helpTapMoves should solve shuffled board',
);

let snapshot = createIdleSnapshot('thumbs-up', generated);
assert.equal(isIdleSnapshotSolved(snapshot), false);

for (let step = 0; step < SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT; step += 1) {
  snapshot = applyIdleUndoStep(snapshot);
}
assert.equal(snapshot.resolvedStep, SLIDE_PUZZLE_SHUFFLE_MOVE_COUNT);
assert.equal(isIdleSnapshotSolved(snapshot), true);

let creditSnap = createIdleSnapshot('r-hero', generateIdlePuzzle({ seed: 99 }));
assert.equal(creditSnap.pendingCredits, 0);
for (let i = 0; i < SLIDE_IDLE_MAX_PENDING_CREDITS + 3; i += 1) {
  creditSnap = addIdlePendingCredit(creditSnap);
}
assert.equal(creditSnap.pendingCredits, SLIDE_IDLE_MAX_PENDING_CREDITS);
assert.equal(isIdleCreditBankFull(creditSnap), true);
assert.equal(idleSnapshotMaxBankableCredits(creditSnap), SLIDE_IDLE_MAX_PENDING_CREDITS);

console.log('[slidePuzzleIdle/engine.selftest] OK');
