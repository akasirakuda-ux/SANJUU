
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initGoogleAnalytics4 } from './lib/initGa';
import {
  clearFirestoreAssertReloadFlag,
  isFirestoreInternalAssertError,
  reloadOnceForFirestoreAssert,
} from './lib/firestoreAssertRecovery';
import {
  isStaleAppBundleError,
  isStaleChunkLoadError,
  reloadOnceForStaleChunk,
} from './lib/lazyWithReload';
import { syncTabletPhoneCanvasViewport } from './lib/tabletPhoneCanvas';
import './index.css';

initGoogleAnalytics4();
syncTabletPhoneCanvasViewport();
clearFirestoreAssertReloadFlag();
// import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
// registerSW({ immediate: true });

const rootElement = document.getElementById('root');

// 以前の PWA Service Worker が古い JS を返すことがある（iPad 含む）
if (typeof window !== 'undefined') {
  try {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister());
      });
    }
    if ('caches' in window) {
      void caches.keys().then((keys) => {
        keys.forEach((k) => void caches.delete(k));
      });
    }
  } catch {
    // ignore
  }
}

const showFatalOverlay = (title: string, msg: unknown, url?: unknown, lineNo?: unknown, error?: unknown) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '50px';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100%';
  errorDiv.style.background = 'var(--rk-boot-overlay-bg)';
  errorDiv.style.color = 'var(--rk-boot-fatal-accent)';
  errorDiv.style.zIndex = '100000';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontSize = '14px';
  errorDiv.style.fontWeight = 'bold';
  errorDiv.style.wordBreak = 'break-all';
  errorDiv.style.borderBottom = '4px solid var(--rk-boot-fatal-accent)';
  const messageText = typeof msg === 'string' ? msg : (msg instanceof Error ? msg.message : String(msg));
  const stackText =
    (error as any)?.stack ||
    (msg as any)?.stack ||
    (msg instanceof Error ? msg.stack : '') ||
    'スタックトレースなし';
  errorDiv.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 10px;">⚠️ ${title}</div>
    <div>メッセージ: ${messageText}</div>
    ${url ? `<div style="margin-top: 10px; font-size: 10px; opacity: 0.8;">URL: ${url}:${lineNo ?? ''}</div>` : ''}
    <div style="margin-top: 10px; font-family: monospace; font-size: 10px; background: var(--rk-boot-fatal-stack-bg); padding: 10px; border-radius: 8px; white-space: pre-wrap;">${stackText}</div>
    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: var(--rk-boot-fatal-accent); color: var(--rk-white); border: none; border-radius: 8px; font-weight: bold;">再読み込み</button>
  `;
  document.body.appendChild(errorDiv);
};

window.onerror = (msg, url, lineNo, columnNo, error) => {
  // Suppress harmless Vite WebSocket errors
  if (typeof msg === 'string' && (msg.includes('websocket') || msg.includes('WebSocket'))) {
    return true;
  }
  if (isStaleAppBundleError(error ?? msg)) {
    reloadOnceForStaleChunk();
    return true;
  }
  if (isFirestoreInternalAssertError(error ?? msg)) {
    console.warn('[rakuda] Firestore internal assert — reload once', error ?? msg);
    if (reloadOnceForFirestoreAssert()) return true;
  }
  showFatalOverlay('起動エラー', msg, url, lineNo, error);
  return false;
};

window.onunhandledrejection = (event) => {
  // Suppress harmless Vite WebSocket errors
  if (event.reason && event.reason.message && (event.reason.message.includes('websocket') || event.reason.message.includes('WebSocket'))) {
    event.preventDefault();
    return;
  }
  if (isStaleAppBundleError(event.reason)) {
    event.preventDefault();
    reloadOnceForStaleChunk();
    return;
  }
  if (isFirestoreInternalAssertError(event.reason)) {
    console.warn('[rakuda] Firestore internal assert (promise) — reload once', event.reason);
    event.preventDefault();
    if (reloadOnceForFirestoreAssert()) return;
  }
  const reason = event.reason;
  const reasonMsg = reason instanceof Error ? reason.message : String(reason ?? '');
  // スマホで Bluetooth 切断・サイレント等のとき AudioContext.resume が reject してもゲームは続行
  if (/failed to start the audio device/i.test(reasonMsg)) {
    event.preventDefault();
    return;
  }
  const reasonName =
    typeof reason === 'object' && reason !== null && 'name' in reason ? String((reason as { name?: string }).name) : '';
  if (reasonName === 'NotAllowedError' && /audio/i.test(reasonMsg)) {
    event.preventDefault();
    return;
  }
  const firestoreCode =
    typeof reason === 'object' && reason !== null && 'code' in reason
      ? String((reason as { code?: string }).code)
      : '';
  // Firestore の権限・インデックス不足は掲示板本体を止めない（コンソールのみ）
  if (
    firestoreCode === 'permission-denied' ||
    firestoreCode === 'failed-precondition' ||
    /insufficient permissions/i.test(reasonMsg)
  ) {
    console.warn('[rakuda] Firestore promise (non-fatal)', reason);
    event.preventDefault();
    return;
  }
  // Surface real boot-time promise errors (e.g. Firebase init / Firestore channel errors)
  showFatalOverlay('Promiseエラー', event.reason ?? event, undefined, undefined, event.reason);
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// If React fails before first paint, this still gives a visible hint.
rootElement.innerHTML = '<div style="padding:16px;font-family:system-ui;color:var(--rk-boot-loading-fg);">読み込み中…</div>';
root.render(
  <App />
);
