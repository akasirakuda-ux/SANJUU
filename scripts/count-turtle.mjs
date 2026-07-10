import { readFileSync } from 'fs';
const raw = readFileSync(
  new URL('../src/lib/tileMatch/turtle144.coords.txt', import.meta.url),
  'utf8'
);
const pts = raw
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [x, y, z] = s.split(',').map(Number);
    return { x, y, z };
  });
console.log('total', pts.length);
const byZ = {};
for (const p of pts) byZ[p.z] = (byZ[p.z] || 0) + 1;
console.log('by z', byZ);
for (const max of [2, 3, 4]) {
  console.log(`z<=${max}`, pts.filter((p) => p.z <= max).length);
}
