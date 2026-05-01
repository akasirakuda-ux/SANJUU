import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, MailOpen, Trash2, UserX, UserCheck } from 'lucide-react';
import { btnGhost } from '../../ui/policy';
import { formatFirestoreTimeJa } from '../../lib/firestoreTime';
import { renrakuPrivateModerationBadge } from '../../lib/renrakuPrivateStatusBadge';
import type { BlockedUser, Message } from './types';

/** 全角おおよそ10文字分まで省略しにくくする（長文は折り返し） */
const nameChipClass =
  'text-xs font-medium text-slate-800 bg-white px-2 py-1 rounded-xl border border-amber-200 break-words whitespace-normal max-w-[min(100%,28ch)]';

type AdminPublicItem = (Message & { type: 'community' | 'recruit' });

const AdminScreen: React.FC<{
  privateMessages: Message[];
  /** 掲示板（public_messages） */
  boardMessages: Message[];
  /** 募集（renraku_public type===recruit） */
  recruitMessages: Message[];
  blockedUsers: BlockedUser[];
  toggleRead: (id: string, currentRead: boolean) => void | Promise<void>;
  handleDelete: (id: string, target: 'community' | 'recruit' | 'private') => void | Promise<void>;
  handleBlock: (userId: string, userName: string) => void | Promise<void>;
  /** 通報対応: 同一投稿者 uid の投稿を一括 blocked */
  handleBulkBlockAuthorPosts: (authorUid: string, authorName?: string) => void | Promise<void>;
  handleUnblock: (userId: string) => void | Promise<void>;
  onSendReplyEmoji: (messageId: string, emoji: string) => void | Promise<void>;
}> = ({
  privateMessages,
  boardMessages,
  recruitMessages,
  blockedUsers,
  toggleRead,
  handleDelete,
  handleBlock,
  handleBulkBlockAuthorPosts,
  handleUnblock,
  onSendReplyEmoji,
}) => {
  const isStreamMode = useMemo(() => {
    try {
      return window.localStorage.getItem('rk_stream_mode') === '1';
    } catch {
      return false;
    }
  }, []);

  const [replyDraftById, setReplyDraftById] = useState<Record<string, string>>({});
  const [sendingById, setSendingById] = useState<Record<string, boolean>>({});
  const [replyStatusById, setReplyStatusById] = useState<Record<string, 'ok' | 'ng' | undefined>>({});

  const initialDraftById = useMemo(() => {
    const next: Record<string, string> = {};
    for (const m of privateMessages) {
      const msg = m as any;
      next[m.id] = String((msg.replyMessage ?? msg.replyEmoji ?? '') as string);
    }
    return next;
  }, [privateMessages]);

  const getDraft = (id: string) => (id in replyDraftById ? replyDraftById[id] : initialDraftById[id] ?? '');

  const setDraft = (id: string, v: string) => {
    setReplyDraftById((prev) => ({ ...prev, [id]: String(v ?? '') }));
  };

  const adminPublicItems = useMemo((): AdminPublicItem[] => {
    const merged: AdminPublicItem[] = [
      ...boardMessages.map((m) => ({ ...m, type: 'community' as const })),
      ...recruitMessages.map((m) => ({ ...m, type: 'recruit' as const })),
    ];
    return merged.slice(0, 60);
  }, [boardMessages, recruitMessages]);

  const sendReply = async (id: string) => {
    const text = String(getDraft(id) ?? '').trim();
    if (!text) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '返信メッセージを入れてね' }));
      return;
    }
    if (sendingById[id]) return;
    setSendingById((p) => ({ ...p, [id]: true }));
    setReplyStatusById((p) => ({ ...p, [id]: undefined }));
    try {
      await onSendReplyEmoji(id, text);
      setReplyStatusById((p) => ({ ...p, [id]: 'ok' }));
    } catch {
      setReplyStatusById((p) => ({ ...p, [id]: 'ng' }));
    } finally {
      setSendingById((p) => ({ ...p, [id]: false }));
    }
  };

  return (
    <motion.div
      key="admin"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8 max-w-lg mx-auto pb-24 md:pb-28"
    >
      <section className="rounded-2xl border-2 border-slate-300 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-500 uppercase tracking-widest">配信モード</div>
            <div className="text-sm font-black text-slate-800">YouTube LIVE 安定化（軽量化）</div>
            <div className="mt-1 text-[11px] font-bold text-slate-600">
              {isStreamMode ? 'ON（広告・一部リアルタイム購読を抑制）' : 'OFF（通常）'}
            </div>
            <ul className="mt-2 text-[11px] font-bold text-slate-600 space-y-1">
              <li>・固定バナー広告を止めます</li>
              <li>・掲示板/みんなであそぶの一部リアルタイム購読・更新頻度を下げます</li>
              <li>・ゲーム中（マルチプレイ）のバナーは常に非表示です（全面広告は別）</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                const next = window.localStorage.getItem('rk_stream_mode') === '1' ? '0' : '1';
                window.localStorage.setItem('rk_stream_mode', next);
              } catch {
                // ignore
              }
              window.location.reload();
            }}
            className={`${btnGhost} px-3 py-2 font-black`}
            title="配信モードを切り替えます（再読み込みします）"
          >
            {isStreamMode ? 'OFFにする' : 'ONにする'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
            <Lock size={16} /> らくだへの伝言
          </h3>
        </div>
        {privateMessages.length === 0 ? (
          <div className="text-center py-10 text-slate-300 text-xs font-bold">伝言はありません</div>
        ) : (
          privateMessages.map((msg) => {
            const mod = renrakuPrivateModerationBadge(msg);
            return (
              <div
                key={msg.id}
                className={`rounded-xl p-3 shadow-sm border-2 border-red-600 bg-amber-50 transition-colors ${
                  msg.isRead ? 'opacity-70' : ''
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className={nameChipClass}>{msg.fromUser}</span>
                        {mod ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${mod.className}`}>
                            {mod.text}
                          </span>
                        ) : null}
                        {!msg.isRead ? (
                          <span className="w-2 h-2 bg-rose-400 rounded-full animate-pulse shrink-0" title="未読" />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1.5 sm:flex-col sm:items-end sm:justify-start sm:pt-0.5">
                      <button
                        type="button"
                        onClick={() => toggleRead(msg.id, !!msg.isRead)}
                        className={`p-2 rounded-xl transition-colors border ${
                          msg.isRead
                            ? 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
                            : 'text-slate-800 bg-amber-100 border-amber-300 hover:bg-amber-100'
                        }`}
                        title={msg.isRead ? '未読にする' : '既読にする'}
                      >
                        {msg.isRead ? <MailOpen size={18} /> : <Mail size={18} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id, 'private')}
                        className="p-2 text-slate-600 hover:text-rose-600 transition-colors rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                        title="削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-800 break-words pr-0 sm:pr-1">{msg.message}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">返信</div>
                      {(msg as any).replyMessage ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
                          送信済み{(msg as any).replyAt ? `（${formatFirestoreTimeJa((msg as any).replyAt)}）` : ''}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <textarea
                        value={getDraft(msg.id)}
                        onChange={(e) => setDraft(msg.id, e.target.value)}
                        rows={3}
                        className="min-w-[14rem] w-[min(60vw,22rem)] h-16 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                        aria-label="返信メッセージ"
                      />
                      <button
                        type="button"
                        disabled={sendingById[msg.id]}
                        onClick={() => void sendReply(msg.id)}
                        className="h-9 px-3 rounded-lg border border-amber-200 bg-white text-amber-900 text-[11px] font-black shadow-sm hover:bg-amber-50 disabled:opacity-60"
                      >
                        {sendingById[msg.id] ? '送信中…' : '返信を送る'}
                      </button>
                    </div>
                  </div>
                  {replyStatusById[msg.id] ? (
                    <div
                      className={`text-[11px] font-bold ${
                        replyStatusById[msg.id] === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {replyStatusById[msg.id] === 'ok' ? '返信を保存しました' : '送信に失敗しました'}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-red-200/50">
                    <span className="text-[10px] text-slate-500 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleBlock(msg.fromUserUid || msg.id, msg.fromUser)}
                      className="text-[10px] font-bold text-slate-700 hover:text-rose-700 flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white/90 hover:bg-rose-50 shrink-0"
                    >
                      <UserX size={12} /> このユーザーをブロック
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
            🧹 掲示板の投稿（管理）
          </h3>
        </div>
        {adminPublicItems.length === 0 ? (
          <div className="text-center py-10 text-slate-300 text-xs font-bold">投稿はありません</div>
        ) : (
          <div className="space-y-2">
            {adminPublicItems.map((msg) => {
              const canBlock = !!msg.fromUserUid;
              return (
                <div key={`${msg.type}:${msg.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={nameChipClass}>{msg.fromUser}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 shrink-0">
                          {msg.type === 'community' ? '掲示' : '募集'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-slate-800 break-words">
                        {String((msg as any).message ?? '')}
                      </p>
                      <div className="mt-2 text-[10px] text-slate-500">{formatFirestoreTimeJa((msg as any).createdAt)}</div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={!canBlock}
                        onClick={() => {
                          const uid = msg.fromUserUid;
                          if (uid) void handleBulkBlockAuthorPosts(uid, msg.fromUser);
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        ブロック
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(String(msg.id), msg.type)}
                        className="p-2 text-slate-600 hover:text-rose-600 transition-colors rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                        title="削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="scroll-mt-4 rounded-2xl border-2 border-slate-500 bg-neutral-100 p-4 shadow-lg ring-1 ring-black/10"
        aria-labelledby="admin-blocklist-heading"
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-2xl leading-none select-none" aria-hidden>
            👤
          </span>
          <span className="text-2xl leading-none select-none" aria-hidden>
            🚫
          </span>
          <h3 id="admin-blocklist-heading" className="text-base font-black text-gray-900 tracking-tight">
            出禁リスト
          </h3>
        </div>
        <p className="text-xs font-bold text-gray-800 mb-4">掲示板からブロックした利用者がここに表示されます</p>
        {blockedUsers.length === 0 ? (
          <div className="text-center py-8 px-3 text-gray-900 text-sm font-bold bg-white rounded-xl border-2 border-slate-400">
            ブロック中のユーザーはいません
          </div>
        ) : (
          <div className="rounded-xl border-2 border-slate-500 bg-white overflow-hidden shadow-inner">
            {blockedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 break-words max-w-[min(100%,28ch)]">{user.userName}</p>
                  <p className="text-[10px] text-gray-700 font-medium mt-1">{formatFirestoreTimeJa(user.blockedAt)} にブロック</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(user.id)}
                  className={`${btnGhost} flex items-center gap-1 shrink-0 text-gray-900 border-slate-400`}
                >
                  <UserCheck size={14} /> 解除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
};

export default AdminScreen;
