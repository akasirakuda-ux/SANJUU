import React, { useState } from 'react';
import { normalizeGreenPassCodeInput } from '../lib/greenGatePassConfig';
import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';

export type GreenPassRedeemFormProps = {
  onSubmit: (code: string) => void | Promise<void>;
  busy?: boolean;
  statusMessage?: string | null;
  statusTone?: 'ok' | 'error' | 'neutral';
  compact?: boolean;
  /** `/pass` 専用 — 配布コード向けの説明 */
  entryPage?: boolean;
};

const GreenPassRedeemForm: React.FC<GreenPassRedeemFormProps> = ({
  onSubmit,
  busy = false,
  statusMessage = null,
  statusTone = 'neutral',
  compact = false,
  entryPage = false,
}) => {
  const [draft, setDraft] = useState('');

  const handleSubmit = () => {
    const code = normalizeGreenPassCodeInput(draft);
    if (!code || busy) return;
    void onSubmit(code);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div>
        <p className={`font-bold text-rk-slate-700 ${compact ? 'text-[11px] leading-relaxed' : 'text-xs leading-relaxed'}`}>
          {entryPage ? (
            <>
              配布されたコード（RK-XXXX-XXXX）を入力し、Google でログインしてください。
              <span className="block mt-1 text-rk-slate-500 font-medium">
                リンクで開いた方は、自動で進むことがあります。その場合はそのままお待ちください。
              </span>
              <span className="block mt-1 text-rk-slate-500 font-medium">
                {`「${RAKUDA_SUPPORT_GATE_LABEL}が有効」と出れば完了です（1年間・広告なし）。`}
              </span>
            </>
          ) : (
            <>
              Safari か Chrome で、もらったリンクを1回開き、Google でログインしてください。
              <span className="block mt-1 text-rk-slate-500 font-medium">
                {`「${RAKUDA_SUPPORT_GATE_LABEL}が有効」と出れば、1年間広告なしです。`}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="RK-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className={`flex-1 min-w-0 rounded-xl border-2 border-rk-success-200 bg-rk-white px-3 font-black tracking-widest text-rk-success-900 placeholder:font-bold placeholder:tracking-normal placeholder:text-rk-slate-400 focus:outline-none focus:ring-2 focus:ring-rk-success-400/40 ${
            compact ? 'py-2 text-sm' : 'py-2.5 text-base'
          }`}
          aria-label="緑券コード"
        />
        <button
          type="button"
          disabled={busy || !normalizeGreenPassCodeInput(draft)}
          onClick={handleSubmit}
          className={`shrink-0 rounded-xl border-2 border-rk-success-600 bg-rk-success-600 text-rk-white font-black shadow-sm active:scale-[0.99] disabled:opacity-50 ${
            compact ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm'
          }`}
        >
          {busy ? '確認中…' : '使う'}
        </button>
      </div>
      {statusMessage ? (
        <p
          className={`font-bold leading-relaxed ${
            compact ? 'text-[10px]' : 'text-xs'
          } ${
            statusTone === 'ok'
              ? 'text-rk-success-700'
              : statusTone === 'error'
                ? 'text-rk-rose-700'
                : 'text-rk-slate-600'
          }`}
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
};

export default GreenPassRedeemForm;
