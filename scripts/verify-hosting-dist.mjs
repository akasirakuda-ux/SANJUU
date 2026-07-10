/**
 * `vite build` 直後の事実確認: index.html が指す JS が dist に存在するか。
 * AdSense 向け静的ファイル（ads.txt / sitemap / guide）も確認する。
 * `npm run deploy:hosting` の途中で実行される。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('[verify-hosting-dist] dist/index.html がありません。先に vite build してください。');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const m = html.match(/src="\/assets\/((?:index|main)-[^"]+\.js)"/);
if (!m) {
  console.error('[verify-hosting-dist] dist/index.html に /assets/index-*.js または main-*.js の参照がありません。');
  process.exit(1);
}

const jsPath = path.join(dist, 'assets', m[1]);
if (!fs.existsSync(jsPath)) {
  console.error('[verify-hosting-dist] 参照先が存在しません:', jsPath);
  process.exit(1);
}

const staticChecks = [
  'ads.txt',
  'robots.txt',
  'sitemap.xml',
  'guide/index.html',
  'guide/kotoba/index.html',
  'about/index.html',
  'privacy/index.html',
];
for (const rel of staticChecks) {
  const p = path.join(dist, rel);
  if (!fs.existsSync(p)) {
    console.error('[verify-hosting-dist] 静的ファイルがありません:', rel);
    process.exit(1);
  }
}

const adsTxt = fs.readFileSync(path.join(dist, 'ads.txt'), 'utf8');
if (!adsTxt.includes('pub-7642612812471632')) {
  console.error('[verify-hosting-dist] ads.txt に pub-7642612812471632 がありません。');
  process.exit(1);
}

const kb = (fs.statSync(jsPath).size / 1024).toFixed(0);
console.log('[verify-hosting-dist] OK', m[1], `(${kb} KB)`, '+ AdSense static files');
