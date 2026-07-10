/**
 * 🤖 らくだロボ常設 — Cloud Scheduler（任意・初回シードのみ）
 *
 * 案A（常設）: 毎時00分の強制更新はしない。cron は盤面未生成時だけシード。
 * 既存の毎時ジョブは GCP で停止してよい（`gcloud scheduler jobs pause robo-pickup-hourly`）。
 *
 * 前提: `.env.rakuda-api.local` に ROBO_PICKUP_CRON_SECRET
 * 用法: node scripts/setup-robo-pickup-scheduler.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PROJECT = process.env.GCLOUD_PROJECT?.trim() || 'rakuda-coffee';
const LOCATION = 'asia-northeast1';
const JOB_ID = 'robo-pickup-hourly';
const URI = 'https://rakuda.coffee/api/robo-pickup/cron';

const GCLOUD =
  process.platform === 'win32'
    ? path.join(
        process.env.LOCALAPPDATA || '',
        'Google',
        'Cloud SDK',
        'google-cloud-sdk',
        'bin',
        'gcloud.cmd',
      )
    : 'gcloud';

function loadCronSecret() {
  const file = path.join(root, '.env.rakuda-api.local');
  if (!fs.existsSync(file)) {
    console.error('[setup-robo-pickup-scheduler] .env.rakuda-api.local がありません');
    process.exit(1);
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (key === 'ROBO_PICKUP_CRON_SECRET' && val) return val;
  }
  console.error('[setup-robo-pickup-scheduler] ROBO_PICKUP_CRON_SECRET が未設定です');
  process.exit(1);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runGcloud(args) {
  if (process.platform === 'win32') {
    if (!fs.existsSync(GCLOUD)) {
      console.error('[setup-robo-pickup-scheduler] gcloud not found:', GCLOUD);
      process.exit(1);
    }
    const psArgs = args.map((a) => psQuote(a)).join(' ');
    const ps = `& ${psQuote(GCLOUD)} ${psArgs}`;
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      stdio: 'inherit',
      cwd: root,
      windowsHide: true,
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
    return;
  }
  const r = spawnSync(GCLOUD, args, { stdio: 'inherit', cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const secret = loadCronSecret();

const describe = spawnSync(
  process.platform === 'win32' ? 'powershell.exe' : GCLOUD,
  process.platform === 'win32'
    ? ['-NoProfile', '-Command', `& ${psQuote(GCLOUD)} scheduler jobs describe ${JOB_ID} --location ${LOCATION} --project ${PROJECT}`]
    : ['scheduler', 'jobs', 'describe', JOB_ID, '--location', LOCATION, '--project', PROJECT],
  { stdio: 'pipe', cwd: root, windowsHide: true },
);
const exists = describe.status === 0;

const baseArgs = [
  'scheduler',
  'jobs',
  exists ? 'update' : 'create',
  'http',
  JOB_ID,
  '--location',
  LOCATION,
  '--project',
  PROJECT,
  '--schedule',
  '0 * * * *',
  '--time-zone',
  'Asia/Tokyo',
  '--uri',
  URI,
  '--http-method',
  'POST',
  '--headers',
  `Content-Type=application/json,x-robo-pickup-cron-secret=${secret}`,
  '--message-body',
  '{}',
  '--attempt-deadline',
  '120s',
];

if (!exists) {
  baseArgs.push('--description=RakudaRoboPickupHourly');
}

console.log(`[setup-robo-pickup-scheduler] ${exists ? 'update' : 'create'} ${JOB_ID} (${LOCATION})`);
runGcloud(baseArgs);

runGcloud([
  'scheduler',
  'jobs',
  'describe',
  JOB_ID,
  '--location',
  LOCATION,
  '--project',
  PROJECT,
  '--format',
  'value(name,schedule,timeZone,state,httpTarget.uri)',
]);

console.log('[setup-robo-pickup-scheduler] OK — POST', URI, '（盤面未生成時のみシード。毎時強制更新はしない）');
