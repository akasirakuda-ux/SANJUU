import type { Message } from '../components/Renrakucho/types';
import { firestoreLikeToMillis } from './firestoreTime';

/** らくだ管理者宛の非公開伝言（create 時に付与 — 将来の絞り込み用） */
export const RENRAKU_PRIVATE_INBOX_RAKUDA = 'rakuda_admin' as const;

export function sortRenrakuPrivateMessagesNewestFirst(msgs: Message[]): Message[] {
  return [...msgs].sort((a, b) => {
    const ta = firestoreLikeToMillis(a.createdAt) ?? 0;
    const tb = firestoreLikeToMillis(b.createdAt) ?? 0;
    return tb - ta;
  });
}
