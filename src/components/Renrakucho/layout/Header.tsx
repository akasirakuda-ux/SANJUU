import React from 'react';
import { pageTopHeadingClass } from '../../../ui/typography';
import RakudaPresenceEmoji from './RakudaPresenceEmoji';
import { RK19QuietRoomBackButton } from '../../../ui/baselineParts';
import type { PlayRecruitBadgesByUid } from '../../../hooks/useActiveUserPlayRecruitBadges';
import type { ActiveUser } from '../types';
import PlayInviteBadge from './PlayInviteBadge';
import { PlayRecruitBadgesInline } from './PlayRecruitBadgesInline';

const Header: React.FC<{
  onBack: () => void;
  variant?: 'default' | 'hundred';
  /** 未指定時は従来どおり「みんなであそぶ（掲示板）」（例: `/keijiban` では「掲示板」） */
  title?: string;
  /** 見出し直下に「今いる人」の絵文字だけ並べる（`/keijiban` 用） */
  activeUsers?: ActiveUser[];
  showActiveUserEmojis?: boolean;
  playRecruitBadgesByUid?: PlayRecruitBadgesByUid;
  currentUid?: string | null;
  onSelfEmojiClick?: () => void;
  myGreenUntilMs?: number | null;
  myShussekiRegular?: boolean;
}> = ({
  onBack,
  variant = 'default',
  title,
  activeUsers = [],
  showActiveUserEmojis = false,
  playRecruitBadgesByUid = {},
  currentUid,
  onSelfEmojiClick,
  myGreenUntilMs = null,
  myShussekiRegular = false,
}) => {
  const isHundred = variant === 'hundred';
  const visibleUsers = showActiveUserEmojis ? activeUsers.slice(0, 16) : [];
  const overflowCount =
    showActiveUserEmojis && activeUsers.length > visibleUsers.length
      ? activeUsers.length - visibleUsers.length
      : 0;

  return (
    <header
      className={
        isHundred
          ? 'relative z-30 shrink-0 bg-[var(--rk-hub-bark)] border-b border-[var(--rk-hub-bark-deep)] p-3 shadow-md'
          : 'relative z-30 shrink-0 bg-rk-amber-50 border-b border-rk-amber-200 p-3 shadow-sm'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <RK19QuietRoomBackButton onClick={onBack} title="らくだ珈琲のトップへもどる" />
        <div className="min-w-0 flex flex-1 flex-col items-center">
          <h1
            className={`min-w-0 flex items-center gap-2 ${pageTopHeadingClass} ${isHundred ? 'text-rk-white' : 'text-rk-amber-950'}`}
          >
            <span className="text-base leading-none shrink-0" aria-hidden>
              📝
            </span>
            <span className="truncate">{title ?? 'みんなであそぶ（掲示板）'}</span>
          </h1>
          {showActiveUserEmojis && visibleUsers.length > 0 ? (
            <div
              className="mt-1.5 flex max-w-full flex-wrap items-center justify-center gap-1.5"
              aria-label={`掲示板に ${activeUsers.length} 人`}
            >
              {visibleUsers.map((u) => {
                const isSelf = !!currentUid && u.uid === currentUid;
                const canOpenBreak = isSelf && !!onSelfEmojiClick;
                const titleText = u.onBreak
                  ? `${u.name || 'ななし'}（休憩中 — らくだにいますが画面は見ていません）`
                  : u.playInvite
                    ? `${u.name || 'ななし'}（一緒に遊ぶ？）`
                    : u.name || 'ななし';
                const recruitKinds = playRecruitBadgesByUid[u.uid] ?? [];
                const badges = (
                  <>
                    {u.onBreak ? (
                      <span
                        className={`absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] leading-none ${
                          isHundred
                            ? 'border border-rk-white/40 bg-rk-white/25'
                            : 'border border-rk-success-400 bg-rk-success-100'
                        }`}
                        aria-hidden
                      >
                        ☕
                      </span>
                    ) : null}
                    {u.playInvite ? <PlayInviteBadge compact /> : null}
                    <PlayRecruitBadgesInline kinds={recruitKinds} compact />
                  </>
                );

                return (
                  <RakudaPresenceEmoji
                    key={u.uid}
                    user={u}
                    currentUid={currentUid}
                    myGreenUntilMs={myGreenUntilMs}
                    myShussekiRegular={myShussekiRegular}
                    compact
                    hundred={isHundred}
                    selfClickable={canOpenBreak}
                    onClick={canOpenBreak ? onSelfEmojiClick : undefined}
                    title={canOpenBreak ? `${titleText} — 休憩の設定` : titleText}
                    aria-label={canOpenBreak ? `${u.name || 'ななし'}（自分）— 休憩の設定` : undefined}
                  >
                    {badges}
                  </RakudaPresenceEmoji>
                );
              })}
              {overflowCount > 0 ? (
                <span
                  className={`text-[10px] font-bold tabular-nums ${isHundred ? 'text-rk-white/90' : 'text-rk-amber-900/80'}`}
                >
                  +{overflowCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* 戻るボタンと幅を揃える（旧: 広告あり/なしトグル） */}
        <div className="w-12 h-12 shrink-0" aria-hidden />
      </div>
    </header>
  );
};

export default Header;
