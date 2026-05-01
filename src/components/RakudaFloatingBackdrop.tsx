import React from 'react';
import FloatingChar from './FloatingChar';

/**
 * AppLayout の FloatingChar と同じプール・挙動で、画面ごとのテーマ色だけ変える。
 * 視認性重視で /28〜/36 前後（静寂の青は背景が暗いためやや控えめ）。
 */
export type RakudaBackdropVariant = 'hub' | 'kotoba' | 'minna' | 'renraku' | 'stamp' | 'quiet';

const VARIANT_CONFIG: Record<
  RakudaBackdropVariant,
  { colorClass: string; count: number; sizeScale?: number }
> = {
  /** トップハブ「らくだ珈琲」：琥珀グラデ上を優雅に（やや大きめ・控えめな濃さ） */
  hub: { colorClass: 'text-amber-900/22', count: 14, sizeScale: 1.12 },
  /** ことば探し：琥珀色・茶系 */
  kotoba: { colorClass: 'text-amber-900/32', count: 12, sizeScale: 1 },
  /** みんなであそぶ：情熱の赤 */
  minna: { colorClass: 'text-rose-800/32', count: 12, sizeScale: 1 },
  /** 連絡帳：茶・琥珀 */
  renraku: { colorClass: 'text-amber-950/30', count: 12, sizeScale: 1 },
  /** しゅっせき簿：緑 */
  stamp: { colorClass: 'text-emerald-900/30', count: 12, sizeScale: 1 },
  /** しずかの間：深い青背景上の水色 */
  quiet: { colorClass: 'text-sky-200/26', count: 12, sizeScale: 1 },
};

export const RakudaFloatingBackdrop: React.FC<{
  variant: RakudaBackdropVariant;
  className?: string;
}> = ({ variant, className = '' }) => {
  const cfg = VARIANT_CONFIG[variant];
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden -z-10 ${className}`.trim()}
      aria-hidden
    >
      {Array.from({ length: cfg.count }, (_, i) => (
        <FloatingChar
          key={`rakuda-bg-${variant}-${i}`}
          colorClass={cfg.colorClass}
          sizeScale={cfg.sizeScale ?? 1}
        />
      ))}
    </div>
  );
};

export default RakudaFloatingBackdrop;
