import React, { useEffect, useState } from 'react';
import GreenPassRedeemForm from './GreenPassRedeemForm';
import { btnGhost } from '../ui/policy';
import { normalizeGreenPassCodeInput } from '../lib/greenGatePassConfig';

export type GreenPassEntryScreenProps = {
  onRedeem: (code: string) => void | Promise<void>;
  busy?: boolean;
  statusMessage?: string | null;
  statusTone?: 'ok' | 'error' | 'neutral';
  onLeaveToHub: () => void;
};

const GreenPassEntryScreen: React.FC<GreenPassEntryScreenProps> = ({
  onRedeem,
  busy = false,
  statusMessage = null,
  statusTone = 'neutral',
  onLeaveToHub,
}) => {
  const [autoNote, setAutoNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('green_pass');
    if (!raw) return;
    const code = normalizeGreenPassCodeInput(raw);
    if (code) {
      setAutoNote('リンクのコードを確認しています…');
    }
  }, []);

  useEffect(() => {
    if (statusTone !== 'ok') return;
    const t = window.setTimeout(() => onLeaveToHub(), 1200);
    return () => window.clearTimeout(t);
  }, [statusTone, onLeaveToHub]);

  return (
    <div
      className="fixed inset-0 z-[6200] flex flex-col bg-gradient-to-b from-rk-success-50 via-rk-emerald-50/80 to-rk-amber-50 font-rounded text-rk-slate-800"
      role="dialog"
      aria-modal="true"
      aria-label="配布コードの入力"
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="max-w-lg mx-auto space-y-4">
          <h1 className="text-center text-lg font-black tracking-tight text-rk-success-900">
            らくだ珈琲 — 配布コード
          </h1>
          <div className="rounded-2xl border-2 border-rk-success-300 bg-rk-white px-4 py-4 shadow-sm space-y-3">
            <p className="text-[13px] leading-relaxed font-medium text-rk-slate-700">
              らくだ珈琲からコードをお渡しの方は、ここで入力してください。
              遊び方はいつもと同じまま、名前の色が緑になり、広告は出ません（1年間）。
            </p>
            <ol className="text-[12px] font-bold text-rk-slate-600 space-y-1 list-decimal list-inside">
              <li>Safari または Chrome で開く</li>
              <li>Google でログイン</li>
              <li>下の欄にコードを入れて「使う」</li>
            </ol>
            {autoNote ? (
              <p className="text-[11px] font-bold text-rk-success-800 bg-rk-success-50 rounded-lg px-3 py-2">
                {autoNote}
              </p>
            ) : null}
            <GreenPassRedeemForm
              entryPage
              busy={busy}
              statusMessage={statusMessage}
              statusTone={statusTone}
              onSubmit={onRedeem}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-rk-success-200/80 bg-rk-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button type="button" onClick={onLeaveToHub} className={`${btnGhost} w-full py-2.5 text-sm font-black`}>
            通常のらくだ珈琲へ
          </button>
        </div>
      </div>
    </div>
  );
};

export default GreenPassEntryScreen;
