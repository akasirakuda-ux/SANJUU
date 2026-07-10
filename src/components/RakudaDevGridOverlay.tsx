import React from 'react';
import { rakudaLayoutGridPx } from '../ui/policy';

function isDevGridEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get('grid') === '0') return false;
  if (q.get('grid') === '1') return true;
  // ローカル開発では既定 ON（?grid=0 で非表示）
  return true;
}

/** ローカル UI 調整用：10px / 50px グリッド + max-w-md 中心ガイド */
const RakudaDevGridOverlay: React.FC = () => {
  if (!isDevGridEnabled()) return null;

  const g = rakudaLayoutGridPx;
  const major = g * 5;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998]"
      aria-hidden
      data-rakuda-dev-grid
      style={{
        backgroundImage: [
          'linear-gradient(to right, rgb(239 68 68 / 0.14) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgb(239 68 68 / 0.14) 1px, transparent 1px)',
          'linear-gradient(to right, rgb(59 130 246 / 0.18) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgb(59 130 246 / 0.18) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: `${g}px ${g}px, ${g}px ${g}px, ${major}px ${major}px, ${major}px ${major}px`,
      }}
    >
      <div className="absolute inset-y-0 left-1/2 w-full max-w-md -translate-x-1/2 border-x border-rk-emerald-500/35" />
      <div className="absolute left-2 top-2 rounded-md bg-rk-white/85 px-2 py-0.5 text-[10px] font-bold text-rk-slate-600 shadow-sm border border-rk-slate-200">
        DEV GRID · 10px / 50px · ?grid=0 で非表示
      </div>
    </div>
  );
};

export default RakudaDevGridOverlay;
