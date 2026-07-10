/**
 * `npx tsx src/lib/hundredAutoTargetWord.selftest.ts`
 */
import assert from 'node:assert/strict';
import {
  isKotobaHiraganaSourceWord,
  isManualPickupHiraganaWordAllowed,
  isPickupHiraganaReverseReadingRejected,
  pickRandomAutoTargetWord,
  reverseHiraganaGraphemes,
} from './hundredAutoTargetWord';

assert.equal(reverseHiraganaGraphemes('かば'), 'ばか');
assert.equal(isPickupHiraganaReverseReadingRejected('かば'), true);
assert.equal(isManualPickupHiraganaWordAllowed('かば'), false);
assert.equal(isPickupHiraganaReverseReadingRejected('ねこ'), false);
assert.equal(isManualPickupHiraganaWordAllowed('ねこ'), true);

assert.equal(isKotobaHiraganaSourceWord('ねこ'), true);
assert.equal(isKotobaHiraganaSourceWord('いぬ'), true);
assert.equal(isKotobaHiraganaSourceWord('忌憚のない'), false);
assert.equal(isKotobaHiraganaSourceWord('のない'), true);

const twoCharPool = pickRandomAutoTargetWord(2, { exclude: [] });
if (twoCharPool) {
  assert.equal(isPickupHiraganaReverseReadingRejected(twoCharPool), false);
}

for (let i = 0; i < 80; i += 1) {
  const w = pickRandomAutoTargetWord(3, { exclude: [] });
  if (w) assert.notEqual(w, 'のない', `auto pool must not pick fragment のない (got ${w})`);
}

console.log('hundredAutoTargetWord.selftest: OK');
