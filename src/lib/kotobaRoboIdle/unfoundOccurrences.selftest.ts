import assert from 'node:assert/strict';
import { listUnfoundOccurrences } from './unfoundOccurrences';

const placed = [
  {
    word: 'らくだ',
    occurrences: [
      { start: { x: 0, y: 0 }, end: { x: 3, y: 0 } },
      { start: { x: 1, y: 1 }, end: { x: 4, y: 1 } },
    ],
  },
];

const foundOne = [
  { word: 'らくだ', start: { x: 0, y: 0 }, end: { x: 3, y: 0 } },
];

const byOcc = listUnfoundOccurrences(placed, foundOne, true);
assert.equal(byOcc.length, 1);
assert.equal(byOcc[0]?.start.x, 1);

const byWord = listUnfoundOccurrences(placed, foundOne, false);
assert.equal(byWord.length, 0);

const foundNone = listUnfoundOccurrences(placed, [], true);
assert.equal(foundNone.length, 2);

console.log('[kotobaRoboIdle/unfoundOccurrences.selftest] ok');
