import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { RK03GhostTouchButton } from '../ui/baselineParts';
import { btnGhostTouch } from '../ui/policy';
import {
  adultChallengeShareToastMessage,
  copyAdultChallengeShareText,
} from '../lib/kotobaChallengeShare';
import { showAppToast } from '../lib/appToast';

interface AdultChallengeShareButtonProps {
  challengeUrl: string;
  showToast?: (message: string) => void;
  vibrate?: (pattern?: number | number[]) => void;
  className?: string;
}

const AdultChallengeShareButton: React.FC<AdultChallengeShareButtonProps> = ({
  challengeUrl,
  showToast,
  vibrate,
  className = '',
}) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || !challengeUrl) return;
    setBusy(true);
    vibrate?.(8);
    try {
      const ok = await copyAdultChallengeShareText(challengeUrl);
      const message = adultChallengeShareToastMessage(ok);
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
      className={`${btnGhostTouch} w-full h-11 gap-2 border-rk-amber-300/90 bg-rk-amber-50/80 text-rk-amber-950 font-bold text-sm ${className}`.trim()}
      aria-label="周りの大人に同じお題を見せる（コピー）"
    >
      <Users className="size-4 shrink-0 text-rk-amber-800" aria-hidden />
      {busy ? 'コピー中…' : '周りの大人に見せる'}
    </RK03GhostTouchButton>
  );
};

export default AdultChallengeShareButton;
