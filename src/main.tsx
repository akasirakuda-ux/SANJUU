
import React from 'react';
console.log('index.tsx entry point hit');
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
// registerSW({ immediate: true });

const rootElement = document.getElementById('root');

// In dev, a previously-registered PWA Service Worker can keep serving stale/broken assets.
// Force-unregister SW + clear caches to recover from "white screen" situations.
if (import.meta.env.DEV && typeof window !== 'undefined') {
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
  errorDiv.style.background = 'rgba(0,0,0,0.9)';
  errorDiv.style.color = '#ff4444';
  errorDiv.style.zIndex = '100000';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontSize = '14px';
  errorDiv.style.fontWeight = 'bold';
  errorDiv.style.wordBreak = 'break-all';
  errorDiv.style.borderBottom = '4px solid #ff4444';
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
    <div style="margin-top: 10px; font-family: monospace; font-size: 10px; background: #222; padding: 10px; border-radius: 8px; white-space: pre-wrap;">${stackText}</div>
    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 8px; font-weight: bold;">再読み込み</button>
  `;
  document.body.appendChild(errorDiv);
};

window.onerror = (msg, url, lineNo, columnNo, error) => {
  // Suppress harmless Vite WebSocket errors
  if (typeof msg === 'string' && (msg.includes('websocket') || msg.includes('WebSocket'))) {
    return true;
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
  // Surface real boot-time promise errors (e.g. Firebase init / Firestore channel errors)
  showFatalOverlay('Promiseエラー', event.reason ?? event, undefined, undefined, event.reason);
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// If React fails before first paint, this still gives a visible hint.
rootElement.innerHTML = '<div style="padding:16px;font-family:system-ui;color:#334155;">読み込み中…</div>';
root.render(
  <App />
);
