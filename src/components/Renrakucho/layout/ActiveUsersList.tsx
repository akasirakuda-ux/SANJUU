import React from 'react';
import { motion } from 'framer-motion';
import type { ActiveUser } from '../types';
import type { PlayRecruitBadgesByUid } from '../../../hooks/useActiveUserPlayRecruitBadges';
import PlayInviteBadge from './PlayInviteBadge';
import { PlayRecruitBadgesInline, recruitLabelPrefix } from './PlayRecruitBadgesInline';
import RakudaPresenceEmoji from './RakudaPresenceEmoji';

const ActiveUsersList: React.FC<{
  activeUsers: ActiveUser[];
  playRecruitBadgesByUid?: PlayRecruitBadgesByUid;
  currentUid?: string | null;
  onSelfEmojiClick?: () => void;
  myGreenUntilMs?: number | null;
  myShussekiRegular?: boolean;
}> = ({ activeUsers, playRecruitBadgesByUid = {}, currentUid, onSelfEmojiClick, myGreenUntilMs = null, myShussekiRegular = false }) => {
  if (activeUsers.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col items-center">
      <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-rk-amber-950">
          今、いる人（{activeUsers.length}人）
        </span>
        <span className="text-[9px] font-bold leading-snug text-rk-amber-900/80">
          自分の絵文字をクリック → 休憩・一緒に遊ぶ？
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-3 rounded-2xl bg-rk-white px-3 py-2 shadow-sm">
        {activeUsers.map((u) => {
          const isSelf = !!currentUid && u.uid === currentUid;
          const canOpenBreak = isSelf && !!onSelfEmojiClick;
          const recruitKinds = playRecruitBadgesByUid[u.uid] ?? [];
          const namePrefix = `${u.onBreak ? '☕ ' : ''}${u.playInvite ? '？ ' : ''}${recruitLabelPrefix(recruitKinds)}`;

          return (
            <motion.div
              key={u.uid}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center gap-1"
            >
              <RakudaPresenceEmoji
                user={u}
                currentUid={currentUid}
                myGreenUntilMs={myGreenUntilMs}
                myShussekiRegular={myShussekiRegular}
                selfClickable={canOpenBreak}
                onClick={canOpenBreak ? onSelfEmojiClick : undefined}
                title={canOpenBreak ? `${u.name || 'ななし'}（自分）— 休憩・一緒に遊ぶ？` : undefined}
                aria-label={canOpenBreak ? `${u.name || 'ななし'}（自分）— 休憩・一緒に遊ぶ？` : undefined}
              >
                {u.onBreak ? (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-rk-success-500 bg-rk-success-100 text-[9px] leading-none"
                    aria-hidden
                  >
                    ☕
                  </span>
                ) : null}
                {u.playInvite ? <PlayInviteBadge /> : null}
                <PlayRecruitBadgesInline kinds={recruitKinds} />
              </RakudaPresenceEmoji>
              <div className="max-w-[48px] truncate rounded-lg border border-rk-slate-200 bg-rk-white px-1.5 py-0.5 text-center text-[8px] font-bold text-rk-amber-950 shadow-sm">
                {namePrefix}
                {u.name}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveUsersList;
