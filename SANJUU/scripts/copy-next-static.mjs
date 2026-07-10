import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const staticSrc = path.join(root, 'web', '.next', 'static');
const standaloneRoot = path.join(root, 'web', '.next', 'standalone');

function findStandaloneServerEntry() {
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

const entry = findStandaloneServerEntry();
if (!entry) {
  console.error('[copy-next-static] standalone server.js not found under', standaloneRoot);
  process.exit(1);
}
if (!fs.existsSync(staticSrc)) {
  console.warn('[copy-next-static] no .next/static at', staticSrc);
  process.exit(0);
}

const appDir = path.dirname(entry);
const staticDest = path.join(appDir, '.next', 'static');
fs.mkdirSync(path.dirname(staticDest), { recursive: true });
fs.rmSync(staticDest, { recursive: true, force: true });
fs.cpSync(staticSrc, staticDest, { recursive: true });
// eslint-disable-next-line no-console
console.log('[copy-next-static]', staticSrc, '->', staticDest);
