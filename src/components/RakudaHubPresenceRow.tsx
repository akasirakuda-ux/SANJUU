import React, { useMemo } from 'react';
import { RAKUDA_ROBO_EMOJI, RAKUDA_ROBO_NAME } from '../lib/reversiConfig';
import { formatHubVisitorTotal } from '../lib/hubVisitorStats';
import type { HubPresencePeer } from '../hooks/usePresence';
import RakudaTapEmojiButton from './RakudaTapEmojiButton';

const MAX_VISIBLE_PEER_EMOJIS = 12;

const peerEmojiShellClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rk-white/95 border border-rk-amber-200/90 text-lg leading-none shadow-sm active:scale-95 transition-transform';

export type RakudaHubPresenceRowProps = {
  /** いまサイトにいる利用者（らくだロボ除く・Firestore実測のみ） */
  hubPresencePeers?: readonly HubPresencePeer[];
  /** 同時来場者数 */
  viewerCount?: number;
  /** 累計来場者数（別ラベル） */
  hubVisitorTotal?: number;
};

const RakudaHubPresenceRow: React.FC<RakudaHubPresenceRowProps> = ({
  hubPresencePeers = [],
  viewerCount,
  hubVisitorTotal,
}) => {
  const peers = hubPresencePeers.filter((p) => String(p.emoji || '').trim());
  const liveCount = typeof viewerCount === 'number' ? viewerCount : 0;
  const visiblePeers = useMemo(() => peers.slice(0, MAX_VISIBLE_PEER_EMOJIS), [peers]);
  const overflowPeerCount = Math.max(0, peers.length - visiblePeers.length);
  const showTotalCount = typeof hubVisitorTotal === 'number' && hubVisitorTotal >= 1;

  return (
    <div
      className="w-full rounded-xl border border-rk-amber-300/70 bg-rk-amber-50/90 px-2.5 py-2 shadow-sm"
      aria-label={`いま${liveCount}人${showTotalCount ? `、これまで${hubVisitorTotal}人が来場` : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-rk-amber-400/90 bg-rk-white text-lg shadow-sm"
          title={RAKUDA_ROBO_NAME}
          aria-label={RAKUDA_ROBO_NAME}
        >
          {RAKUDA_ROBO_EMOJI}
        </span>
        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          <div className="flex items-center justify-center gap-1.5 min-w-full py-0.5 px-0.5">
            {visiblePeers.length === 0 ? (
              <span
                className="text-[11px] font-medium text-rk-amber-950/45 px-0.5 select-none"
                aria-hidden
              >
                …
              </span>
            ) : (
              <>
                {visiblePeers.map((peer) => (
                  <RakudaTapEmojiButton
                    key={peer.uid}
                    emoji={peer.emoji}
                    nickname={peer.nickname}
                    className={peerEmojiShellClass}
                    style={{
                      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
                    }}
                  />
                ))}
                {overflowPeerCount > 0 ? (
                  <span
                    className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-rk-amber-100/90 border border-rk-amber-200/90 px-1.5 text-[10px] font-bold text-rk-amber-950/75 tabular-nums"
                    aria-label={`ほか${overflowPeerCount}人`}
                  >
                    +{overflowPeerCount}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1 leading-none select-none text-[11px] font-medium text-rk-amber-950/70 tabular-nums">
          <span>いま {liveCount} 人</span>
          {showTotalCount ? (
            <span>これまで {formatHubVisitorTotal(hubVisitorTotal)} 人</span>
          ) : null}
        </div>
      </div>
      {visiblePeers.length > 0 ? (
        <p className="mt-1.5 text-center text-[9px] font-bold text-rk-amber-950/55 leading-snug">
          絵文字をタップ → 名前
        </p>
      ) : null}
    </div>
  );
};

export default RakudaHubPresenceRow;
