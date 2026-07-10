/**
 * `npx tsx src/lib/firestoreTime.selftest.ts`（package.json の test:firestore-time）で実行。
 */
import assert from 'node:assert/strict';
import {
  firestoreLikeToMillis,
  formatFirestoreTimeJa,
  HUNDRED_IN_PLAY_BOARD_VISIBLE_MS,
  HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS,
  HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS,
  HUNDRED_RECRUIT_WINDOW_MS,
  hundredDisplayDeadlineMs,
  normalizeHundredGameTimeLimitSec,
  RENRAKU_RECRUIT_TTL_MS,
  shouldHideFromPublicListAfterRecruitDeadlineGrace,
  shouldHideFromSanjuuRecruitBoard,
  shouldHideHundredPublicFromListItem,
  isHundredRoomInPlay,
  isHundredRoomInPlayOrStarting,
  isHundredBetweenRounds,
  isHundredOpenRecruitSessionEnded,
} from './firestoreTime';

const T0 = 1_700_000_000_000;

// Timestamp 風（seconds / nanoseconds）
assert.equal(firestoreLikeToMillis({ seconds: Math.floor(T0 / 1000), nanoseconds: 500_000_000 }), T0 + 500);

// toMillis 優先
assert.equal(
  firestoreLikeToMillis({
    toMillis: () => T0,
    toDate: () => new Date(0),
  }),
  T0
);

// Date
assert.equal(firestoreLikeToMillis(new Date(T0)), T0);

// number
assert.equal(firestoreLikeToMillis(T0), T0);

// 無効
assert.equal(firestoreLikeToMillis(undefined), null);
assert.equal(firestoreLikeToMillis(null), null);
assert.equal(firestoreLikeToMillis({}), null);

// hundred 表示締切: room 優先
assert.equal(
  hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: { toMillis: () => 111 },
    itemRecruitDeadlineAt: { toMillis: () => 222 },
    itemCreatedAt: { toMillis: () => 333 },
  }),
  111
);

assert.equal(
  hundredDisplayDeadlineMs({
    itemRecruitDeadlineAt: { toMillis: () => 222 },
    itemCreatedAt: { toMillis: () => T0 },
  }),
  222
);

assert.equal(
  hundredDisplayDeadlineMs({
    itemCreatedAt: { toMillis: () => T0 },
  }),
  T0 + HUNDRED_RECRUIT_WINDOW_MS
);

// 一覧グレース: 締切 + grace 未満なら表示、以上なら非表示（締切未定は常に表示側）
const grace = HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS;
assert.equal(shouldHideFromPublicListAfterRecruitDeadlineGrace({ toMillis: () => T0 }, T0 + grace - 1), false);
assert.equal(shouldHideFromPublicListAfterRecruitDeadlineGrace({ toMillis: () => T0 }, T0 + grace), false);
assert.equal(shouldHideFromPublicListAfterRecruitDeadlineGrace({ toMillis: () => T0 }, T0 + grace + 1), true);
assert.equal(shouldHideFromPublicListAfterRecruitDeadlineGrace(undefined, T0 + grace + 1), false);

// 旧形式のプレーン Timestamp 形（_seconds）
assert.equal(
  firestoreLikeToMillis({ _seconds: Math.floor(T0 / 1000), _nanoseconds: 0 }),
  Math.floor(T0 / 1000) * 1000
);

// 締切欠損 + createdAt のみ → 締切相当 = createdAt + 5分、その5分後に一覧から外す
const created = T0;
const nowHide = created + HUNDRED_RECRUIT_WINDOW_MS + grace + 1;
assert.equal(
  shouldHideHundredPublicFromListItem({ createdAt: { toMillis: () => created } }, nowHide),
  true
);
assert.equal(
  shouldHideHundredPublicFromListItem({ createdAt: { toMillis: () => created } }, created + HUNDRED_RECRUIT_WINDOW_MS + grace),
  false
);

assert.equal(RENRAKU_RECRUIT_TTL_MS, HUNDRED_RECRUIT_WINDOW_MS);
assert.equal(normalizeHundredGameTimeLimitSec(0), 0);
assert.equal(normalizeHundredGameTimeLimitSec(-1), 0);
assert.equal(normalizeHundredGameTimeLimitSec(NaN), 0);
assert.equal(normalizeHundredGameTimeLimitSec(undefined), 0);
assert.equal(normalizeHundredGameTimeLimitSec(900), 900);
assert.equal(formatFirestoreTimeJa(null), '—');
assert.ok(formatFirestoreTimeJa({ toMillis: () => T0 }).includes('20')); // 実日付に依存しないよう最低限

const item = { createdAt: { toMillis: () => created } };
const afterRecruitDeadline = created + HUNDRED_RECRUIT_WINDOW_MS + 60_000;
const afterBoardGrace =
  created + HUNDRED_RECRUIT_WINDOW_MS + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS + 60_000;
