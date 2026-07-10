/** らくださんの note プロフィール（例: https://note.com/akasirakuda） */
export function getRakudaNoteUrl(): string | null {
  const raw = import.meta.env.VITE_RAKUDA_NOTE_URL;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch {
    return null;
  }
}

export function openRakudaNote(): void {
  const noteUrl = getRakudaNoteUrl();
  if (!noteUrl) {
    window.dispatchEvent(
      new CustomEvent('SHOW_TOAST', {
        detail: 'らくだの記事（note）は準備中です',
      }),
    );
    return;
  }
  window.open(noteUrl, '_blank', 'noopener,noreferrer');
}
