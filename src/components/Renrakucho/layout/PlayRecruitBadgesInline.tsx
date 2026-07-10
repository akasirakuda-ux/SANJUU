import React from 'react';
import type { PlayRecruitKind } from '../../../hooks/useActiveUserPlayRecruitBadges';

const RECRUIT_BADGE_META: Record<
  PlayRecruitKind,
  { emoji: string; title: string; positionClass: string }
> = {
  hundred: {
    emoji: '📝',
    title: 'ひと言探し — 遊び相手募集中',
    positionClass: '-bottom-1 -left-1',
  },
  reversi: {
    emoji: '🟢',
    title: 'リバーシ — 遊び相手募集中',
    positionClass: '-bottom-1 -right-1',
  },
};

export function recruitLabelPrefix(kinds: PlayRecruitKind[]): string {
  const parts: string[] = [];
  if (kinds.includes('reversi')) parts.push('🟢');
  if (kinds.includes('hundred')) parts.push('📝');
  return parts.length ? `${parts.join('')} ` : '';
}

export const PlayRecruitBadgesInline: React.FC<{ kinds: PlayRecruitKind[]; compact?: boolean }> = ({
  kinds,
  compact = false,
}) => {
  if (kinds.length === 0) return null;
  return (
    <>
      {kinds.map((kind) => {
        const meta = RECRUIT_BADGE_META[kind];
        return (
          <span
            key={kind}
            className={`absolute ${meta.positionClass} flex items-center justify-center rounded-full border border-rk-amber-300 bg-rk-white leading-none shadow-sm ${
              compact ? 'h-3.5 w-3.5 text-[8px]' : 'h-4 w-4 text-[9px]'
            }`}
            title={meta.title}
            aria-label={meta.title}
          >
            {meta.emoji}
          </span>
        );
      })}
    </>
  );
};
