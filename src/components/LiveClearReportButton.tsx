import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { RK03GhostTouchButton } from '../ui/baselineParts';
import { btnGhostTouch } from '../ui/policy';
import {
  copyLiveClearReportText,
  liveClearReportToastMessage,
  type LiveClearReportKind,
} from '../lib/liveClearReport';
import { showAppToast } from '../lib/appToast';

interface LiveClearReportButtonProps {
  kind: LiveClearReportKind;
  showToast?: (message: string) => void;
  vibrate?: (pattern?: number | number[]) => void;
  className?: string;
}

const LiveClearReportButton: React.FC<LiveClearReportButtonProps> = ({
  kind,
  showToast,
  vibrate,
  className = '',
}) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    vibrate?.(8);
    try {
      const ok = await copyLiveClearReportText(kind);
      const message = liveClearReportToastMessage(ok);
      if (showToast) showToast(message);
      else showAppToast(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RK03GhostTouchButton
      type="button"
      disabled={busy}
      onClick={() => void handleClick()}
      className={`${btnGhostTouch} w-full h-11 gap-2 border-rk-sky-200/90 bg-rk-sky-50/70 text-rk-sky-950 font-bold text-sm ${className}`.trim()}
      aria-label="LIVEでらくださんにクリアを報告する（チャット用テキストをコピー）"
    >
      <Radio className="size-4 shrink-0 text-rk-sky-700" aria-hidden />
      {busy ? 'コピー中…' : 'LIVEでらくださんに報告する'}
    </RK03GhostTouchButton>
  );
};

export default LiveClearReportButton;
