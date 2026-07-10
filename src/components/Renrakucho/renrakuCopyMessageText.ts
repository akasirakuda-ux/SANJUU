/** 掲示板メッセージ本文をクリップボードへ（引用・共有用） */
export async function copyRenrakuMessageText(text: string): Promise<boolean> {
  const value = String(text ?? '').trim();
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function toastRenrakuCopyResult(ok: boolean) {
  window.dispatchEvent(
    new CustomEvent('SHOW_TOAST', {
      detail: ok ? 'コピーしました' : 'コピーできませんでした',
    })
  );
}
