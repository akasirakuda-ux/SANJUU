import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const ROOT = process.cwd();
const WS_PORT = Number(process.env.WS_PORT ?? 8080);
/** ブラウザが開く表側ポート（リレー） */
const WEB_PUBLIC = Number(process.env.WEB_PUBLIC_PORT ?? 3000);
/** Next.js が実際に listen する内側ポート */
const WEB_INNER = Number(process.env.WEB_INNER_PORT ?? 3001);
const HEALTHZ_URL = `http://127.0.0.1:${WS_PORT}/healthz`;
const NEXT_ROOT_URL = `http://127.0.0.1:${WEB_INNER}/`;

function log(...args) {
  // eslint-disable-next-line no-console
  console.log(...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function listListeningPidsOnPort(port) {
  // Windows netstat output example:
  // TCP    0.0.0.0:8080     0.0.0.0:0      LISTENING       12345
  const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const local = parts[1];
    const pidStr = parts[4];
    if (!local) continue;
    if (!local.endsWith(`:${port}`)) continue;
    const pid = Number(pidStr);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

function killPid(pid) {
  if (pid === process.pid) return;
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function cleanupPorts(ports) {
  const killed = [];
  for (const port of ports) {
    const pids = listListeningPidsOnPort(port);
    for (const pid of pids) {
      if (killPid(pid)) killed.push({ port, pid });
    }
  }
  return killed;
}

function run(cmd, args, name, cwd = ROOT, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    // Force cmd.exe to avoid relying on npm's script-shell (PowerShell path may be missing in some envs)
    shell: 'cmd.exe',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  child.on('error', (e) => {
    log(`[dev] ${name} failed to start`, e);
    process.exitCode = 1;
  });
  return child;
}

const killed = cleanupPorts([WS_PORT, WEB_PUBLIC, WEB_INNER]);
if (killed.length) log('[dev] cleaned old listeners:', killed.map((k) => `${k.port}->pid${k.pid}`).join(', '));

log(`[dev] starting ws on :${WS_PORT} ...`);
const wsDir = path.join(ROOT, 'ws');
const webDir = path.join(ROOT, 'web');
const ws = run('npm', ['run', 'dev'], 'ws', wsDir);

let ready = false;
for (let i = 0; i < 80; i++) {
  // ~8s max
  if (await fetchOk(HEALTHZ_URL)) {
    ready = true;
    break;
  }
  await sleep(100);
}

if (!ready) {
  log(`[dev] ws healthz not ready: ${HEALTHZ_URL}`);
  try {
    ws.kill('SIGTERM');
  } catch {}
  process.exit(1);
}

log(`[dev] ws ready, starting web (inner :${WEB_INNER}) ...`);
const web = run('npm', ['run', 'dev', '--', '-p', String(WEB_INNER)], 'web', webDir);

let nextReady = false;
for (let i = 0; i < 100; i++) {
  if (await fetchOk(NEXT_ROOT_URL)) {
    nextReady = true;
    break;
  }
  await sleep(200);
}
if (!nextReady) {
  log(`[dev] next not ready: ${NEXT_ROOT_URL}`);
  try {
    web.kill('SIGTERM');
  } catch {}
  try {
    ws.kill('SIGTERM');
  } catch {}
  process.exit(1);
}

log(`[dev] starting relay :${WEB_PUBLIC} -> next :${WEB_INNER} + engine ws`);
const relay = run(
  'node',
  ['scripts/dev-relay.mjs'],
  'relay',
  ROOT,
  {
    RELAY_PORT: String(WEB_PUBLIC),
    NEXT_INNER_PORT: String(WEB_INNER),
  }
);

function shutdown() {
  try {
    relay.kill('SIGTERM');
  } catch {}
  try {
    web.kill('SIGTERM');
  } catch {}
  try {
    ws.kill('SIGTERM');
  } catch {}
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

