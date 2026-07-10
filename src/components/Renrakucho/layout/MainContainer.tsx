import React from 'react';
import type { PlayRecruitBadgesByUid } from '../../../hooks/useActiveUserPlayRecruitBadges';
import type { ActiveUser } from '../types';
import ActiveUsersList from './ActiveUsersList';

const MainContainer: React.FC<{
  activeUsers: ActiveUser[];
  playRecruitBadgesByUid?: PlayRecruitBadgesByUid;
  children: React.ReactNode;
  variant?: 'default' | 'hundred';
  suppressActiveUsersStrip?: boolean;
  currentUid?: string | null;
  myGreenUntilMs?: number | null;
  myShussekiRegular?: boolean;
  onSelfEmojiClick?: () => void;
}> = ({
  activeUsers,
  playRecruitBadgesByUid,
  children,
  variant = 'default',
  suppressActiveUsersStrip = false,
  currentUid,
  myGreenUntilMs = null,
  myShussekiRegular = false,
  onSelfEmojiClick,
}) => {
  return (
    <main
      className={
        variant === 'hundred'
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-rk-red-50'
          : 'flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--rk-hub-parchment-screen)]'
      }
    >
      {!suppressActiveUsersStrip ? (
        <div className="shrink-0 px-4 pt-3">
          <ActiveUsersList
            activeUsers={activeUsers}
            playRecruitBadgesByUid={playRecruitBadgesByUid}
            currentUid={currentUid}
            myGreenUntilMs={myGreenUntilMs}
            myShussekiRegular={myShussekiRegular}
            onSelfEmojiClick={onSelfEmojiClick}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+var(--rk-bottom-banner,0px))]">
        {children}
      </div>
    </main>
  );
};

export default MainContainer;
