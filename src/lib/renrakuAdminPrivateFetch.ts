import { collection, getDocs, limit, query, type QuerySnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Message } from '../components/Renrakucho/types';
import { db } from '../firebase';
import { ensureRenrakuAdminFirestoreAuth } from './renrakuAdmin';
import { sortRenrakuPrivateMessagesNewestFirst } from './renrakuPrivateInbox';

const ADMIN_PRIVATE_LIMIT = 200;

function mapPrivateSnapshot(snapshot: QuerySnapshot): Message[] {
  return sortRenrakuPrivateMessagesNewestFirst(
    snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message))
  );
}

export type AdminPrivateFetchResult =
  | { ok: true; messages: Message[] }
  | { ok: false; code: 'not-admin' | 'permission-denied' | 'error'; error?: unknown };

/**
 * 管理者の renraku_private 一覧を取得（トークン更新 → getDocs、失敗時は1回だけ再試行）。
 */
export async function fetchRenrakuPrivateForAdmin(user: User): Promise<AdminPrivateFetchResult> {
  const authed = await ensureRenrakuAdminFirestoreAuth(user);
  if (!authed) return { ok: false, code: 'not-admin' };

  const q = query(collection(db, 'renraku_private'), limit(ADMIN_PRIVATE_LIMIT));

  const attempt = async (): Promise<AdminPrivateFetchResult> => {
    try {
      const snapshot = await getDocs(q);
      return { ok: true, messages: mapPrivateSnapshot(snapshot) };
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'permission-denied') {
        return { ok: false, code: 'permission-denied', error };
      }
      return { ok: false, code: 'error', error };
    }
  };

  const first = await attempt();
  if (first.ok === true) return first;
  if (first.code !== 'permission-denied') return first;

  await ensureRenrakuAdminFirestoreAuth(user);
  return await attempt();
}
