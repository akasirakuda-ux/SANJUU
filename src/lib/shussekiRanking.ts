import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getTotalStampCount, type ShussekiClearSlice } from './shussekiDailyClears';
import { sanitizeRkUsersCloudPayload } from './rkUsersCloudSync';

export type ShussekiRankingRow = {
  uid: string;
  nickname: string;
  userEmoji: string;
  totalStamps: number;
  updatedAtMs: number;
};

function readUpdatedAtMs(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function loadShussekiRankingRows(): Promise<ShussekiRankingRow[]> {
  const snap = await getDocs(collection(db, 'rk_users'));
  const rows: ShussekiRankingRow[] = [];

  for (const d of snap.docs) {
    const uid = d.id;
    const data = d.data() as Record<string, unknown>;
    const sanitized = sanitizeRkUsersCloudPayload({
      uid,
      nickname: typeof data.nickname === 'string' ? data.nickname : '',
      userEmoji: typeof data.userEmoji === 'string' ? data.userEmoji : '',
      totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : Number(data.totalPoints) || 0,
      completedDates: data.completedDates,
      specialDates: data.specialDates,
      dailyClearCounts: data.dailyClearCounts,
      updatedAtMs: readUpdatedAtMs(data.updatedAtMs),
    });
    const shusseki: ShussekiClearSlice = {
      completedDates: sanitized.completedDates,
      specialDates: sanitized.specialDates,
      dailyClearCounts: sanitized.dailyClearCounts,
    };
    const totalStamps = getTotalStampCount(shusseki);
    if (totalStamps <= 0) continue;

    rows.push({
      uid,
      nickname: sanitized.nickname,
      userEmoji: sanitized.userEmoji,
      totalStamps,
      updatedAtMs: sanitized.updatedAtMs,
    });
  }

  rows.sort((a, b) => {
    if (b.totalStamps !== a.totalStamps) return b.totalStamps - a.totalStamps;
    if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
    return a.uid.localeCompare(b.uid);
  });

  return rows;
}
