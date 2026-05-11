/**
 * 開発用: ブラウザは常に :RELAY_PORT（既定 3000）だけに接続し、
 * - HTTP は Next（:NEXT_INNER_PORT）
 * - `/_engine/ws` と `/_engine/playws` の Upgrade はエンジン（:8080）
 * に振り分ける（内蔵ブラウザが別ポート WS を弾く場合の回避）。
 */
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const httpProxy = require('http-proxy');

const RELAY_PORT = Number(process.env.RELAY_PORT ?? 3000);
const NEXT_PORT = Number(process.env.NEXT_INNER_PORT ?? 3001);
const ENGINE = 'http://127.0.0.1:8080';

// Next と engine でプロキシを分ける（共有だと WS 昇格時に状態が壊れることがある）
const proxyNext = httpProxy.createProxyServer({ changeOrigin: true, ws: true });
const proxyEngine = httpProxy.createProxyServer({ changeOrigin: true, ws: true });

function logErr(tag, err) {
  // eslint-disable-next-line no-console
  console.error(`[relay] ${tag}`, err?.message ?? err);
}

proxyNext.on('error', (err) => logErr('next', err));
proxyEngine.on('error', (err) => logErr('engine', err));

const server = http.createServer((req, res) => {
  proxyNext.web(req, res, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.on('upgrade', (req, socket, head) => {
  socket.on('error', (e) => logErr('client-socket', e));

  const p = req.url || '';
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
  proxyNext.ws(req, socket, head, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.listen(RELAY_PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[relay] :${RELAY_PORT} -> next :${NEXT_PORT}, engine ${ENGINE} (/_engine/ws|playws)`);
});