const afterInPlayWindow =
  created +
  HUNDRED_RECRUIT_WINDOW_MS +
  HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS +
  HUNDRED_IN_PLAY_BOARD_VISIBLE_MS +
  60_000;
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'playing' }, afterRecruitDeadline),
  false,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'playing', playerCount: 20 }, afterRecruitDeadline),
  false,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'playing' }, afterBoardGrace),
  false,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'playing' }, afterInPlayWindow),
  true,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'finished' }, afterBoardGrace),
  true,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'recruiting' }, afterRecruitDeadline),
  true,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, { status: 'recruiting' }, afterBoardGrace),
  true,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(
    item,
    { status: 'recruiting', playerCount: 20 },
    afterRecruitDeadline,
  ),
  true,
);
assert.equal(isHundredRoomInPlay('playing'), true);
assert.equal(isHundredRoomInPlay('recruiting'), false);
assert.equal(
  isHundredRoomInPlayOrStarting({
    status: 'recruiting',
    problemsGenerating: true,
  }),
  true,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(
    item,
    { status: 'recruiting', problemsGenerating: true },
    afterRecruitDeadline,
  ),
  false,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard({ ...item, roomId: 'room-1' }, undefined, afterRecruitDeadline),
  true,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(
    item,
    { status: 'recruiting', startedAt: { toMillis: () => created } },
    afterRecruitDeadline,
  ),
  true,
);

assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, undefined, afterRecruitDeadline, { roomDocMissing: true }),
  true,
);

const roboItem = { roboPickupLounge: true, roomId: 'robo-pickup-lounge', createdAt: { toMillis: () => created } };
assert.equal(
  shouldHideFromSanjuuRecruitBoard(roboItem, { status: 'playing', foundWords: [], words: [] }, nowHide),
  false,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(
    roboItem,
    { status: 'playing', problemsGenerating: true, foundWords: [], words: [{ occurrences: [] }] },
    nowHide,
  ),
  false,
);

const clearedPlaying = {
  status: 'playing',
  foundWords: [{ word: 'a', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, playerId: 'u1' }],
  words: [{ occurrences: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }] }],
};
assert.equal(
  shouldHideFromSanjuuRecruitBoard(item, clearedPlaying, nowHide),
  true,
);
const openDeadline = { toMillis: () => Date.parse('2099-01-01T00:00:00+09:00') };
const openItem = { createdAt: { toMillis: () => created }, recruitDeadlineAt: openDeadline };
assert.equal(
  shouldHideFromSanjuuRecruitBoard(openItem, clearedPlaying, nowHide),
  true,
);

const betweenRounds = {
  status: 'recruiting',
  endReason: 'cleared',
  endedAt: { toMillis: () => nowHide - 5 * 60_000 },
};
assert.equal(isHundredBetweenRounds(betweenRounds), true);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(openItem, betweenRounds, nowHide),
  true,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    {
      ...betweenRounds,
      endedAt: { toMillis: () => nowHide - HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS - 1 },
    },
    nowHide,
  ),
  true,
);
assert.equal(
  isHundredRoomInPlayOrStarting({
    status: 'recruiting',
    endReason: 'cleared',
    startedAt: { toMillis: () => nowHide - 60_000 },
  }),
  false,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    {
      status: 'recruiting',
      startedAt: { toMillis: () => nowHide - HUNDRED_OPEN_RECRUIT_IDLE_HIDE_MS - 1 },
    },
    nowHide,
  ),
  true,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    { status: 'playing', startedAt: { toMillis: () => nowHide - 60_000 } },
    nowHide,
  ),
  false,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    {
      status: 'playing',
      startedAt: { toMillis: () => nowHide - 60_000 },
      words: [],
    },
    nowHide,
  ),
  true,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    {
      status: 'playing',
      startedAt: { toMillis: () => nowHide - 120_000 },
      playerCount: 0,
    },
    nowHide,
  ),
  true,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    {
      status: 'playing',
      startedAt: { toMillis: () => nowHide - 120_000 },
      playerCount: 0,
      foundWords: [{ word: 'a', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      words: [
        {
          occurrences: [
            { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
            { start: { x: 2, y: 0 }, end: { x: 3, y: 0 } },
          ],
        },
      ],
    },
    nowHide,
  ),
  false,
);
assert.equal(
  isHundredOpenRecruitSessionEnded(
    openItem,
    {
      status: 'playing',
      startedAt: { toMillis: () => nowHide - 120_000 },
      playerCount: 0,
      problemsReady: true,
      words: [],
    },
    nowHide,
  ),
  false,
);
assert.equal(
  shouldHideFromSanjuuRecruitBoard(
    openItem,
    {
      status: 'playing',
      startedAt: { toMillis: () => nowHide - 120_000 },
      playerCount: 0,
      problemsReady: true,
      gridRowsPresent: true,
      words: [],
    },
    nowHide,
  ),
  false,
);

console.log('firestoreTime.selftest: OK');
