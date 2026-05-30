import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Lock, Mail, MailOpen, Trash2, UserX, UserCheck } from 'lucide-react';
import RevenueSimulator from '../admin/RevenueSimulator';
import GreenGateMemberList from '../admin/GreenGateMemberList';
import ShussekiRankingList from '../admin/ShussekiRankingList';
import { btnGhost } from '../../ui/policy';
import RenrakuMessageBody from './RenrakuMessageBody';
import RenrakuCopyTextButton from './RenrakuCopyTextButton';
import {
  fetchRenrakuReportAuthor,
  RENRAKU_REPORT_TARGET_LABELS,
  renrakuReportDeleteTarget,
  renrakuReportReasonLabelJa,
  resolveRenrakuReportTargetMessage,
  type RenrakuReportRecord,
} from '../../lib/renrakuReport';
import {
  formatFirestoreTimeJa,
  renrakuPrivateModerationBadge,
  resolveRenrakuPrivateReplyText,
  type RenrakuPrivateReplyPayload,
} from '../../lib/rakudaHubShell';
import type { AdminPrivateInboxLoadState, BlockedUser, Message } from './types';

/** 全角おおよそ10文字分まで省略しにくくする（長文は折り返し） */
const nameChipClass =
  'text-xs font-medium text-rk-slate-800 bg-rk-white px-2 py-1 rounded-xl border border-rk-amber-200 break-words whitespace-normal max-w-[min(100%,28ch)]';

type AdminPublicItem = (Message & { type: 'community' | 'recruit' });

