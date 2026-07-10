import {
  generatePickupBoardReliable,
  isPickupLengthFeasible,
  pickupFeasibleWordLengthsForBoard,
} from './hundredPickupFeasibility';
import type { PickupCharset } from './hundredPickupCharset';

const BOARD_PRESETS: Array<[number, number, string]> = [
  [5, 5, '5x5'],
  [10, 10, '10x10'],
  [10, 15, '10x15'],
  [15, 15, '15x15'],
  [15, 20, '15x20'],
];

const CHARSETS: PickupCharset[] = ['hiragana', 'digit', 'latin'];

async function main() {
  let failures = 0;

  for (const charset of CHARSETS) {
    for (const [cols, rows, label] of BOARD_PRESETS) {
      const feasible = pickupFeasibleWordLengthsForBoard(cols, rows, charset);
      console.log(`${label} ${charset}: feasible lengths = [${feasible.join(', ')}]`);

      for (const len of feasible) {
        if (!isPickupLengthFeasible(cols, rows, len, charset)) {
          console.error(`FAIL length probe inconsistent ${label} ${charset} len=${len}`);
          failures += 1;
          continue;
        }

        const probeWord =
          charset === 'digit'
            ? '8'.repeat(len)
            : charset === 'latin'
              ? 'CAT'.slice(0, len).padEnd(len, 'T')
              : 'あいうえお'.slice(0, len);

        const r = generatePickupBoardReliable(cols, rows, probeWord, charset, {
          maxAttempts: 48,
          baseSeed: len * 100 + cols,
        });
        if (!r) {
          console.error(`FAIL generate ${label} ${charset} len=${len} word=${probeWord}`);
          failures += 1;
        }
      }
    }
  }

  // ユーザー報告ケース: 4文字 10x15
  const userCase = generatePickupBoardReliable(10, 15, 'abcd', 'latin', {
    maxAttempts: 48,
    baseSeed: 99,
  });
  if (!userCase) {
    console.error('FAIL user case 10x15 abcd');
    failures += 1;
  } else {
    console.log('OK user case 10x15 abcd');
  }

  if (failures > 0) {
    console.error(`feasibility selftest failures: ${failures}`);
    process.exit(1);
  }
  console.log('all feasibility selftests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
