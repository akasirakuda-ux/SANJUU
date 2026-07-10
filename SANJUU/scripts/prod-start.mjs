/**
 * Cloud Run エントリ: WS エンジン → Next standalone → 外向きリレー（順起動）
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ENGINE_PORT = Number(process.env.ENGINE_INTERNAL_PORT ?? 8081);
const NEXT_PORT = Number(process.env.NEXT_INTERNAL_PORT ?? 3000);
const RELAY_PORT = Number(process.env.PORT ?? 8080);

function findStandaloneServerEntry() {
  const standaloneRoot = path.join(root, 'web', '.next', 'standalone');
  const candidates = [];
  function walk(d, depth) {
    if (depth > 10 || !fs.existsSync(d)) return;
    const s = path.join(d, 'server.js');
    if (fs.existsSync(s) && !d.includes(`${path.sep}node_modules${path.sep}`)) {
      candidates.push(s);
    }
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (ent.name === 'node_modules') continue;
      walk(path.join(d, ent.name), depth + 1);
    }
  }
  walk(standaloneRoot, 0);
  candidates.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  return candidates[0] ?? null;
}

function fetchOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(!!res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, { label, maxMs = 120_000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await fn()) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(250);
  }
  throw new Error(`timeout waiting for ${label ?? 'condition'}`);
}

const children = [];

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {}
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const engine = spawn(process.execPath, ['dist/index.js'], {
  cwd: path.join(root, 'ws'),
  env: {
    ...process.env,
    PORT: String(ENGINE_PORT),
    HOSTNAME: '127.0.0.1',
    WS_PATH: '/ws',
    PLAY_WS_PATH: '/playws',
    NODE_ENV: 'production',
  },
  stdio: 'inherit',
});
children.push(engine);

await waitFor(() => fetchOk(`http://127.0.0.1:${ENGINE_PORT}/healthz`), { label: 'engine /healthz' });

const copyJs = path.join(root, 'scripts', 'copy-next-static.mjs');
const copyRes = spawnSync(process.execPath, [copyJs], { cwd: root, stdio: 'inherit' });
if (copyRes.status !== 0) {
  shutdown();
  process.exit(copyRes.status ?? 1);
}

const nextServerJs = findStandaloneServerEntry();
if (!nextServerJs) {
  // eslint-disable-next-line no-console
  console.error('[prod-start] Next standalone server.js not found');
  shutdown();
  process.exit(1);
}

const next = spawn(process.execPath, [nextServerJs], {
  cwd: path.dirname(nextServerJs),
  env: {
    ...process.env,
    PORT: String(NEXT_PORT),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
  },
  stdio: 'inherit',
});
children.push(next);

await waitFor(() => fetchOk(`http://127.0.0.1:${NEXT_PORT}/`), { label: 'next http' });

const relay = spawn(process.execPath, [path.join(root, 'scripts', 'prod-relay.mjs')], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(RELAY_PORT),
    ENGINE_INTERNAL_PORT: String(ENGINE_PORT),
    NEXT_INTERNAL_PORT: String(NEXT_PORT),
    NODE_ENV: 'production',
  },
  stdio: 'inherit',
});
children.push(relay);

function onChildExit(code, from) {
  // eslint-disable-next-line no-console
  console.error(`[prod-start] ${from} exited with`, code);
  shutdown();
  process.exit(code === 0 ? 0 : code ?? 1);
}

engine.on('exit', (c) => onChildExit(c === 0 ? 0 : (c ?? 1), 'engine'));
next.on('exit', (c) => onChildExit(c === 0 ? 0 : (c ?? 1), 'next'));
relay.on('exit', (c) => onChildExit(c === 0 ? 0 : (c ?? 1), 'relay'));

await new Promise(() => {});