const AdminScreen: React.FC<{
  privateMessages: Message[];
  adminPrivateLoadState?: AdminPrivateInboxLoadState;
  onReloadAdminInbox?: () => void;
  onRequestGoogleLogin?: () => void;
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
  renrakuReports?: RenrakuReportRecord[];
  adminReportsLoadState?: AdminPrivateInboxLoadState;
  privateReplyByMessageId: Record<string, RenrakuPrivateReplyPayload>;
  onSendPrivateReply: (messageId: string, text: string) => void | Promise<void>;
}> = ({
  privateMessages,
  adminPrivateLoadState = 'idle',
  onReloadAdminInbox,
  onRequestGoogleLogin,
  boardMessages,
  recruitMessages,
  blockedUsers,
  toggleRead,
  handleDelete,
  handleBlock,
  handleBulkBlockAuthorPosts,
  handleUnblock,
  renrakuReports = [],
  adminReportsLoadState = 'idle',
  privateReplyByMessageId,
  onSendPrivateReply,
}) => {
  const [replyDraftById, setReplyDraftById] = useState<Record<string, string>>({});
  const [sendingById, setSendingById] = useState<Record<string, boolean>>({});
  const [replyStatusById, setReplyStatusById] = useState<Record<string, 'ok' | 'ng' | undefined>>({});
  const [reportActionBusyId, setReportActionBusyId] = useState<string | null>(null);

  const initialDraftById = useMemo(() => {
    const next: Record<string, string> = {};
    for (const m of privateMessages) {
      next[m.id] = resolveRenrakuPrivateReplyText(m, privateReplyByMessageId[m.id]);
    }
    return next;
  }, [privateMessages, privateReplyByMessageId]);

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
      await onSendPrivateReply(id, text);
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
      <RevenueSimulator />

      <GreenGateMemberList />

      <ShussekiRankingList />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
            <Flag size={16} className="text-rk-rose-600" /> 通報一覧
          </h3>
          <span className="text-[10px] font-bold text-rk-slate-500">
            {renrakuReports.length > 0 ? `${renrakuReports.length}件` : ''}
          </span>
        </div>
        {adminReportsLoadState === 'loading' ? (
          <p className="text-center py-6 text-rk-slate-400 text-xs font-bold">読み込み中…</p>
        ) : null}
        {adminReportsLoadState === 'denied' ? (
          <div className="rounded-xl border-2 border-rk-red-500 bg-rk-red-50 px-3 py-4 text-xs font-bold text-rk-red-900 leading-relaxed">
            通報一覧を取得できません。Google 管理者ログインを確認してください。
          </div>
        ) : null}
        {adminReportsLoadState !== 'loading' && adminReportsLoadState !== 'denied' && renrakuReports.length === 0 ? (
          <div className="text-center py-10 text-rk-slate-300 text-xs font-bold">通報はありません</div>
        ) : null}
        {renrakuReports.length > 0 ? (
          <div className="space-y-2">
            {renrakuReports.map((report) => {
              const targetMsg = resolveRenrakuReportTargetMessage(
                report,
                boardMessages,
                recruitMessages,
                privateMessages,
              );
              const targetPreview = targetMsg ? String(targetMsg.message ?? '') : '';
              const busy = reportActionBusyId === report.id;
              return (
                <div
                  key={report.id}
                  className="rounded-xl border-2 border-rk-rose-300 bg-rk-rose-50/80 p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-rk-rose-300 bg-rk-white text-rk-rose-900 shrink-0">
                      {RENRAKU_REPORT_TARGET_LABELS[report.targetType] ?? report.targetType}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-rk-slate-200 bg-rk-white text-rk-slate-800 shrink-0">
                      {renrakuReportReasonLabelJa(report.reason)}
                    </span>
                    <span className="text-[10px] text-rk-slate-500 ml-auto shrink-0">
                      {formatFirestoreTimeJa(report.createdAt)}
                    </span>
                  </div>
                  {report.detail ? (
                    <p className="mt-2 text-xs font-bold text-rk-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                      補足: {report.detail}
                    </p>
                  ) : null}
                  {targetPreview ? (
                    <div className="mt-2 rounded-lg border border-rk-rose-200 bg-rk-white/90 px-2.5 py-2">
                      {targetMsg?.fromUser ? (
                        <p className="text-[10px] font-black text-rk-slate-500 mb-1">{targetMsg.fromUser}</p>
                      ) : null}
                      <RenrakuMessageBody
                        text={targetPreview}
                        className="text-xs leading-relaxed whitespace-pre-wrap text-rk-slate-800 break-words"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] font-bold text-rk-slate-500 leading-relaxed">
                      対象投稿 ID: {report.targetId}
                      <br />
                      （非表示済み・削除済み、または一覧に未読み込みの可能性があります）
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-rk-slate-500">
                    <span>通報者 UID: {report.reporterUid.slice(0, 12)}…</span>
                    {report.pagePath ? <span>ページ: {report.pagePath}</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (busy) return;
                        setReportActionBusyId(report.id);
                        void (async () => {
                          try {
                            const { authorUid, authorName } = await fetchRenrakuReportAuthor(report, targetMsg);
                            if (!authorUid) {
                              window.dispatchEvent(
                                new CustomEvent('SHOW_TOAST', { detail: '投稿者を特定できませんでした' }),
                              );
                              return;
                            }
                            await handleBulkBlockAuthorPosts(authorUid, authorName);
                          } finally {
                            setReportActionBusyId(null);
                          }
                        })();
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-slate-300 bg-rk-white text-rk-slate-700 hover:bg-rk-slate-100 disabled:opacity-40"
                    >
                      投稿者をブロック
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (busy) return;
                        setReportActionBusyId(report.id);
                        void (async () => {
                          try {
                            await handleDelete(report.targetId, renrakuReportDeleteTarget(report.targetType));
                          } finally {
                            setReportActionBusyId(null);
                          }
                        })();
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-rose-300 bg-rk-white text-rk-rose-800 hover:bg-rk-rose-100 disabled:opacity-40"
                    >
                      投稿を削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
            <Lock size={16} /> らくだへの伝言
          </h3>
          {onReloadAdminInbox ? (
            <button type="button" onClick={() => onReloadAdminInbox()} className="text-[10px] font-bold text-rk-slate-600 underline">
              再読み込み
            </button>
          ) : null}
        </div>
        {adminPrivateLoadState === 'loading' ? (
          <p className="text-center py-6 text-rk-slate-400 text-xs font-bold">読み込み中…</p>
        ) : null}
        {adminPrivateLoadState === 'denied' ? (
          <div className="rounded-xl border-2 border-rk-red-500 bg-rk-red-50 px-3 py-4 text-xs font-bold text-rk-red-900 leading-relaxed">
            伝言一覧を取得できません。トップで akasirakuda@gmail.com の Google ログインを確認してください。
            {onRequestGoogleLogin ? (
              <button
                type="button"
                onClick={() => onRequestGoogleLogin()}
                className="mt-3 block w-full rounded-lg bg-rk-red-600 text-rk-white py-2 text-center font-black"
              >
                Google で再ログイン
              </button>
            ) : null}
          </div>
        ) : null}
        {adminPrivateLoadState !== 'denied' && privateMessages.length === 0 ? (
          <div className="text-center py-10 text-rk-slate-300 text-xs font-bold">伝言はありません</div>
        ) : null}
        {privateMessages.length > 0 ? (
          privateMessages.map((msg) => {
            const mod = renrakuPrivateModerationBadge(msg);
            return (
              <div
                key={msg.id}
                className={`rounded-xl p-3 shadow-sm border-2 border-rk-red-600 bg-rk-amber-50 transition-colors ${
                  msg.isRead ? 'opacity-70' : ''
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className={nameChipClass}>
                          {String((msg as any).fromUserEmoji ?? '').trim()
                            ? `${String((msg as any).fromUserEmoji).trim()} `
                            : ''}
                          {msg.fromUser}
                        </span>
                        {mod ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${mod.className}`}>
                            {mod.text}
                          </span>
                        ) : null}
                        {!msg.isRead ? (
                          <span className="w-2 h-2 bg-rk-rose-400 rounded-full animate-pulse shrink-0" title="未読" />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1.5 sm:flex-col sm:items-end sm:justify-start sm:pt-0.5">
                      <button
                        type="button"
                        onClick={() => toggleRead(msg.id, !!msg.isRead)}
                        className={`p-2 rounded-xl transition-colors border ${
                          msg.isRead
                            ? 'text-rk-slate-600 bg-rk-white border-rk-slate-200 hover:bg-rk-slate-50'
                            : 'text-rk-slate-800 bg-rk-amber-100 border-rk-amber-300 hover:bg-rk-amber-100'
                        }`}
                        title={msg.isRead ? '未読にする' : '既読にする'}
                      >
                        {msg.isRead ? <MailOpen size={18} /> : <Mail size={18} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id, 'private')}
                        className="p-2 text-rk-slate-600 hover:text-rk-rose-600 transition-colors rounded-xl border border-rk-slate-200 bg-rk-white hover:bg-rk-slate-50"
                        title="削除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <RenrakuMessageBody
                    text={String(msg.message ?? '')}
                    className="text-xs leading-relaxed whitespace-pre-wrap text-rk-slate-800 break-words pr-0 sm:pr-1"
                  />
                  <RenrakuCopyTextButton text={String(msg.message ?? '')} variant="link" className="mt-1 mb-2" />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-rk-slate-400">返信</div>
                        {resolveRenrakuPrivateReplyText(msg, privateReplyByMessageId[msg.id]) ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-rk-success-200 bg-rk-success-50 text-rk-success-800">
                            送信済み{(msg as any).replyAt ? `（${formatFirestoreTimeJa((msg as any).replyAt)}）` : ''}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[9px] font-bold text-rk-slate-500 leading-snug max-w-[min(100%,40ch)]">
                        返信は、その伝言を送った方の画面にだけ表示され、掲示板のタイムラインには出ません。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <textarea
                        value={getDraft(msg.id)}
                        onChange={(e) => setDraft(msg.id, e.target.value)}
                        rows={3}
                        className="min-w-[14rem] w-[min(60vw,22rem)] h-16 px-3 py-2 text-sm bg-rk-white border border-rk-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-rk-amber-500/30 resize-none"
                        aria-label="返信メッセージ"
                      />
                      <button
                        type="button"
                        disabled={sendingById[msg.id]}
                        onClick={() => void sendReply(msg.id)}
                        className="h-9 px-3 rounded-lg border border-rk-amber-200 bg-rk-white text-rk-amber-900 text-[11px] font-black shadow-sm hover:bg-rk-amber-50 disabled:opacity-60"
                      >
                        {sendingById[msg.id] ? '送信中…' : '返信を送る'}
                      </button>
                    </div>
                  </div>
                  {replyStatusById[msg.id] ? (
                    <div
                      className={`text-[11px] font-bold ${
                        replyStatusById[msg.id] === 'ok' ? 'text-rk-success-700' : 'text-rk-rose-700'
                      }`}
                    >
                      {replyStatusById[msg.id] === 'ok' ? '返信を保存しました' : '送信に失敗しました'}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-rk-red-200/50">
                    <span className="text-[10px] text-rk-slate-500 shrink-0">{formatFirestoreTimeJa(msg.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => handleBlock(msg.fromUserUid || msg.id, msg.fromUser)}
                      className="text-[10px] font-bold text-rk-slate-700 hover:text-rk-rose-700 flex items-center gap-1 px-2 py-1 rounded-lg border border-rk-slate-200 bg-rk-white/90 hover:bg-rk-rose-50 shrink-0"
                    >
                      <UserX size={12} /> このユーザーをブロック
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
            🧹 掲示板の投稿（管理）
          </h3>
        </div>
        {adminPublicItems.length === 0 ? (
          <div className="text-center py-10 text-rk-slate-300 text-xs font-bold">投稿はありません</div>
        ) : (
          <div className="space-y-2">
            {adminPublicItems.map((msg) => {
              const canBlock = !!msg.fromUserUid;
              return (
                <div key={`${msg.type}:${msg.id}`} className="rounded-xl border border-rk-slate-200 bg-rk-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={nameChipClass}>{msg.fromUser}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border border-rk-slate-200 bg-rk-slate-50 text-rk-slate-700 shrink-0">
                          {msg.type === 'community' ? '掲示' : '募集'}
                        </span>
                      </div>
                      <RenrakuMessageBody
                        text={String((msg as any).message ?? '')}
                        className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-rk-slate-800 break-words"
                      />
                      <RenrakuCopyTextButton
                        text={String((msg as any).message ?? '')}
                        variant="link"
                        className="mt-1"
                      />
                      <div className="mt-2 text-[10px] text-rk-slate-500">{formatFirestoreTimeJa((msg as any).createdAt)}</div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={!canBlock}
                        onClick={() => {
                          const uid = msg.fromUserUid;
                          if (uid) void handleBulkBlockAuthorPosts(uid, msg.fromUser);
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-slate-300 bg-rk-white text-rk-slate-700 hover:bg-rk-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        ブロック
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(String(msg.id), msg.type)}
                        className="p-2 text-rk-slate-600 hover:text-rk-rose-600 transition-colors rounded-xl border border-rk-slate-200 bg-rk-white hover:bg-rk-slate-50"
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
        className="scroll-mt-4 rounded-2xl border-2 border-rk-slate-500 bg-rk-neutral-100 p-4 shadow-lg ring-1 ring-rk-black/10"
        aria-labelledby="admin-blocklist-heading"
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-2xl leading-none select-none" aria-hidden>
            👤
          </span>
          <span className="text-2xl leading-none select-none" aria-hidden>
            🚫
          </span>
          <h3 id="admin-blocklist-heading" className="text-base font-black text-rk-gray-900 tracking-tight">
            出禁リスト
          </h3>
        </div>
        <p className="text-xs font-bold text-rk-gray-800 mb-4">掲示板からブロックした利用者がここに表示されます</p>
        {blockedUsers.length === 0 ? (
          <div className="text-center py-8 px-3 text-rk-gray-900 text-sm font-bold bg-rk-white rounded-xl border-2 border-rk-slate-400">
            ブロック中のユーザーはいません
          </div>
        ) : (
          <div className="rounded-xl border-2 border-rk-slate-500 bg-rk-white overflow-hidden shadow-inner">
            {blockedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-4 border-b border-rk-slate-200 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-rk-gray-900 break-words max-w-[min(100%,28ch)]">{user.userName}</p>
                  <p className="text-[10px] text-rk-gray-700 font-medium mt-1">{formatFirestoreTimeJa(user.blockedAt)} にブロック</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(user.id)}
                  className={`${btnGhost} flex items-center gap-1 shrink-0 text-rk-gray-900 border-rk-slate-400`}
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
