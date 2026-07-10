import React, { useState } from 'react';
import { copyRenrakuMessageText, toastRenrakuCopyResult } from './renrakuCopyMessageText';

type RenrakuCopyTextButtonProps = {
  text: string;
  className?: string;
  /** いいね・通報ボタンと同じ見た目 */
  variant?: 'chip' | 'link';
};

const chipClass =
  'text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rk-slate-200 bg-rk-slate-50 text-rk-slate-600 hover:bg-rk-slate-100 active:opacity-80';

const RenrakuCopyTextButton: React.FC<RenrakuCopyTextButtonProps> = ({
  text,
  className = '',
  variant = 'chip',
}) => {
  const [busy, setBusy] = useState(false);
  const hasText = String(text ?? '').trim().length > 0;
  if (!hasText) return null;

  const handleCopy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await copyRenrakuMessageText(text);
      toastRenrakuCopyResult(ok);
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={busy}
        className={`text-[10px] font-bold text-rk-sky-800 underline underline-offset-2 hover:opacity-90 active:opacity-80 disabled:opacity-50 ${className}`}
      >
        {busy ? 'コピー中…' : 'コピー'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={busy}
      className={`${chipClass} disabled:opacity-50 ${className}`}
    >
      {busy ? 'コピー中…' : 'コピー'}
    </button>
  );
};

export default RenrakuCopyTextButton;
