/** rk-rk- 二重接頭辞を正規化（置換スクリプトの二度掛け対策） */
const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      const orig = fs.readFileSync(p, 'utf8');
      let s = orig;
      while (s.includes('rk-rk-')) s = s.replace(/rk-rk-/g, 'rk-');
      if (s !== orig) fs.writeFileSync(p, s);
    }
  }
}

walk(srcRoot);
