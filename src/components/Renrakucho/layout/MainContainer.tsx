import React from 'react';
import type { ActiveUser } from '../types';
import ActiveUsersList from './ActiveUsersList';

const MainContainer: React.FC<{
  activeUsers: ActiveUser[];
  children: React.ReactNode;
  variant?: 'default' | 'hundred';
  suppressActiveUsersStrip?: boolean;
}> = ({ activeUsers, children, variant = 'default', suppressActiveUsersStrip = false }) => {
  return (
    <main
      className={
        variant === 'hundred'
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-red-50'
          : 'flex min-h-0 flex-1 flex-col overflow-hidden bg-[#faf6f0]'
      }
    >
      {!suppressActiveUsersStrip ? (
        <div className="shrink-0 px-4 pt-3">
          <ActiveUsersList activeUsers={activeUsers} />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[env(safe-area-inset-bottom)]">{children}</div>
    </main>
  );
};

export default MainContainer;
