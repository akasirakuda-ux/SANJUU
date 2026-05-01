
import React from 'react';

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
  }

  render() {
    if ((this as any).state.hasError) {
      let displayMessage = "申し訳ありません。エラーが発生しました。";
      try {
        const errInfo = JSON.parse((this as any).state.error.message);
        if (errInfo.error.includes('Missing or insufficient permissions')) {
          displayMessage = "アクセス権限がありません。ログインし直すか、管理者にお問い合わせください。";
        }
      } catch (e) {}

      return (
        <div className="fixed inset-0 bg-amber-50 flex flex-col items-center justify-center p-6 text-center z-[10000]">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-amber-200 max-w-md">
            <div className="text-6xl mb-4">🐫💦</div>
            <h2 className="text-2xl font-black text-amber-900 mb-4">エラーが発生しました</h2>
            <p className="text-amber-700 mb-8 font-bold leading-relaxed">
              {displayMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all"
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
