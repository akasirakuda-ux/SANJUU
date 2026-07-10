import React from 'react';
import { Lock } from 'lucide-react';
import { formatFirestoreTimeJa, renrakuPrivateModerationBadge } from '../../lib/rakudaHubShell';
import type { Message } from './types';
import RenrakuMessageBody from './RenrakuMessageBody';
import RenrakuCopyTextButton from './RenrakuCopyTextButton';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';

/**
 * 管理者タイムライン用: renraku_private（らくだ先生宛・非公開）
 */
const PrivateTimelineCard: React.FC<{
  msg: Message;
  currentUid: string | undefined;
  isAdmin: boolean;
  onDelete: () => void;
}> = ({ msg, currentUid, isAdmin, onDelete }) => {
  const mod = renrakuPrivateModerationBadge(msg);
  const isMine = !!currentUid && currentUid === (msg as { fromUserUid?: string }).fromUserUid;

  return (
    <div className="rounded-xl p-3 shadow-md border-4 border-rk-red-600 bg-rk-amber-50/95 relative group">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-wider text-rk-red-800">
        <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        <span>らくだ珈琲宛（非公開）</span>
      </div>
      <div className="flex justify-between items-start gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`text-xs font-medium bg-rk-white/90 px-2 py-1 rounded-xl border border-rk-rose-200 break-words whitespace-normal max-w-[min(100%,28ch)] ${
              isMine ? RK_GATE_NICK_DISPLAY_CLASS : 'text-rk-slate-800'
            }`}
          >
            {msg.fromUser}
          </span>
          {mod ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${mod.className}`}>{mod.text}</span>
          ) : null}
        </div>
        <span className="text-[10px] text-rk-rose-700/80 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
      </div>
      <RenrakuMessageBody
        text={String(msg.message ?? '')}
        className="text-xs leading-relaxed whitespace-pre-wrap text-rk-slate-800 mb-2"
      />
      <RenrakuCopyTextButton text={String(msg.message ?? '')} variant="link" className="mb-2" />
      {isAdmin ? (
        <div className="flex justify-end gap-1.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 rounded-lg border border-rk-rose-300 text-rk-rose-800 bg-rk-white hover:bg-rk-rose-50"
          >
            削除
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PrivateTimelineCard;
