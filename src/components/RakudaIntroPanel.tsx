import React from 'react';
import {
  RAKUDA_INTRO_BODY_LINES,
  RAKUDA_INTRO_LEAD,
  RAKUDA_INTRO_SCHEDULE,
  RAKUDA_INTRO_SUMMARY,
  RAKUDA_INTRO_TEASER,
  rakudaIntroHasContent,
  rakudaIntroVisibleLinks,
} from '../constants/rakudaIntroLinks';

const linkButtonClass =
  'flex w-full items-center justify-center gap-2 py-3 px-3 rounded-xl border-2 font-black text-[13px] shadow-sm active:scale-[0.99] transition-transform';

/** ゲート画面 — 署名の下。閉じても予告が見える独立カード */
const RakudaIntroPanel: React.FC = () => {
  const links = rakudaIntroVisibleLinks();
  const bodyLines = RAKUDA_INTRO_BODY_LINES.map((line) => line.trim()).filter(Boolean);
  const hasContent = rakudaIntroHasContent();
  const lead = RAKUDA_INTRO_LEAD.trim();

  return (
    <details className="rounded-2xl border-2 border-rk-sky-400/90 bg-gradient-to-b from-rk-sky-50 via-rk-white to-rk-sky-50/80 px-4 py-3.5 shadow-md group open:shadow-lg">
      <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-[15px] font-black tracking-tight text-rk-sky-950">
              ☕🐫 {RAKUDA_INTRO_SUMMARY}
            </div>
            <p className="text-[12px] font-bold leading-snug text-rk-sky-900/80 group-open:hidden">{RAKUDA_INTRO_TEASER}</p>
            <p className="hidden text-[11px] font-bold text-rk-sky-800/70 group-open:block">タップで閉じる</p>
          </div>
          <span
            className="shrink-0 mt-0.5 rounded-lg border border-rk-sky-300 bg-rk-white px-2 py-1 text-[10px] font-black text-rk-sky-900 group-open:hidden"
            aria-hidden
          >
            開く
          </span>
        </div>
      </summary>

      <div className="mt-3 pt-3 border-t border-rk-sky-200/90 space-y-3">
        {lead ? <p className="text-[13px] font-bold leading-relaxed text-rk-sky-950/95">{lead}</p> : null}

        {RAKUDA_INTRO_SCHEDULE.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {RAKUDA_INTRO_SCHEDULE.map((item) => (
              <div
                key={item.platform}
                className="rounded-xl border-2 border-rk-sky-200 bg-rk-white/90 px-2.5 py-2.5 text-center shadow-sm"
              >
                <div className="text-lg leading-none" aria-hidden>
                  {item.emoji}
                </div>
                <div className="mt-1 text-[12px] font-black text-rk-sky-950">{item.platform}</div>
                <div className="text-[11px] font-bold text-rk-sky-900/85">{item.time}</div>
              </div>
            ))}
          </div>
        ) : null}

        {bodyLines.map((line) => (
          <p key={line} className="text-[12px] font-bold text-rk-sky-950/90">
            {line}
          </p>
        ))}

        {links.length > 0 ? (
          <div className="space-y-2 pt-1">
            {links.map((item, index) => {
              const isIntro = index === 0;
              const isTikTok = item.href.includes('tiktok.com');
              const buttonClass = isIntro
                ? `${linkButtonClass} border-rk-amber-500 bg-gradient-to-b from-rk-amber-50 to-rk-orange-50 text-rk-amber-950`
                : isTikTok
                  ? `${linkButtonClass} border-rk-slate-700 bg-gradient-to-b from-rk-slate-100 to-rk-slate-50 text-rk-slate-900`
                  : `${linkButtonClass} border-red-500/80 bg-gradient-to-b from-red-50 to-rk-white text-red-950`;

              return (
                <a
                  key={`${item.label}:${item.href}`}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        ) : null}

        {!hasContent ? (
          <p className="text-[12px] font-medium text-rk-sky-900/70">配信・自己紹介のリンクは準備中です。</p>
        ) : null}
      </div>
    </details>
  );
};

export default RakudaIntroPanel;
