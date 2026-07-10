import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { computeStampsFromLogs } from './stampMigration';
import type { LogEntry } from '../types';

export const RK_SHUSSEKI_DATES_BACKUP_KEY = 'rk_shusseki_dates_backup_v1';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function uniqShussekiDateKeys(arrays: string[][]): string[] {
  const seen = new Set<string>();
  for (const arr of arrays) {
    for (const raw of arr) {
      const key = String(raw ?? '').trim();
      if (DATE_KEY_RE.test(key)) seen.add(key);
    }
  }
  return Array.from(seen).sort();
}

export function readLocalShussekiSnapshots(): string[][] {
  const buckets: string[][] = [];
  const keys = ['rk_shusseki_dates_backup_v1', 'word_search_user_v2', 'word_search_users_v1'];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (key === RK_SHUSSEKI_DATES_BACKUP_KEY) {
        if (Array.isArray(parsed)) {
          buckets.push(parsed.filter((x): x is string => typeof x === 'string'));
        }
        continue;
      }
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && Array.isArray((item as { completedDates?: unknown }).completedDates)) {
            buckets.push((item as { completedDates: string[] }).completedDates);
          }
        }
        continue;
      }
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { completedDates?: unknown }).completedDates)) {
        buckets.push((parsed as { completedDates: string[] }).completedDates);
      }
    } catch {
      /* ignore corrupt snapshot */
    }
  }

  return buckets;
}

export function persistShussekiDatesBackup(completedDates: string[] | undefined): void {
  const merged = uniqShussekiDateKeys([completedDates ?? []]);
  if (merged.length === 0) return;
  try {
    const prevRaw = localStorage.getItem(RK_SHUSSEKI_DATES_BACKUP_KEY);
    const prev = prevRaw ? (JSON.parse(prevRaw) as string[]) : [];
    const next = uniqShussekiDateKeys([prev, merged]);
    localStorage.setItem(RK_SHUSSEKI_DATES_BACKUP_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

async function fetchFirestoreClearLogs(uid: string, maxItems = 2000): Promise<LogEntry[]> {
  const logsRef = collection(db, 'users', uid, 'logs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(maxItems));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as LogEntry);
}

export async function gatherRecoveredShussekiDates(params: {
  uid: string | null;
  currentDates: string[];
  localLogs: LogEntry[];
}): Promise<string[]> {
  const buckets: string[][] = [params.currentDates, ...readLocalShussekiSnapshots()];

  buckets.push(computeStampsFromLogs({ logs: params.localLogs }).completedDates);

  if (params.uid) {
    try {
      const userSnap = await getDoc(doc(db, 'rk_users', params.uid));
      if (userSnap.exists()) {
        const d = userSnap.data() as Record<string, unknown>;
        if (Array.isArray(d.completedDates)) {
          buckets.push(d.completedDates.filter((x): x is string => typeof x === 'string'));
        }
      }

      const firestoreLogs = await fetchFirestoreClearLogs(params.uid);
      const byId = new Map<string, LogEntry>();
      for (const log of [...firestoreLogs, ...params.localLogs]) {
        if (log?.id) byId.set(log.id, log);
      }
      buckets.push(computeStampsFromLogs({ logs: Array.from(byId.values()) }).completedDates);
    } catch (e) {
      console.warn('[shussekiRecovery] cloud gather failed', e);
    }
  }

  return uniqShussekiDateKeys(buckets);
}
