import { spawn } from 'node:child_process';
import path from 'node:path';

/** SANJUU のみ（らくだ Vite は起動しない）。`npm run dev:sanjuu` から利用。 */

const SANJUU_DIR = path.join(process.cwd(), 'SANJUU');

const child = spawn('node', ['scripts/dev.mjs'], {
  cwd: SANJUU_DIR,
  stdio: 'inherit',
  shell: 'cmd.exe',
  env: process.env,
});

child.on('exit', (code) => {
  if (code && code !== 0) process.exitCode = code;
});

child.on('error', () => {
  process.exitCode = 1;
});
