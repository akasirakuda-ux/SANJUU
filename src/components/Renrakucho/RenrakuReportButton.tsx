import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import {
  RENRAKU_REPORT_REASONS,
  submitRenrakuReport,
  type RenrakuReportReasonId,
  type RenrakuReportTargetType,
} from '../../lib/renrakuReport';

type RenrakuReportButtonProps = {
  targetType: RenrakuReportTargetType;
  targetId: string;
  /** 自分の投稿は通報不可 */
  authorUid?: string | null;
  authorName?: string | null;
  reporterUid: string | undefined | null;
  /** レッドカード等で掲示板操作と同様に無効化 */
  interactionBlocked?: boolean;
  variant?: 'light' | 'emerald';
};

const RenrakuReportButton: React.FC<RenrakuReportButtonProps> = ({
  targetType,
  targetId,
  authorUid,
  authorName,
  reporterUid,
  interactionBlocked,
  variant = 'light',
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<RenrakuReportReasonId>('impersonation');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);

  const isOwn = !!(reporterUid && authorUid && reporterUid === authorUid);
  const canReport = !!reporterUid && !!targetId && !isOwn && !interactionBlocked;

  const btnBase =
    variant === 'emerald'
      ? 'text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-success-300 text-rk-success-900 bg-rk-white/90 hover:bg-rk-success-100'
      : 'text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-slate-200 text-rk-slate-600 bg-rk-white hover:bg-rk-slate-50';

  const send = async () => {
    if (!canReport || sending) return;
    setSending(true);
    try {
      let pagePath = '';
      try {
        pagePath = `${window.location.pathname}${window.location.search}`.slice(0, 240);
      } catch {
        pagePath = '';
      }
      await submitRenrakuReport({
        targetType,
        targetId,
        reason,
        detail,
        reporterUid: reporterUid!,
        pagePath,
        targetAuthorUid: authorUid,
        targetAuthorName: authorName,
      });
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '通報を受け付けました。ありがとうございます。' }));
      setOpen(false);
      setDetail('');
    } catch (e) {
      console.warn('[RenrakuReportButton]', e);
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', { detail: '通報の送信に失敗しました。通信を確認して再度お試しください。' })
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!canReport}
        title={
          interactionBlocked
            ? '現在この操作はできません（利用制限中）'
            : !reporterUid
              ? 'ログイン後に通報できます'
              : isOwn
                ? '自分の投稿は通報できません'
                : 'この投稿を通報'
        }
        onClick={() => canReport && setOpen(true)}
        className={`inline-flex items-center gap-1 ${btnBase} disabled:opacity-40 disabled:pointer-events-none`}
      >
        <Flag size={12} className="shrink-0" aria-hidden />
        通報
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[420] flex items-end justify-center p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6 bg-rk-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rk-report-title"
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-rk-slate-300 bg-rk-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="rk-report-title" className="text-sm font-black text-rk-slate-900">
              投稿を通報
            </p>
            <p className="mt-1.5 text-[10px] font-bold text-rk-slate-600 leading-relaxed">
              理由を選んで送信してください。対象の種類・ID・あなたのアカウントは自動で記録されます。
            </p>
            <label className="mt-3 block text-[10px] font-black text-rk-slate-500 uppercase tracking-widest">理由</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as RenrakuReportReasonId)}
              className="mt-1 w-full rounded-xl border border-rk-slate-200 bg-rk-slate-50 px-2 py-2 text-xs font-bold text-rk-slate-800"
            >
              {RENRAKU_REPORT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-[10px] font-black text-rk-slate-500 uppercase tracking-widest">
              補足（任意・500文字まで）
            </label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="気になった点があれば短くどうぞ"
              className="mt-1 w-full rounded-xl border border-rk-slate-200 bg-rk-slate-50 px-2 py-2 text-xs text-rk-slate-800 resize-none"
            />
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => void send()}
                className="w-full min-h-[44px] rounded-xl border-2 border-rk-rose-600 bg-rk-rose-50 px-3 text-sm font-black text-rk-rose-900 shadow-sm active:scale-[0.99] disabled:opacity-50"
              >
                {sending ? '送信中…' : '通報を送信'}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => setOpen(false)}
                className="w-full min-h-[40px] rounded-xl border border-rk-slate-200 bg-rk-white px-3 text-xs font-bold text-rk-slate-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default RenrakuReportButton;
