/**
 * らくだ API（server.mjs）を Cloud Run `rakuda-api` へデプロイ。
 *
 * Stripe 等の秘密は Git に載せない。任意でリポジトリ直下に
 * `.env.rakuda-api.local`（KEY=VALUE）を置くと --set-env-vars に渡す。
 *
 * 用法: node scripts/deploy-rakuda-api.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SERVICE = 'rakuda-api';
const REGION = 'asia-northeast1';
const PROJECT = process.env.GCLOUD_PROJECT?.trim() || 'rakuda-coffee';

const ALLOWED_ENV_KEYS = new Set([
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_GREEN_PRICE_ID',
  'APP_PUBLIC_ORIGIN',
  'FORCE_SECURE_COOKIE',
  'SANJUU_WEB_PROXY_TARGET',
  'SANJUU_WS_PROXY_TARGET',
  'CANONICAL_HOST',
  'LEGACY_HOST',
  'ROBO_PICKUP_CRON_SECRET',
  'GEMINI_API_KEY',
  'GEMINI_API_KEY_2',
]);

function loadLocalEnv() {
  const file = path.join(root, '.env.rakuda-api.local');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!ALLOWED_ENV_KEYS.has(key) || !val) continue;
    if (key === 'GEMINI_API_KEY' || key === 'GEMINI_API_KEY_2') {
      val = val.replace(/^[\s"'「『（(\[]+|[\s"'」』）)\]]+$/g, '').trim().replace(/[^\x21-\x7E]/g, '');
    }
    if (val) out[key] = val;
  }
  return out;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const envMap = {
  APP_PUBLIC_ORIGIN: 'https://rakuda.coffee',
  FORCE_SECURE_COOKIE: '1',
  ...loadLocalEnv(),
};

const envArg = Object.entries(envMap)
  .map(([k, v]) => `${k}=${v}`)
  .join(',');

console.log(`[deploy-rakuda-api] project=${PROJECT} service=${SERVICE} region=${REGION}`);
if (!envMap.STRIPE_SECRET_KEY) {
  console.warn('[deploy-rakuda-api] STRIPE_SECRET_KEY 未設定 — Checkout は 503 まで。後から Cloud Run コンソールか .env.rakuda-api.local で追加可。');
}
if (!envMap.GEMINI_API_KEY && !envMap.GEMINI_API_KEY_2) {
  console.warn('[deploy-rakuda-api] GEMINI_API_KEY 未設定 — 連続小説「今日のお題」の自動生成は 503 まで。');
}

run('gcloud', [
  'run',
  'deploy',
  SERVICE,
  '--source',
  '.',
  '--region',
  REGION,
  '--project',
  PROJECT,
  '--allow-unauthenticated',
  '--port',
  '8080',
  '--set-env-vars',
  envArg,
]);

console.log('[deploy-rakuda-api] OK');
console.log(`[deploy-rakuda-api] Webhook URL: https://rakuda.coffee/api/stripe/webhook`);
console.log('[deploy-rakuda-api] 次: firebase deploy --only hosting（rewrite 反映）');
