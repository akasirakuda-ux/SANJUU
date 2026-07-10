import React, { Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppRouter from './components/AppRouter';
import AppLayout from './components/AppLayout';
import AppHeader from './components/AppHeader';
import { useAppShell } from './hooks/useAppShell';
import { useTabletPhoneCanvasForScreen } from './hooks/useTabletPhoneCanvas';
import {
  checkForStaleMainBundle,
  clearStaleChunkReloadFlag,
  lazyWithReload,
} from './lib/lazyWithReload';
import { closeUiCatalogHash, isUiCatalogHash } from './ui/RakudaUiCatalog';
import RakudaDevGridOverlay from './components/RakudaDevGridOverlay';
import RakudaGateSelection from './components/RakudaGateSelection';
import GreenPassEntryScreen from './components/GreenPassEntryScreen';
import { isGreenPassEntryPath } from './lib/greenGatePassConfig';

const RakudaUiCatalog = lazyWithReload(() =>
  import('./ui/RakudaUiCatalog').then((m) => ({ default: m.RakudaUiCatalog })),
);

function CatalogFallback() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-rk-shell text-rk-slate-800 font-rounded">
      <p className="text-sm font-black">UI カタログを読み込み中…</p>
    </div>
  );
}

const App: React.FC = () => {
  const {
    appLayoutProps,
    appRouterProps,
    headerProps,
    isBanned,
    banUserName,
    banReason,
    showGateSelection,
    handleSelectGate,
    handleGreenPassRedeem,
    greenPassBusy,
    greenPassStatusMessage,
    greenPassStatusTone,
  } = useAppShell();
  const [greenPassEntryOpen, setGreenPassEntryOpen] = useState(() => isGreenPassEntryPath());
  /** iPad: 画面種別で viewport を切替（ことば探し=実幅、トップハブ=390px 拡大） */
  useTabletPhoneCanvasForScreen(appRouterProps.screen);
  const [catalogOpen, setCatalogOpen] = useState(() => isUiCatalogHash());

  useEffect(() => {
    clearStaleChunkReloadFlag();
    if (!import.meta.env.DEV) {
      checkForStaleMainBundle();
    }
  }, []);

  useEffect(() => {
    const sync = () => setCatalogOpen(isUiCatalogHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    const syncPassPath = () => setGreenPassEntryOpen(isGreenPassEntryPath());
    window.addEventListener('popstate', syncPassPath);
    return () => window.removeEventListener('popstate', syncPassPath);
  }, []);

  const leaveGreenPassEntry = () => {
    window.history.replaceState({}, '', '/');
    setGreenPassEntryOpen(false);
  };

  if (greenPassEntryOpen && !isBanned) {
    return (
      <ErrorBoundary>
        {import.meta.env.DEV ? <RakudaDevGridOverlay /> : null}
        <GreenPassEntryScreen
          onRedeem={handleGreenPassRedeem}
          busy={greenPassBusy}
          statusMessage={greenPassStatusMessage}
          statusTone={greenPassStatusTone}
          onLeaveToHub={leaveGreenPassEntry}
        />
      </ErrorBoundary>
    );
  }

  if (catalogOpen) {
    return (
      <ErrorBoundary>
        {import.meta.env.DEV ? <RakudaDevGridOverlay /> : null}
        <Suspense fallback={<CatalogFallback />}>
          <RakudaUiCatalog onClose={() => { setCatalogOpen(false); closeUiCatalogHash(); }} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {import.meta.env.DEV ? <RakudaDevGridOverlay /> : null}
      <AppLayout {...appLayoutProps}>
        {!showGateSelection ? (
          <AppHeader {...headerProps} />
        ) : null}
        {isBanned ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border-4 border-rk-red-800 bg-rk-red-50 p-6 shadow-xl">
              <div className="text-rk-red-900 font-black text-2xl mb-2">ご利用いただけません</div>
              <div className="text-rk-red-900 font-bold text-sm leading-relaxed">
                {banUserName ? `対象: ${banUserName}` : null}
                <div className="mt-2">
                  レッドカードが付与されているため、らくだ珈琲🐫☕を利用できません。
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AppRouter {...appRouterProps} />
        )}
        {!isBanned && showGateSelection ? (
          <RakudaGateSelection onSelectGate={handleSelectGate} />
        ) : null}
      </AppLayout>
    </ErrorBoundary>
  );
};

export default App;
