import { runWorker, type WorkerArgs } from './loadtestWorker.js';

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error('missing args json');
  const args = JSON.parse(raw) as WorkerArgs;
  const res = await runWorker(args);
  process.stdout.write(JSON.stringify(res));
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 1;
});

