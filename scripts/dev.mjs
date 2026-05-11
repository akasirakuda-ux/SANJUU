import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * フル開発起動: らくだ（Vite :5173）＋ SANJUU（`SANJUU/scripts/dev.mjs`）。
 * プロジェクトルートで `npm run dev` を実行すること（`PS C:\Users\STYLE>` のままでは動かない）。
 */

const ROOT = process.cwd();
const SANJUU_DIR = path.join(ROOT, 'SANJUU');

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function killChildren() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

console.log('[dev] repo root:', ROOT);
console.log('[dev] rakuda (Vite) http://localhost:5173/ を起動します …');

const rakuda = spawn('npm', ['run', 'dev:rakuda'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: 'cmd.exe',
  env: process.env,
});
children.push(rakuda);

console.log('[dev] SANJUU（ws / Next / relay）を起動します …');

const sanjuu = spawn('node', ['scripts/dev.mjs'], {
  cwd: SANJUU_DIR,
  stdio: 'inherit',
  shell: 'cmd.exe',
  env: process.env,
});
children.push(sanjuu);

let shuttingDown = false;

function noteExit(which, code, signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  const detail = signal ? `signal=${signal}` : `code=${code}`;
  console.log(`[dev] ${which} が終了しました (${detail})。もう一方を止めます。`);
  killChildren();
  let exitCode = 1;
  if (signal === 'SIGINT') exitCode = 130;
  else if (signal === 'SIGTERM') exitCode = 143;
  else if (code === 0) exitCode = 0;
  else if (typeof code === 'number') exitCode = code;
  process.exit(exitCode);
}

rakuda.on('exit', (code, signal) => noteExit('rakuda (Vite)', code, signal));
sanjuu.on('exit', (code, signal) => noteExit('SANJUU', code, signal));

function stop(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[dev] ${sig} を受け取りました。子プロセスを終了します…`);
  killChildren();
  process.exit(sig === 'SIGINT' ? 130 : 143);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
