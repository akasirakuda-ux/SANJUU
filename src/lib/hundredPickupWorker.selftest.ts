import { hundredPickupMinOccurrences } from './hundredPickupOccurrences';
import { runPickupGenerationSync } from './hundredPickupGenerate';
import { PROHIBITED_WORDS } from '../constants';

async function main() {
  const cases: Array<[number, number, string]> = [
    [5, 5, '089'],
    [5, 5, '66680'],
    [10, 15, 'あい'],
    [10, 15, 'こと'],
    [10, 15, 'abcd'],
    [10, 15, 'あいうえ'],
    [15, 20, 'あ'],
  ];

  for (const [cols, rows, word] of cases) {
    const minOcc = hundredPickupMinOccurrences(cols, word, rows);
    const pickupCharset = /^[0-9]+$/.test(word)
      ? 'digit'
      : /^[a-zA-Z]+$/.test(word)
        ? 'latin'
        : 'hiragana';
    const t0 = Date.now();
    const r = runPickupGenerationSync({
      cols,
      rows,
      targetWord: word,
      seed: 42,
      pickupCharset,
    });
    const ms = Date.now() - t0;
    if (!r) {
      console.error('null result');
      process.exit(1);
    }
    const occ = (r.placedWords?.[0] as { occurrences?: unknown[] } | undefined)?.occurrences?.length ?? 0;
    const density = r.density ?? 0;
    const ok = density >= 0.85 && occ >= minOcc;
    const rowKeys = r.grid.map((row) => row.join(''));
    const rowVariety = new Set(rowKeys).size;
    const rowsOk = rows < 2 || rowVariety > 1;
    console.log(
      `${cols}x${rows} "${word}": ${ms}ms density=${(density * 100).toFixed(1)}% occ=${occ}/${minOcc} rows=${rowVariety}/${rows} ${ok && rowsOk ? 'OK' : 'FAIL'}`,
    );
    if (!ok || !rowsOk) process.exit(1);
  }

  const t0 = Date.now();
  const withBan = runPickupGenerationSync({
    cols: 10,
    rows: 15,
    targetWord: 'あい',
    seed: 99,
    pickupCharset: 'hiragana',
    prohibitedWords: PROHIBITED_WORDS,
  });
  console.log(`10x15 with PROHIBITED_WORDS: ${Date.now() - t0}ms ${withBan ? 'OK' : 'FAIL'}`);
  if (!withBan) process.exit(1);

  console.log('all pickup selftests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
