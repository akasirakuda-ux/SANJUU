import { sanitizeRkUsersCloudPayload } from './rkUsersCloudSync';

const out = sanitizeRkUsersCloudPayload({
  uid: 'abc',
  nickname: 'らくだ',
  userEmoji: '🐫',
  totalPoints: 10,
  completedDates: ['2026-05-31', '', 'bad', 123 as unknown as string],
  specialDates: ['2026-05-31'],
  dailyClearCounts: {
    '2026-05-31': 2,
    bad: 1,
    '': 9,
    '2026-05-32': NaN,
  },
  updatedAtMs: Date.now(),
});

if (out.completedDates.length !== 1) throw new Error('completedDates');
if (out.dailyClearCounts['2026-05-31'] !== 2) throw new Error('dailyClearCounts');
if ('bad' in out.dailyClearCounts) throw new Error('bad key');

console.log('[rkUsersCloudSync.selftest] OK');
