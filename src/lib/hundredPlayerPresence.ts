import { firestoreLikeToMillis } from './firestoreTime';

/** 盤面上の絵文字行 — この時間以内に動きがなければ「いない」とみなす */
export const HUNDRED_PLAYER_PRESENCE_MS = 90 * 1000;

/** 自分がいることを Firestore に伝える間隔 */
export const HUNDRED_PLAYER_HEARTBEAT_MS = 20 * 1000;

/** 画面側で在室人数を再計算する間隔 */
export const HUNDRED_PLAYER_PRESENCE_TICK_MS = 10 * 1000;

export type HundredRosterPlayer = {
  uid: string;
  name: string;
  emoji: string;
  foundCount: number;
  lastActiveAt?: unknown;
  joinedAt?: unknown;
};

export function isHundredPlayerPresent(
  player: Pick<HundredRosterPlayer, 'lastActiveAt' | 'joinedAt'>,
  nowMs: number,
  windowMs = HUNDRED_PLAYER_PRESENCE_MS,
): boolean {
  const lastMs = firestoreLikeToMillis(player.lastActiveAt);
  const joinedMs = firestoreLikeToMillis(player.joinedAt);
  const seenMs = lastMs ?? joinedMs;
  if (seenMs == null) return false;
  return nowMs - seenMs <= windowMs;
}

/** いま盤面にいそうな人だけ（自分は常に残す） */
export function filterPresentHundredPlayers<T extends HundredRosterPlayer>(
  roster: T[],
  opts?: { nowMs?: number; alwaysIncludeUid?: string | null; windowMs?: number },
): T[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const windowMs = opts?.windowMs ?? HUNDRED_PLAYER_PRESENCE_MS;
  const self = (opts?.alwaysIncludeUid || '').trim();
  return roster.filter(
    (p) => p.uid === self || isHundredPlayerPresent(p, nowMs, windowMs),
  );
}

type HundredPlayerDocLike = {
  id?: string;
  data: () => { lastActiveAt?: unknown; joinedAt?: unknown; name?: unknown; emoji?: unknown };
};

export type CountActiveHundredPlayersOpts = {
  nowMs?: number;
  windowMs?: number;
  isRoboLounge?: boolean;
  roundStartedAt?: unknown;
  foundWords?: Array<{ playerId?: string }>;
};

export function rosterFromHundredPlayerDoc(docSnap: HundredPlayerDocLike): HundredRosterPlayer {
  const x = docSnap.data();
  const uid = typeof docSnap.id === 'string' ? docSnap.id : '';
  return {
    uid,
    name: typeof x.name === 'string' ? x.name : '',
    emoji: typeof x.emoji === 'string' ? x.emoji : '',
    foundCount: 0,
    lastActiveAt: x.lastActiveAt,
    joinedAt: x.joinedAt,
  };
}

/** 待機・一覧用 — 在室＋（ロボ常設なら現行お題の局）だけ数える */
export function countActiveHundredPlayersFromDocs(
  docs: HundredPlayerDocLike[],
  opts?: CountActiveHundredPlayersOpts,
): number {
  const nowMs = opts?.nowMs ?? Date.now();
  const roster = docs.map(rosterFromHundredPlayerDoc).filter((p) => p.uid);
  let active = filterPresentHundredPlayers(roster, {
    nowMs,
    windowMs: opts?.windowMs,
  });
  if (opts?.roundStartedAt != null) {
    active = filterRoboLoungeRoundPlayers(
      active,
      opts.roundStartedAt,
      opts.foundWords ?? [],
      { nowMs, windowMs: opts?.windowMs },
    );
  }
  return active.length;
}

/** players サブコレ — 在室（約90秒以内に動きあり）だけ数える */
export function countPresentHundredPlayerDocs(
  docs: HundredPlayerDocLike[],
  nowMs = Date.now(),
  windowMs = HUNDRED_PLAYER_PRESENCE_MS,
): number {
  return countActiveHundredPlayersFromDocs(docs, { nowMs, windowMs });
}

/** ロボ常設: お題切替直後に前の局の在室が一瞬混ざらないよう、この局以降に動いた人だけ */
export function filterRoboLoungeRoundPlayers<T extends HundredRosterPlayer>(
  roster: T[],
  roundStartedAt: unknown,
  foundWords: Array<{ playerId?: string }>,
  opts?: { nowMs?: number; alwaysIncludeUid?: string | null; windowMs?: number },
): T[] {
  const present = filterPresentHundredPlayers(roster, opts);
  const roundStartedMs = firestoreLikeToMillis(roundStartedAt);
  if (roundStartedMs == null) return present;
  const self = (opts?.alwaysIncludeUid || '').trim();
  const foundUids = new Set(
    foundWords.map((fw) => (fw.playerId || '').trim()).filter(Boolean),
  );
  return present.filter((p) => {
    if (p.uid === self) return true;
    if (foundUids.has(p.uid)) return true;
    const lastMs =
      firestoreLikeToMillis(p.lastActiveAt) ?? firestoreLikeToMillis(p.joinedAt) ?? 0;
    return lastMs >= roundStartedMs - 3000;
  });
}

/** 盤面上 — ひとりのときは正直に、複数なら人数を伝える */
export function hundredPresenceStatusLine(presentCount: number): string | null {
  if (presentCount <= 0) return null;
  if (presentCount === 1) return 'だれか来るかもしれません。';
  return `いま ${presentCount}人 いっしょに探しています`;
}
