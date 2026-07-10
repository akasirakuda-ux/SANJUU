import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { registerStripeGreenGateApi, registerStripeGreenGateWebhook } from './server/stripeGreenGate.mjs';
import { registerGreenGatePassApi } from './server/greenGatePass.mjs';
import { registerRoboPickupLoungeApi } from './server/roboPickupLounge.mjs';
import { registerRelayStoryTodayPromptApi } from './server/relayStoryTodayPrompt.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT ?? 8080);

const distDir = path.join(__dirname, 'dist');

app.disable('x-powered-by');

const require = createRequire(import.meta.url);
const httpProxy = require('http-proxy');

let _admin = null;
async function getFirebaseAdmin() {
  if (_admin) return _admin;
  const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ]);
  const app = initializeApp();
  _admin = { auth: getAuth(app), db: getFirestore(app) };
  return _admin;
}

registerStripeGreenGateWebhook(app, { getFirebaseAdmin, express });

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false }));

/**
 * Canonical host redirect.
 * Keep the historical Cloud Run URL working, but redirect human navigation to the canonical domain.
 */
const CANONICAL_HOST = (process.env.CANONICAL_HOST ?? 'rakuda.coffee').trim().toLowerCase();
const LEGACY_HOST = (process.env.LEGACY_HOST ?? 'remix-732792089650.us-west1.run.app').trim().toLowerCase();
app.use((req, res, next) => {
  try {
    const host = String(req.headers.host ?? '').split(':')[0]?.trim().toLowerCase();
    const isLegacy = host === LEGACY_HOST;
    const isCanonical = host === CANONICAL_HOST;
    if (!isLegacy || isCanonical) return next();

    // Don't redirect API calls (keep them functional even if someone uses the legacy host).
    const p = req.path || '';
    if (p.startsWith('/api/')) return next();

    // Redirect only safe navigation methods.
    const m = String(req.method || 'GET').toUpperCase();
    if (!(m === 'GET' || m === 'HEAD')) return next();

    const target = `https://${CANONICAL_HOST}${req.originalUrl || '/'}`;
    res.redirect(301, target);
  } catch {
    next();
  }
});

// Safety belt: keep `/api/*` out of SPA/static fallbacks.
// (Some infra / proxies can mis-route; returning JSON here makes failures obvious.)
app.use('/api', (_req, res, next) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  next();
});

/**
 * Reverse proxy to SANJUU (sub-app).
 *
 * - HTTP: `/sanjuu/*` -> SANJUU web (Next)
 * - WS:   `/ws`       -> SANJUU ws engine
 *
 * Targets should be set by runtime env (Cloud Run / local):
 * - SANJUU_WEB_PROXY_TARGET (e.g. https://sanjuu.example.com)
 * - SANJUU_WS_PROXY_TARGET  (e.g. wss://sanjuu.example.com/ws OR ws://127.0.0.1:8080/ws)
 */
const SANJUU_WEB_PROXY_TARGET = String(process.env.SANJUU_WEB_PROXY_TARGET ?? '').trim() || 'http://127.0.0.1:3000';
const SANJUU_WS_PROXY_TARGET =
  String(process.env.SANJUU_WS_PROXY_TARGET ?? '').trim() || 'ws://127.0.0.1:8080/ws';

const proxySanjuuWeb = httpProxy.createProxyServer({ changeOrigin: true, ws: false });
const proxySanjuuWs = httpProxy.createProxyServer({ changeOrigin: true, ws: true });

function proxyErr(tag, err) {
  // eslint-disable-next-line no-console
  console.error(`[proxy:${tag}]`, err?.message ?? err);
}
proxySanjuuWeb.on('error', (err) => proxyErr('sanjuu-web', err));
proxySanjuuWs.on('error', (err) => proxyErr('sanjuu-ws', err));

registerStripeGreenGateApi(app, { getFirebaseAdmin });
registerGreenGatePassApi(app, { getFirebaseAdmin });
registerRoboPickupLoungeApi(app, { getFirebaseAdmin });
registerRelayStoryTodayPromptApi(app, { getFirebaseAdmin });

