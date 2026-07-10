import React from 'react';

const PlayInviteBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span
    className={`absolute flex items-center justify-center rounded-full border font-black leading-none shadow-sm ${
      compact
        ? '-right-0.5 -top-0.5 h-3.5 min-w-[1rem] px-0.5 border-rk-sky-500 bg-rk-sky-100 text-[7px] text-rk-sky-950'
        : '-right-1 -top-1 h-4 min-w-[1.125rem] px-0.5 border-rk-sky-500 bg-rk-sky-100 text-[8px] text-rk-sky-950'
    }`}
    title="一緒に遊ぶ？"
    aria-label="一緒に遊ぶ？"
  >
    ？
  </span>
);

export default PlayInviteBadge;
