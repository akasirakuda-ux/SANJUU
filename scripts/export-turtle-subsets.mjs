import { readFileSync, writeFileSync } from 'fs';

const raw = readFileSync('src/lib/tileMatch/turtle144.coords.txt', 'utf8');
const pts = raw
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [x, y, z] = s.split(',').map(Number);
    return { x, y, z };
  });

function edgeScore(p) {
  return Math.min(p.x, 28 - p.x, p.y, 14 - p.y) + p.z * 0.25;
}

function shrinkTo(target, onlyZ0First = false) {
  let kept = [...pts];
  const order = [...pts].sort((a, b) => edgeScore(a) - edgeScore(b));
  for (const t of order) {
    if (kept.length <= target) break;
    if (onlyZ0First && t.z > 0) continue;
    kept = kept.filter((p) => !(p.x === t.x && p.y === t.y && p.z === t.z));
  }
  if (kept.length > target) {
    for (const t of order) {
      if (kept.length <= target) break;
      kept = kept.filter((p) => !(p.x === t.x && p.y === t.y && p.z === t.z));
    }
  }
  return kept;
}

function toTxt(list) {
  return list.map((p) => `${p.x},${p.y},${p.z}`).join(';') + '\n';
}

const easy = shrinkTo(48);
const normal = shrinkTo(96, true);
console.log('easy', easy.length, 'normal', normal.length);
writeFileSync('src/lib/tileMatch/turtle48.coords.txt', toTxt(easy));
writeFileSync('src/lib/tileMatch/turtle96.coords.txt', toTxt(normal));