// Keep /api endpoints above any proxy / SPA fallbacks.
app.delete(['/api/session', '/api/session/'], (req, res) => {
  const xfp = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
  const secure =
    req.secure ||
    xfp === 'https' ||
    (typeof process.env.FORCE_SECURE_COOKIE === 'string' && process.env.FORCE_SECURE_COOKIE.trim() === '1');
  const parts = ['__session=', 'Max-Age=0', 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  res.setHeader('set-cookie', parts.join('; '));
  res.status(200).json({ ok: true });
});

app.post(['/api/session', '/api/session/'], async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const idToken = String(body.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ ok: false, error: 'idToken required' });
      return;
    }

    const { auth } = await getFirebaseAdmin();
    // 14 days (max recommended by Firebase)
    const expiresIn = 14 * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const xfp = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
    const secure =
      req.secure ||
      xfp === 'https' ||
      (typeof process.env.FORCE_SECURE_COOKIE === 'string' && process.env.FORCE_SECURE_COOKIE.trim() === '1');

    const maxAge = Math.floor(expiresIn / 1000);
    const parts = [
      `__session=${encodeURIComponent(sessionCookie)}`,
      `Max-Age=${maxAge}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (secure) parts.push('Secure');
    res.setHeader('set-cookie', parts.join('; '));

    res.status(200).json({ ok: true });
  } catch (e) {
    console.warn('[api/session]', e);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
});

app.get(['/api/me/profile', '/api/me/profile/'], async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  const empty = { ok: true, profile: { emoji: '', nickname: '' } };

  function parseCookie(header) {
    const out = {};
    const raw = typeof header === 'string' ? header : '';
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (!k) continue;
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
    return out;
  }

  try {
    const authz = String(req.headers.authorization ?? '').trim();
    const m = authz.match(/^Bearer\s+(.+)$/i);
    let token = m?.[1]?.trim();

    // Fallback for same-origin cookie-based sessions.
    // Note: This app doesn't mint cookies itself; if an infra layer sets a Firebase Session Cookie
    // (commonly `__session` on Firebase Hosting), we can still verify it here.
    if (!token) {
      const cookies = parseCookie(req.headers.cookie);
      token =
        String(
          cookies.__session ??
          cookies.session ??
          cookies.rk_session ??
          cookies.rk_id_token ??
          cookies.idToken ??
          ''
        ).trim() || null;
    }

    if (!token) {
      res.status(200).json(empty);
      return;
    }

    const { auth, db } = await getFirebaseAdmin();
    // Try session cookie first (if it's one). If not, fall back to ID token.
    let uid = '';
    try {
      const decoded = await auth.verifySessionCookie(token, true);
      uid = String(decoded?.uid ?? '').trim();
    } catch {
      const decoded = await auth.verifyIdToken(token);
      uid = String(decoded?.uid ?? '').trim();
    }
    if (!uid) {
      res.status(200).json(empty);
      return;
    }

    const snap = await db.collection('rk_users').doc(uid).get();
    const d = snap.exists ? (snap.data() ?? {}) : {};
    const nickname = typeof d.nickname === 'string' ? d.nickname : '';
    const emoji = typeof d.userEmoji === 'string' ? d.userEmoji : '';

    res.status(200).json({ ok: true, profile: { emoji, nickname } });
  } catch (e) {
    console.warn('[api/me/profile]', e);
    res.status(200).json(empty);
  }
});

app.use('/sanjuu', (req, res) => {
  // Never proxy /api/* (safety belt: helps if a future change nests paths).
  if ((req.path || '').startsWith('/api/')) {
    res.status(404).json({ ok: false, error: 'not found' });
    return;
  }
  // Strip `/sanjuu` so SANJUU web can be served as-is.
  // `/sanjuu` -> `/`, `/sanjuu/foo` -> `/foo`
  req.url = (req.url || '').replace(/^\/+/, '/');
  if (req.url === '/' || req.url === '') req.url = '/';
  proxySanjuuWeb.web(req, res, { target: SANJUU_WEB_PROXY_TARGET });
});

app.post('/api/submit-to-teacher', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const payload = {
      seedText: String(body.seedText ?? ''),
      nameText: String(body.nameText ?? ''),
      categoryTitle: String(body.categoryTitle ?? ''),
      difficultyText: String(body.difficultyText ?? ''),
      totalCount: String(body.totalCount ?? ''),
      clearTime: String(body.clearTime ?? ''),
      pointsText: String(body.pointsText ?? ''),
      vCode: String(body.vCode ?? 'DUMMY_DATA'),
    };

    if (!payload.nameText.trim()) {
      res.status(400).json({ ok: false, error: 'name required' });
      return;
    }

    const formActionUrl =
      'https://docs.google.com/forms/d/e/1FAIpQLScgx8M30O6TQTAtDxtxb-ftAs7hv3F5WR53iD79XySoa7HETA/formResponse';
    const formData = new URLSearchParams();
    formData.append('entry.1199053163', payload.seedText || 'なし');
    formData.append('entry.372020919', payload.nameText);
    formData.append('entry.2126071547', payload.categoryTitle);
    formData.append('entry.1550339233', payload.difficultyText);
    formData.append('entry.92185271', String(payload.totalCount ?? ''));
    formData.append('entry.458856475', payload.clearTime);
    formData.append('entry.2094453691', payload.pointsText);
    formData.append('entry.390053549', payload.vCode);

    const r = await fetch(formActionUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formData.toString(),
    });

    // Google Forms often returns 200/302. Treat any 2xx/3xx as success.
    if (r.status >= 400) {
      res.status(502).json({ ok: false, error: `google form status ${r.status}` });
      return;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[submit-to-teacher]', e);
    res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// If an /api route isn't handled above, return JSON 404 (never SPA fallback).
app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'not found' });
});

// Static assets (hashed files, icons, etc.)
app.use(express.static(distDir, { index: false, etag: true, maxAge: '1h' }));

// SPA fallback
// Express 5 + path-to-regexp v8 doesn't accept "*" as a route pattern.
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  try {
    const p = req.url || '';
    if (p === '/ws' || p.startsWith('/ws?')) {
      proxySanjuuWs.ws(req, socket, head, { target: SANJUU_WS_PROXY_TARGET });
      return;
    }
  } catch (e) {
    proxyErr('upgrade', e);
  }
  socket.destroy();
});

server.listen(port, () => {
  console.log(`[server] listening on :${port}`);
  console.log(`[proxy] /sanjuu -> ${SANJUU_WEB_PROXY_TARGET}`);
  console.log(`[proxy] /ws -> ${SANJUU_WS_PROXY_TARGET}`);
});

