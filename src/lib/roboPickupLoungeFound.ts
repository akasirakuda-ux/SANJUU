import { normalizeHundredFoundList } from './hundredFoundNormalize';

import {

  countPlacedWordOccurrences,

  countUniqueFoundOccurrences,

} from './hundredPickupOccurrences';



/** いまのお題で uid が1つでも見つけたか */

export function userFoundInRoboLoungeRound(foundWords: unknown, uid: string | null | undefined): boolean {

  const id = (uid || '').trim();

  if (!id) return false;

  return normalizeHundredFoundList(foundWords).some((fw) => fw.playerId === id);

}



/** 部屋全体でお題の出現をすべて見つけたか（協力プレイ） */

export function isRoboLoungeRoundComplete(foundWords: unknown, placedWords: unknown): boolean {

  const total = countPlacedWordOccurrences(placedWords);

  if (total <= 0) {
    // 終了処理で words だけ消えたあと playing が残る — foundWords があれば終了扱い
    return normalizeHundredFoundList(foundWords).length > 0;
  }

  const found = countUniqueFoundOccurrences(normalizeHundredFoundList(foundWords));

  return found >= total;

}



function validMs(v: number | null | undefined): v is number {

  return typeof v === 'number' && Number.isFinite(v) && v > 0;

}



/** ヒント／お題差し替えの「最後に進捗があった時刻」 */

export function resolveRoboLoungeIdleReferenceMs(

  foundWords: unknown,

  placedWords: unknown,

  startedAtMs: number | null | undefined,

  lastFoundAtMs: number | null | undefined,

  updatedAtMs?: number | null,

): number | null {

  if (!validMs(startedAtMs)) return null;



  const found = normalizeHundredFoundList(foundWords);

  if (found.length === 0) return startedAtMs;



  if (validMs(lastFoundAtMs)) return lastFoundAtMs;



  const total = countPlacedWordOccurrences(placedWords);

  const foundCount = countUniqueFoundOccurrences(found);

  if (total > 0 && foundCount >= total - 1 && foundCount < total) {

    // ラスト1語付近 — playerCount 更新で updatedAt が動いても startedAt で判定

    return startedAtMs;

  }



  if (validMs(updatedAtMs)) return updatedAtMs;

  return startedAtMs;

}



/** 放置判定 — 一定時間、新しいことばが誰にも見つかっていない（0/68 も 67/68 も） */

export function isRoboLoungeRoundIdle(

  foundWords: unknown,

  placedWords: unknown,

  startedAtMs: number | null | undefined,

  lastFoundAtMs: number | null | undefined,

  nowMs: number,

  idleMs: number,

  updatedAtMs?: number | null,

): boolean {

  if (isRoboLoungeRoundComplete(foundWords, placedWords)) return false;

  const referenceMs = resolveRoboLoungeIdleReferenceMs(

    foundWords,

    placedWords,

    startedAtMs,

    lastFoundAtMs,

    updatedAtMs,

  );

  if (!referenceMs) return false;

  return nowMs - referenceMs >= idleMs;

}



/** @deprecated 互換 — isRoboLoungeRoundIdle を使う */

export function isRoboLoungeRoundAbandoned(

  foundWords: unknown,

  startedAtMs: number | null | undefined,

  nowMs: number,

  idleMs = 15 * 60 * 1000,

  opts?: {

    placedWords?: unknown;

    lastFoundAtMs?: number | null;

    updatedAtMs?: number | null;

  },

): boolean {

  return isRoboLoungeRoundIdle(

    foundWords,

    opts?.placedWords,

    startedAtMs,

    opts?.lastFoundAtMs,

    nowMs,

    idleMs,

    opts?.updatedAtMs,

  );

}



/** 手動「次のお題へ」: 自分が1つ以上見つけた ＋ 部屋で全出現クリア */

export function canRequestRoboLoungeNext(

  foundWords: unknown,

  placedWords: unknown,

  uid: string | null | undefined,

): boolean {

  if (!userFoundInRoboLoungeRound(foundWords, uid)) return false;

  return isRoboLoungeRoundComplete(foundWords, placedWords);

}


