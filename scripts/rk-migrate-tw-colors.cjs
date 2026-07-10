/** 旧 Tailwind 色名を rk-* に置換（既に rk- がある箇所は触らない） */
const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');
const fams = ['rose', 'amber', 'sky', 'red', 'orange', 'pink', 'cyan', 'indigo', 'violet', 'blue', 'slate', 'gray', 'neutral', 'yellow', 'stone', 'zinc', 'teal', 'purple', 'fuchsia', 'lime'];
const nums = [950, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50];
const pairs = [];
for (const f of fams) {
  for (const n of nums) pairs.push([`${f}-${n}`, `rk-${f}-${n}`]);
}
pairs.sort((a, b) => b[0].length - a[0].length);

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      let s = fs.readFileSync(p, 'utf8');
      const o = s;
      for (const [from, to] of pairs) {
        const escaped = from.replace(/-/g, '\\-');
        const re = new RegExp(`(?<!rk-)\\b${escaped}\\b`, 'g');
        s = s.replace(re, to);
      }
      if (s !== o) fs.writeFileSync(p, s);
    }
  }
}

walk(srcRoot);
