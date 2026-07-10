import { TILE_MATCH_LAYOUTS } from '../src/lib/tileMatch/layoutCatalog.ts';
import { fitLayoutCoords } from '../src/lib/tileMatch/shrinkLayout.ts';

const targets = [48, 96, 144];
for (const def of TILE_MATCH_LAYOUTS) {
  const master = def.buildMaster();
  console.log(def.id, def.labelJa, 'master', master.length);
  for (const t of targets) {
    try {
      const fitted = fitLayoutCoords(master, t);
      console.log('  ', t, fitted.length, 'OK');
    } catch (e) {
      console.log('  ', t, 'FAIL', e.message);
    }
  }
}
