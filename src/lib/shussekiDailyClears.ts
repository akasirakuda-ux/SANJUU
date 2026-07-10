import { todayKeyJst } from './dateKey';
import type { UserAccount } from '../types';

export type ShussekiClearSlice = Pick<UserAccount, 'completedDates' | 'specialDates' | 'dailyClearCounts'>;

function uniqSorted(dates: string[]): string[] {
  const s = new Set<string>();
  for (const d of dates) {
    const k = String(d || '').trim();
    if (k) s.add(k);
  }
  return Array.from(s).sort();
}

export function allShussekiDateKeys(user: ShussekiClearSlice): string[] {
  const keys = new Set<string>(user.completedDates ?? []);
  for (const key of Object.keys(user.dailyClearCounts ?? {})) {
    if (key && (user.dailyClearCounts?.[key] ?? 0) > 0) keys.add(key);
  }
  return Array.from(keys).sort();
}

/** その日にスタンプがあるか（1日1スタンプ。旧 dailyClearCounts は有無のみ見る） */
export function getDayClearCount(user: ShussekiClearSlice, dateKey: string): number {
  if ((user.completedDates ?? []).includes(dateKey)) return 1;
  const legacy = user.dailyClearCounts?.[dateKey];
  if (typeof legacy === 'number' && legacy > 0) return 1;
  return 0;
}

/** 出席した日数（プレイ回数の合算はしない） */
export function getTotalStampCount(user: ShussekiClearSlice): number {
  return allShussekiDateKeys(user).length;
}

export function isSpecialStampDay(user: ShussekiClearSlice, dateKey: string): boolean {
  return (user.specialDates ?? []).includes(dateKey);
}

export function syncSpecialDates(user: ShussekiClearSlice): string[] {
  return uniqSorted([...(user.specialDates ?? [])]);
}

/**
 * ゲームプレイ後：その日のスタンプがまだなければ1つだけ付与（2回目以降は加算しない）
 * @returns todayCount — 今回新しく付いたとき 1、もともとあった日 0
 */
export function recordShussekiGamePlay(
  user: UserAccount,
  dateKey: string = todayKeyJst(),
): { user: UserAccount; todayCount: number } {
  if (getDayClearCount(user, dateKey) > 0) {
    return { user, todayCount: 0 };
  }

  const completedDates = uniqSorted([...(user.completedDates ?? []), dateKey]);
  const draft: UserAccount = {
    ...user,
    completedDates,
  };

  return {
    user: {
      ...draft,
      specialDates: syncSpecialDates(draft),
    },
    todayCount: 1,
  };
}

/** @deprecated {@link recordShussekiGamePlay} を使う */
export const recordSlidePuzzleDailyClear = recordShussekiGamePlay;
