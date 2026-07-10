import assert from 'node:assert/strict';
import {
  isShussekiRegularTotal,
  isShussekiRegularUser,
  SHUSSEKI_REGULAR_MIN_DAYS,
  showsShussekiRegularTeaFrame,
} from './shussekiRegularEmoji';

assert.equal(SHUSSEKI_REGULAR_MIN_DAYS, 100);
assert.equal(isShussekiRegularTotal(99), false);
assert.equal(isShussekiRegularTotal(100), true);
assert.equal(showsShussekiRegularTeaFrame(false, true), false);
assert.equal(showsShussekiRegularTeaFrame(true, false), false);
assert.equal(showsShussekiRegularTeaFrame(true, true), true);

const counts: Record<string, number> = {};
for (let i = 1; i <= 100; i += 1) {
  counts[`2026-01-${String(i).padStart(2, '0')}`] = 1;
}
assert.equal(
  isShussekiRegularUser({
    completedDates: [],
    specialDates: [],
    dailyClearCounts: counts,
  }),
  true,
);

console.log('shussekiRegularEmoji.selftest OK');
