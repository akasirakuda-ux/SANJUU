import { readFileSync } from 'fs';
const raw = readFileSync('src/lib/tileMatch/turtle144.coords.txt', 'utf8');
const pts = raw
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [x, y, z] = s.split(',').map(Number);
    return { x, y, z };
  });

function pick(filter) {
  return pts.filter(filter);
}

const candidates = [
  ['z<=2 x10-18', (p) => p.z <= 2 && p.x >= 10 && p.x <= 18],
  ['z<=2 x8-20', (p) => p.z <= 2 && p.x >= 8 && p.x <= 20],
  ['z<=1 x8-20', (p) => p.z <= 1 && p.x >= 8 && p.x <= 20],
  ['z<=1 x6-22', (p) => p.z <= 1 && p.x >= 6 && p.x <= 22],
  ['z<=3 x6-22', (p) => p.z <= 3 && p.x >= 6 && p.x <= 22],
  ['z<=3 x4-24', (p) => p.z <= 3 && p.x >= 4 && p.x <= 24],
  ['z<=3 x8-20', (p) => p.z <= 3 && p.x >= 8 && p.x <= 20],
  ['z<=2 x6-22 y2-12', (p) => p.z <= 2 && p.x >= 6 && p.x <= 22 && p.y >= 2 && p.y <= 12],
  ['z<=2 x8-20 y2-12', (p) => p.z <= 2 && p.x >= 8 && p.x <= 20 && p.y >= 2 && p.y <= 12],
  ['drop z0 outer', (p) => p.z > 0 || (p.x >= 6 && p.x <= 22 && p.y >= 2 && p.y <= 12)],
  ['drop z0 x<6 or x>22', (p) => !(p.z === 0 && (p.x < 6 || p.x > 22))],
  ['drop z0 wings', (p) => !(p.z === 0 && (p.x <= 4 || p.x >= 24 || p.y === 0 || p.y === 14))],
];

for (const [name, fn] of candidates) {
  const n = pick(fn).length;
  if (n === 48 || n === 96 || (n >= 46 && n <= 50) || (n >= 94 && n <= 98)) {
    console.log(name, n);
  }
}

// greedy remove from z=0 until 96
let g96 = [...pts];
const z0outer = g96.filter((p) => p.z === 0).sort((a, b) => {
  const ea = Math.min(a.x, 28 - a.x, a.y, 14 - a.y);
  const eb = Math.min(b.x, 28 - b.x, b.y, 14 - b.y);
  return ea - eb;
});
for (const t of z0outer) {
  if (g96.length <= 96) break;
  g96 = g96.filter((p) => !(p.x === t.x && p.y === t.y && p.z === t.z));
}
console.log('greedy to 96', g96.length);

let g48 = [...pts];
const z0all = g48.filter((p) => p.z === 0).sort((a, b) => {
  const ea = Math.min(a.x, 28 - a.x, a.y, 14 - a.y);
  const eb = Math.min(b.x, 28 - b.x, b.y, 14 - b.y);
  return ea - eb;
});
for (const t of z0all) {
  if (g48.length <= 48) break;
  g48 = g48.filter((p) => !(p.x === t.x && p.y === t.y && p.z === t.z));
}
console.log('greedy z0 only to 48', g48.length);
