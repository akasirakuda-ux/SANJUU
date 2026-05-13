import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppRouter from './components/AppRouter';
import AppLayout from './components/AppLayout';
import AppHeader from './components/AppHeader';
import { useAppShell } from './hooks/useAppShell';

const App: React.FC = () => {
  const { appLayoutProps, appRouterProps, headerProps, isBanned, banUserName } = useAppShell();

  return (
    <ErrorBoundary>
      <AppLayout {...appLayoutProps}>
        <AppHeader {...headerProps} />
        {isBanned ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border-4 border-red-800 bg-red-50 p-6 shadow-xl">
              <div className="text-red-900 font-black text-2xl mb-2">ご利用いただけません</div>
              <div className="text-red-900 font-bold text-sm leading-relaxed">
                {banUserName ? `対象: ${banUserName}` : null}
                <div className="mt-2">
                  このアカウントは「出禁リスト」に登録されているため、らくだ珈琲🐫☕を利用できません。
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AppRouter {...appRouterProps} />
        )}
      </AppLayout>
    </ErrorBoundary>
  );
};

export default App;
