/** アプリ全体のトースト（useAppShell の notification に接続） */
export function showAppToast(message: string): void {
  if (typeof window === 'undefined') return;
  const text = String(message ?? '').trim();
  if (!text) return;
  window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: text }));
}
