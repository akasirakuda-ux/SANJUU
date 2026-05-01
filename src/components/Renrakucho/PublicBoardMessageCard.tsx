import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Pin } from 'lucide-react';
import { db } from '../../firebase';
import { formatFirestoreTimeJa } from '../../lib/firestoreTime';
import type { Message } from './types';
import MentionText from './MentionText';

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
      className={`bg-white rounded-xl p-3 shadow-sm border relative group ${
        msg.pinned ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <div className="flex gap-2 items-start mb-2">
        <span className="text-xl leading-none shrink-0" aria-hidden>
          {msg.fromUserEmoji || '💬'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-start gap-2 mb-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-[min(100%,32ch)]">
              <span className="text-xs font-medium text-slate-700 bg-amber-50 px-2 py-1 rounded-xl border border-amber-200 break-words whitespace-normal inline-flex items-center gap-1">
                {msg.pinned ? (
                  <Pin className="w-3.5 h-3.5 text-amber-700 shrink-0" strokeWidth={2.5} aria-hidden />
                ) : null}
                {msg.fromUser}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
          </div>
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-700">
            <MentionText text={String(msg.message ?? '')} />
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleReaction}
              disabled={isInteractionBlocked}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                likedByMe
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              いいね
            </button>
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
                  className="px-2 py-1 rounded-lg border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                >
                  {msg.pinned ? 'ピン留め解除' : 'ピン留め'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDelete}
                disabled={isInteractionBlocked || (msg as any).pinned === true}
                className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:pointer-events-none"
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
