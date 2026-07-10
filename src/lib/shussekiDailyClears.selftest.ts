/**
 * `npx tsx src/lib/shussekiDailyClears.selftest.ts`（package.json の test:firestore-time）で実行。
 */
import assert from 'node:assert/strict';
import {
  getDayClearCount,
  getTotalStampCount,
  isSpecialStampDay,
  recordShussekiGamePlay,
} from './shussekiDailyClears';
import type { UserAccount } from '../types';

const baseUser: UserAccount = {
  user_id: 'u1',
  created_at: '',
  login_count: 0,
  cards: [],
  totalPoints: 0,
  inventory: [],
  addOns: [],
  completedDates: [],
  specialDates: [],
  dailyClearCounts: {},
};

(() => {
  const user = { ...baseUser };
  const first = recordShussekiGamePlay(user, '2026-05-25');
  user.completedDates = first.user.completedDates;
  user.specialDates = first.user.specialDates;
  assert.equal(first.todayCount, 1);
  assert.equal(getDayClearCount(user, '2026-05-25'), 1);
  assert.equal(getTotalStampCount(user), 1);

  const second = recordShussekiGamePlay(user, '2026-05-25');
  user.completedDates = second.user.completedDates;
  assert.equal(second.todayCount, 0);
  assert.equal(getDayClearCount(user, '2026-05-25'), 1);
  assert.equal(getTotalStampCount(user), 1);

  const otherDay = recordShussekiGamePlay(user, '2026-05-26');
  user.completedDates = otherDay.user.completedDates;
  assert.equal(otherDay.todayCount, 1);
  assert.equal(getTotalStampCount(user), 2);
})();

(() => {
  const legacyUser: UserAccount = {
    ...baseUser,
    dailyClearCounts: { '2026-05-25': 5 },
  };
  assert.equal(getDayClearCount(legacyUser, '2026-05-25'), 1);
  assert.equal(getTotalStampCount(legacyUser), 1);
  assert.equal(isSpecialStampDay(legacyUser, '2026-05-25'), false);
})();

import {
  getShussekiMilestoneForTotal,
  shussekiMilestoneToastAfterNewStamp,
} from './shussekiMilestones';

(() => {
  assert.equal(getShussekiMilestoneForTotal(9), null);
  assert.equal(getShussekiMilestoneForTotal(10)?.days, 10);
  assert.equal(getShussekiMilestoneForTotal(100)?.title, '常連さん');
  assert.equal(shussekiMilestoneToastAfterNewStamp(99, 100)?.includes('常連さん'), true);
  assert.equal(shussekiMilestoneToastAfterNewStamp(99, 100, { appendGreenHint: true })?.includes('らくだ応援ゲート'), true);
  assert.equal(shussekiMilestoneToastAfterNewStamp(9, 10, { appendGreenHint: true })?.includes('緑'), false);
  assert.equal(shussekiMilestoneToastAfterNewStamp(100, 101), null);
})();

console.log('[shussekiDailyClears.selftest] OK');
