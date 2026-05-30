import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Pin } from 'lucide-react';
import { db } from '../../firebase';
import { formatFirestoreTimeJa } from '../../lib/rakudaHubShell';
import type { Message } from './types';
import RenrakuReportButton from './RenrakuReportButton';
import RenrakuMessageBody from './RenrakuMessageBody';
import RenrakuCopyTextButton from './RenrakuCopyTextButton';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../../lib/rakudaGate';
import { renrakuBoardPostElementId } from '../../lib/renrakuReport';

export type PublicBoardMessageCardProps = {
  msg: Message;
  currentUid: string | undefined;
  isAdmin: boolean;
  isInteractionBlocked: boolean;
  onDelete: () => void;
  onToggleReaction: () => void;
  onTogglePin: () => void;
};

/**
 * public_messages 用カード：ニックネーム・絵文字・本文・メンション・いいね（絵文字一覧）
 */
const PublicBoardMessageCard: React.FC<PublicBoardMessageCardProps> = ({
  msg,
  currentUid,
  isAdmin,
  isInteractionBlocked,
  onDelete,
  onToggleReaction,
  onTogglePin,
}) => {
  const [reactions, setReactions] = useState<{ uid: string; emoji: string }[]>([]);

  useEffect(() => {
    const col = collection(db, 'public_messages', msg.id, 'reactions');
    const unsub = onSnapshot(col, (snap) => {
      setReactions(
        snap.docs.map((d) => ({
          uid: d.id,
          emoji: typeof (d.data() as { emoji?: unknown }).emoji === 'string' ? (d.data() as { emoji: string }).emoji : '👍',
        }))
      );
    });
    return () => unsub();
  }, [msg.id]);

  const likedByMe = currentUid ? reactions.some((r) => r.uid === currentUid) : false;
  const isMine = !!currentUid && currentUid === (msg as any).fromUserUid;

  return (
    <div
      id={renrakuBoardPostElementId(msg.id)}
      className={`scroll-mt-4 bg-rk-white rounded-xl p-3 shadow-sm border relative group ${
        msg.pinned ? 'border-rk-amber-300 ring-1 ring-rk-amber-100' : 'border-rk-slate-200'
      }`}
    >
      <div className="flex gap-2 items-start mb-2">
        <span className="text-xl leading-none shrink-0" aria-hidden>
          {msg.fromUserEmoji || '💬'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-start gap-2 mb-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-[min(100%,32ch)]">
              <span
                className={`text-xs font-medium bg-rk-amber-50 px-2 py-1 rounded-xl border border-rk-amber-200 break-words whitespace-normal inline-flex items-center gap-1 ${
                  isMine ? RK_GATE_NICK_DISPLAY_CLASS : 'text-rk-slate-700'
                }`}
              >
                {msg.pinned ? (
                  <Pin className="w-3.5 h-3.5 text-rk-amber-700 shrink-0" strokeWidth={2.5} aria-hidden />
                ) : null}
                {msg.fromUser}
              </span>
            </div>
            <span className="text-[10px] text-rk-slate-400 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
          </div>
          <RenrakuMessageBody text={String(msg.message ?? '')} />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RenrakuCopyTextButton text={String(msg.message ?? '')} />
            <button
              type="button"
              onClick={onToggleReaction}
              disabled={isInteractionBlocked}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                likedByMe
                  ? 'border-rk-sky-300 bg-rk-sky-50 text-rk-sky-800'
                  : 'border-rk-slate-200 bg-rk-slate-50 text-rk-slate-600 hover:bg-rk-slate-100'
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              いいね
            </button>
            <RenrakuReportButton
              targetType="public_messages"
              targetId={msg.id}
              authorUid={msg.fromUserUid}
              reporterUid={currentUid}
              interactionBlocked={isInteractionBlocked}
            />
            {reactions.length > 0 ? (
              <div className="flex flex-wrap gap-1 items-center" aria-label="いいねした人の絵文字">
                {reactions.map((r) => (
                  <span
                    key={r.uid}
                    className="text-base leading-none"
                    title="いいね"
                  >
                    {r.emoji}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {isAdmin || isMine ? (
            <div className="mt-2 flex flex-wrap justify-end gap-1.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className="px-2 py-1 rounded-lg border border-rk-amber-300 text-rk-amber-900 bg-rk-amber-50 hover:bg-rk-amber-100"
                >
                  {msg.pinned ? 'ピン留め解除' : 'ピン留め'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDelete}
                disabled={isInteractionBlocked || (msg as any).pinned === true}
                className="px-2 py-1 rounded-lg border border-rk-rose-200 text-rk-rose-700 bg-rk-rose-50 hover:bg-rk-rose-100 disabled:opacity-40 disabled:pointer-events-none"
              >
                削除
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PublicBoardMessageCard;
