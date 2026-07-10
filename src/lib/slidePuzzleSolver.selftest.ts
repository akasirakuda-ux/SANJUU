/**
 * `npm run test:slide-puzzle-idle` で実行（solver 部分）
 */
import assert from 'node:assert/strict';
import { generateIdlePuzzle } from './slidePuzzleIdle/engine';
import { canSlideTile, moveSlideTile, SLIDE_PUZZLE_GRID_SIZE } from './slidePuzzleLogic';
import { findSlidePuzzleSolutionMoves } from './slidePuzzleSolver';

const gen = generateIdlePuzzle({ seed: 7 });
let board = [...gen.board];

assert.ok(findSlidePuzzleSolutionMoves(board)?.length! >= 1, 'shuffled board should be solvable');

for (let j = 0; j < 9; j += 1) {
  if (canSlideTile(board, j, SLIDE_PUZZLE_GRID_SIZE)) {
    board = moveSlideTile(board, j, SLIDE_PUZZLE_GRID_SIZE)!;
    break;
  }
}

const afterMove = findSlidePuzzleSolutionMoves(board);
assert.ok(afterMove && afterMove.length >= 1, 'board after one manual move should be solvable');

// 旧5×5 長の盤面は解けない（null）— 9マスだけ切り出しても不可
const legacy25 = Array.from({ length: 25 }, (_, i) => i);
assert.equal(findSlidePuzzleSolutionMoves(legacy25), null, '25-length legacy board must be rejected');

console.log('[slidePuzzleSolver.selftest] OK');
