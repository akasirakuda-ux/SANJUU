const DEFAULT_WS = 'ws://localhost:8080/ws';

function ensurePath(url: URL, pathname: string) {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (url.pathname === '/' || url.pathname === '') url.pathname = p;
  else if (!url.pathname.toLowerCase().endsWith(p.toLowerCase())) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}${p}`;
  }
}

/** 環境値が `ws://host:8080` のようにパス抜けでも、エンジン実体である `/ws` に正規化する */
export function normalizedSanjuuWsUrl(input?: string | null): string {
  const s = typeof input === 'string' ? input.trim() : '';
  const raw = s || DEFAULT_WS;
  try {
    const u = new URL(raw);
    ensurePath(u, '/ws');
    return u.href;
  } catch {
    return DEFAULT_WS;
  }
}

/**
 * ブラウザ用 WS URL。
 * `NEXT_PUBLIC_DEV_WS_RELAY=1` のときは同一オリジン `/_engine/ws`（dev リレー）を使い、内蔵ブラウザ等の別ポート WS 制限を避ける。
 * それ以外は従来どおりエンジン直（ホストはページと揃える）。
 */
export function browserSanjuuWsUrl(envUrl?: string | null): string {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEV_WS_RELAY === '1') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/_engine/ws`;
  }
  const base = normalizedSanjuuWsUrl(envUrl);
  if (typeof window === 'undefined') return base;
  try {
    const u = new URL(base);
    u.hostname = window.location.hostname;
    return u.href;
  } catch {
    return base;
  }
}

export function browserSanjuuPlayWsUrl(envPlay?: string | null, envMain?: string | null): string {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEV_WS_RELAY === '1') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/_engine/playws`;
  }
  const s = typeof envPlay === 'string' ? envPlay.trim() : '';
  if (s) {
    try {
      const u = new URL(s);
      ensurePath(u, '/playws');
      if (typeof window !== 'undefined') u.hostname = window.location.hostname;
      return u.href;
    } catch {
      /* fallthrough */
    }
  }
  try {
    const u = new URL(normalizedSanjuuWsUrl(envMain));
    u.pathname = '/playws';
    if (typeof window !== 'undefined') u.hostname = window.location.hostname;
    return u.href;
  } catch {
    return 'ws://localhost:8080/playws';
  }
}

/**
 * エンジン HTTP（/api/*, /healthz）のベース。
 * ページは :3000 でもエンジンは常に :8080 なので、ブラウザからはここを直打ちする（Next 本体に誤爆しない）。
 */
export function browserSanjuuHttpUrl(envHttp?: string | null): string {
  const raw =
    String(envHttp ?? process.env.NEXT_PUBLIC_HTTP_URL ?? process.env.NEXT_PUBLIC_WS_HTTP ?? 'http://localhost:8080').trim() ||
    'http://localhost:8080';
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return 'http://localhost:8080';
  }
}

export function normalizedSanjuuPlayWsUrl(input?: string | null): string {
  const s = typeof input === 'string' ? input.trim() : '';
  if (s) {
    try {
      const u = new URL(s);
      ensurePath(u, '/playws');
      return u.href;
    } catch {
      /* derive from main WS below */
    }
  }
  const main = normalizedSanjuuWsUrl(process.env.NEXT_PUBLIC_WS_URL);
  try {
    const u = new URL(main);
    u.pathname = '/playws';
    return u.href;
  } catch {
    return 'ws://localhost:8080/playws';
  }
}
