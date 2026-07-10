/**
 * `npx tsx src/lib/hundredHostRecruitLimit.selftest.ts`
 */
import assert from 'node:assert/strict';
import { TILE_MATCH_HUNDRED_MODE } from './tileMatch/config';
import {
  hostHasActiveHundredRecruitFromSlices,
  hostRoomBlocksNewRecruit,
} from './hundredHostRecruitLimit';
import { HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS } from './firestoreTime';

const host = 'host-uid-1';
const created = 1_700_000_000_000;
const recruitDeadline = created + 5 * 60 * 1000;
const item = {
  id: 'pub-1',
  roomId: 'room-1',
  hostUid: host,
  createdAt: created,
  recruitDeadlineAt: recruitDeadline,
};

assert.equal(hostRoomBlocksNewRecruit({ status: 'recruiting' }, false), true);
assert.equal(hostRoomBlocksNewRecruit({ status: 'playing' }, false), true);
assert.equal(hostRoomBlocksNewRecruit({ status: 'finished' }, false), false);
assert.equal(hostRoomBlocksNewRecruit(undefined, true), false);

const staleDeadline = created + 5 * 60 * 1000;
const staleNow = staleDeadline + HUNDRED_PUBLIC_LIST_HIDE_GRACE_MS + 60_000;
assert.equal(
  hostRoomBlocksNewRecruit(
    { status: 'recruiting', recruitDeadlineAt: staleDeadline },
    false,
    { recruitDeadlineAt: staleDeadline, createdAt: created, nowMs: staleNow }
  ),
  false
);

assert.equal(
  hostHasActiveHundredRecruitFromSlices(
    host,
    [item],
    { 'room-1': { status: 'recruiting', recruitDeadlineAt: recruitDeadline } },
    new Set(),
    [],
    { 'room-1': { createdAt: created, recruitDeadlineAt: recruitDeadline } },
    created + 60_000
  ),
  true
);

assert.equal(
  hostHasActiveHundredRecruitFromSlices(
    host,
    [{ ...item, hundredMode: TILE_MATCH_HUNDRED_MODE }],
    { 'room-1': { status: 'recruiting', recruitDeadlineAt: recruitDeadline } },
    new Set(),
    [],
    { 'room-1': { createdAt: created, recruitDeadlineAt: recruitDeadline } },
    created + 60_000
  ),
  true
);

assert.equal(
  hostHasActiveHundredRecruitFromSlices(
    host,
    [item],
    { 'room-1': { status: 'finished' } },
    new Set(),
    []
  ),
  false
);

assert.equal(
  hostHasActiveHundredRecruitFromSlices(
    host,
    [],
    { 'room-local': { status: 'recruiting', recruitDeadlineAt: recruitDeadline } },
    new Set(),
    ['room-local'],
    { 'room-local': { createdAt: created, recruitDeadlineAt: recruitDeadline } },
    created + 60_000
  ),
  true
);

assert.equal(
  hostHasActiveHundredRecruitFromSlices(host, [{ ...item, hostUid: 'other' }], {}, new Set(), []),
  false
);

assert.equal(
  hostHasActiveHundredRecruitFromSlices(
    host,
    [item],
    {},
    new Set(['room-1']),
    [],
    {},
    created + 60_000
  ),
  false
);

console.log('[hundredHostRecruitLimit.selftest] OK');
