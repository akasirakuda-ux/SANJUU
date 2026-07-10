/**
 * Node 用 — roboPickupLoungeCore をバンドル（Cloud Run / ローカル API）
 * 用法: node scripts/build-robo-pickup-server.mjs
 */
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const entry = path.join(root, 'src/lib/roboPickupLoungeCore.ts');
const outfile = path.join(root, 'server/roboPickupLoungeCore.bundle.mjs');

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'info',
  sourcemap: false,
  target: 'node22',
});

console.log(`[build-robo-pickup-server] OK → ${outfile}`);
