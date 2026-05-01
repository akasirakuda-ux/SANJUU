import type { Message } from '../components/Renrakucho/types';
import { RENRAKU_STATUS_BLOCKED, RENRAKU_STATUS_DELETED } from './renrakuVisibility';

/** 管理者一覧・タイムライン用: 非公開メッセージのモデレーション表示 */
export function renrakuPrivateModerationBadge(msg: Message): { text: string; className: string } | null {
  if (msg.status === RENRAKU_STATUS_DELETED) {
    return { text: '削除済み', className: 'border-rose-200 bg-rose-50 text-rose-800' };
  }
  if (msg.status === RENRAKU_STATUS_BLOCKED) {
    return { text: 'ブロック済み', className: 'border-amber-300 bg-amber-50 text-amber-900' };
  }
  return null;
}
