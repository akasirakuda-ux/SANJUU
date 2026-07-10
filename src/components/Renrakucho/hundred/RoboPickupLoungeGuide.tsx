import React, { useEffect, useState } from 'react';
import {
  ROBO_PICKUP_LOUNGE_GUIDE_LINES,
  ROBO_PICKUP_LOUNGE_TITLE,
} from '../../../lib/roboPickupLoungeConfig';

const ROBO_GUIDE_ROTATE_MS = 5000;

const RoboPickupLoungeGuide: React.FC<{
  variant?: 'card' | 'compact';
  className?: string;
  /** 盤面プレイ中: 注意書きを1行ずつ順番表示 */
  rotateLines?: boolean;
  title?: string;
}> = ({ variant = 'card', className = '', rotateLines = false, title = ROBO_PICKUP_LOUNGE_TITLE }) => {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (variant !== 'compact' || !rotateLines) return;
    const id = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % ROBO_PICKUP_LOUNGE_GUIDE_LINES.length);
    }, ROBO_GUIDE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [variant, rotateLines]);

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-xl border border-rk-sky-200 bg-rk-sky-50 px-3 py-2 text-[11px] leading-relaxed text-rk-slate-700 relative z-10 ${className}`}
      >
        <p className="font-black text-rk-slate-800 mb-0.5">{title}</p>
        {rotateLines ? (
          <p
            key={lineIndex}
            className="text-[11px] leading-snug text-rk-slate-700 min-h-[1.35rem]"
            aria-live="polite"
          >
            {ROBO_PICKUP_LOUNGE_GUIDE_LINES[lineIndex]}
          </p>
        ) : (
          <ul className="space-y-0.5 list-none pl-0">
            {ROBO_PICKUP_LOUNGE_GUIDE_LINES.map((line) => (
              <li key={line}>・{line}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border border-rk-sky-200 bg-gradient-to-b from-rk-sky-50 to-rk-white px-4 py-3 space-y-2 ${className}`}
    >
      <p className="text-sm font-black text-rk-slate-800">{title}</p>
      <ul className="text-sm text-rk-slate-700 space-y-1 list-none pl-0">
        {ROBO_PICKUP_LOUNGE_GUIDE_LINES.map((line) => (
          <li key={line}>・{line}</li>
        ))}
      </ul>
    </div>
  );
};

export default RoboPickupLoungeGuide;
