
import React from 'react';
import {
  isStaleAppBundleError,
  reloadOnceForStaleChunk,
} from '../lib/lazyWithReload';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): any {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    if (isStaleAppBundleError(error)) {
      reloadOnceForStaleChunk();
    }
  }

  render() {
    if ((this as any).state.hasError) {
      const err = (this as any).state.error;
      let displayMessage = '申し訳ありません。エラーが発生しました。';
      if (isStaleAppBundleError(err)) {
        displayMessage =
          'アプリが更新されました。下のボタンで再読み込みすると、問題画面へ進めます。';
      } else {
        try {
          const errInfo = JSON.parse(err?.message);
          if (errInfo.error.includes('Missing or insufficient permissions')) {
            displayMessage =
              'アクセス権限がありません。ログインし直すか、管理者にお問い合わせください。';
          }
        } catch (e) {
          /* ignore */
        }
      }

      return (
        <div className="fixed inset-0 bg-rk-amber-50 flex flex-col items-center justify-center p-6 text-center z-[10000]">
          <div className="bg-rk-white p-8 rounded-3xl shadow-2xl border-4 border-rk-amber-200 max-w-md">
            <div className="text-6xl mb-4">🐫💦</div>
            <h2 className="text-2xl font-black text-rk-amber-900 mb-4">エラーが発生しました</h2>
            <p className="text-rk-amber-700 mb-8 font-bold leading-relaxed">
              {displayMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-rk-amber-600 text-rk-white rounded-2xl font-black shadow-lg active:scale-95 transition-all"
            >
              再読み込みする
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
