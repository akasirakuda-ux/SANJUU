import React from 'react';
import AdultChallengeShareButton from './AdultChallengeShareButton';
import LiveClearReportButton from './LiveClearReportButton';
import {
  LIVE_SOLO_CLEAR_CELEBRATION,
  LIVE_SOLO_CLEAR_ENCOURAGEMENT,
  type LiveClearReportKind,
} from '../lib/liveClearReport';

interface LiveClearReportSoloPanelProps {
  kind: LiveClearReportKind;
  showToast?: (message: string) => void;
  vibrate?: (pattern?: number | number[]) => void;
  /** ことば探し・ひと言探しソロ — 同じお題の共有 URL */
  adultChallengeShareUrl?: string | null;
}

const LiveClearReportSoloPanel: React.FC<LiveClearReportSoloPanelProps> = ({
  kind,
  showToast,
  vibrate,
  adultChallengeShareUrl,
}) => (
  <div className="rounded-xl border border-rk-amber-200/90 bg-gradient-to-b from-rk-amber-50/90 to-rk-sky-50/50 px-3 py-3 flex flex-col gap-2.5 text-center">
    <p className="text-sm font-black text-rk-amber-950 leading-snug">{LIVE_SOLO_CLEAR_CELEBRATION}</p>
    {adultChallengeShareUrl ? (
      <AdultChallengeShareButton
        challengeUrl={adultChallengeShareUrl}
        showToast={showToast}
        vibrate={vibrate}
      />
    ) : null}
    <p className="text-xs leading-relaxed text-rk-slate-700">
      {LIVE_SOLO_CLEAR_ENCOURAGEMENT[0]}
      <br />
      {LIVE_SOLO_CLEAR_ENCOURAGEMENT[1]}
    </p>
    <LiveClearReportButton kind={kind} showToast={showToast} vibrate={vibrate} className="mt-0.5" />
  </div>
);

export default LiveClearReportSoloPanel;
