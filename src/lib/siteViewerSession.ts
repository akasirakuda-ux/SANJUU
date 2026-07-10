const SITE_VIEWER_SESSION_KEY = 'rk_site_viewer_guest_id_v1';

function randomSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest_${crypto.randomUUID()}`;
  }
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 端末ごとの在籍ID（ログインと無関係・PCとスマホは別カウント） */
export function getSiteViewerSessionId(): string {
  if (typeof window === 'undefined') return randomSessionId();
  try {
    const existing = window.localStorage.getItem(SITE_VIEWER_SESSION_KEY)?.trim();
    if (existing?.startsWith('guest_')) return existing;
    const id = randomSessionId();
    window.localStorage.setItem(SITE_VIEWER_SESSION_KEY, id);
    return id;
  } catch {
    return randomSessionId();
  }
}

/** Firestore 在籍ドキュメントID（常に端末セッション） */
export function resolveSiteViewerPresenceId(): string {
  return getSiteViewerSessionId();
}
