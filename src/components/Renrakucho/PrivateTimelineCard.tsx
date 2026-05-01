import React from 'react';
import { Lock } from 'lucide-react';
import { formatFirestoreTimeJa } from '../../lib/firestoreTime';
import { renrakuPrivateModerationBadge } from '../../lib/renrakuPrivateStatusBadge';
import type { Message } from './types';
import MentionText from './MentionText';

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

  return (
    <div className="rounded-xl p-3 shadow-md border-4 border-red-600 bg-amber-50/95 relative group">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-wider text-red-800">
        <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        <span>らくだ先生宛（非公開）</span>
      </div>
      <div className="flex justify-between items-start gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-slate-800 bg-white/90 px-2 py-1 rounded-xl border border-rose-200 break-words whitespace-normal max-w-[min(100%,28ch)]">
            {msg.fromUser}
          </span>
          {mod ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${mod.className}`}>{mod.text}</span>
          ) : null}
        </div>
        <span className="text-[10px] text-rose-700/80 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
      </div>
      <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-800 mb-3">
        <MentionText text={String(msg.message ?? '')} />
      </p>
      {isAdmin ? (
        <div className="flex justify-end gap-1.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 rounded-lg border border-rose-300 text-rose-800 bg-white hover:bg-rose-50"
          >
            削除
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PrivateTimelineCard;
