/**
 * 三十（SANJUU）を Cloud Run `sanjuu` へデプロイ。
 *
 * 用法: node scripts/deploy-sanjuu.mjs
 * ビルド元: リポジトリ直下の SANJUU/（Dockerfile）
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sanjuuDir = path.join(root, 'SANJUU');

const SERVICE = 'sanjuu';
const REGION = 'asia-northeast1';
const PROJECT = process.env.GCLOUD_PROJECT?.trim() || 'rakuda-coffee';

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`[deploy-sanjuu] project=${PROJECT} service=${SERVICE} region=${REGION}`);
console.log(`[deploy-sanjuu] source=${sanjuuDir}`);

run('gcloud', [
  'run',
  'deploy',
  SERVICE,
  '--source',
  sanjuuDir,
  '--region',
  REGION,
  '--project',
  PROJECT,
  '--allow-unauthenticated',
  '--port',
  '8080',
]);

console.log('[deploy-sanjuu] OK');
console.log('[deploy-sanjuu] 次: .env.production の VITE_SANJUU_WEB_ORIGIN がこの URL と一致しているか確認 → 必要なら deploy:hosting');
