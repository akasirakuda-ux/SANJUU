/**
 * 本番 Cloud Run: 外向き :PORT（既定8080）で HTTP/WS を受け、
 * - /api/play/* · /healthz（および本体と同型のパス）は WS エンジン（内側 :ENGINE_PORT）
 * - WebSocket /sanjuu/ws · /sanjuu/playws はエンジンの /ws · /playws
 * - それ以外は Next standalone（内側 :NEXT_PORT）
 */
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const httpProxy = require('http-proxy');

const RELAY_PORT = Number(process.env.PORT ?? 8080);
const NEXT_PORT = Number(process.env.NEXT_INTERNAL_PORT ?? 3000);
const ENGINE = `http://127.0.0.1:${Number(process.env.ENGINE_INTERNAL_PORT ?? 8081)}`;
const WS_MOUNT = (process.env.SANJUU_WS_PATH ?? '/sanjuu/ws').replace(/\/+$/, '') || '/sanjuu/ws';
const PLAY_MOUNT = (process.env.SANJUU_PLAY_WS_PATH ?? '/sanjuu/playws').replace(/\/+$/, '') || '/sanjuu/playws';

const proxyNext = httpProxy.createProxyServer({ changeOrigin: true, ws: true });
const proxyEngine = httpProxy.createProxyServer({ changeOrigin: true, ws: true });

function logErr(tag, err) {
  // eslint-disable-next-line no-console
  console.error(`[prod-relay] ${tag}`, err?.message ?? err);
}

proxyNext.on('error', (err) => logErr('next', err));
proxyEngine.on('error', (err) => logErr('engine', err));

function pathOnly(url) {
  try {
    return new URL(url, 'http://127.0.0.1').pathname;
  } catch {
    return url.split('?')[0] || '/';
  }
}

const server = http.createServer((req, res) => {
  const p = pathOnly(req.url || '/');

  if (p === '/healthz' || p.startsWith('/healthz?')) {
    proxyEngine.web(req, res, { target: ENGINE });
    return;
  }
  if (p.startsWith('/api/play')) {
    proxyEngine.web(req, res, { target: ENGINE });
    return;
  }

  proxyNext.web(req, res, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.on('upgrade', (req, socket, head) => {
  socket.on('error', (e) => logErr('client-socket', e));

  const p = pathOnly(req.url || '/');

  if (p === '/_engine/ws' || p.startsWith('/_engine/ws?')) {
    req.url = '/ws';
    proxyEngine.ws(req, socket, head, { target: ENGINE });
    return;
  }
  if (p === '/_engine/playws' || p.startsWith('/_engine/playws?')) {
    req.url = '/playws';
    proxyEngine.ws(req, socket, head, { target: ENGINE });
    return;
  }
  if (p === WS_MOUNT || p.startsWith(`${WS_MOUNT}?`)) {
    req.url = '/ws';
    proxyEngine.ws(req, socket, head, { target: ENGINE });
    return;
  }
  if (p === PLAY_MOUNT || p.startsWith(`${PLAY_MOUNT}?`)) {
    req.url = '/playws';
    proxyEngine.ws(req, socket, head, { target: ENGINE });
    return;
  }
  if (p === '/ws' || p.startsWith('/ws?')) {
    proxyEngine.ws(req, socket, head, { target: ENGINE });
    return;
  }
  if (p === '/playws' || p.startsWith('/playws?')) {
    proxyEngine.ws(req, socket, head, { target: ENGINE });
    return;
  }

  proxyNext.ws(req, socket, head, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.listen(RELAY_PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(
    `[prod-relay] :${RELAY_PORT} next :${NEXT_PORT} engine ${ENGINE} ws ${WS_MOUNT} play ${PLAY_MOUNT}`
  );
});
