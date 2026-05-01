import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = 3000;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'pipe', shell: false, ...opts });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => (out += String(d)));
    child.stderr?.on('data', (d) => (err += String(d)));
    child.on('close', (code) => resolve({ code: code ?? 0, out, err }));
    child.on('error', () => resolve({ code: 1, out, err }));
  });
}

async function killPortWin32(port) {
  // Prefer Get-NetTCPConnection when available (more reliable than parsing netstat output).
  const ps = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      [
        '$ErrorActionPreference = "SilentlyContinue";',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -State Listen;`,
        'if ($conns) {',
        '  $pids = $conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique;',
        '  $pids | ForEach-Object { if ($_ -and $_ -ne 0) { taskkill /PID $_ /F | Out-Null } };',
        '}',
      ].join(' '),
    ],
    { windowsHide: true },
  );

  // Fallback: netstat + findstr
  if (ps.code === 0) return;

  const netstat = await run('cmd.exe', ['/c', `netstat -ano | findstr ":${port}"`], { windowsHide: true });
  const lines = (netstat.out || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pids = new Set();
  for (const line of lines) {
    const m = line.match(/\s(\d+)\s*$/);
    if (m) pids.add(m[1]);
  }

  for (const pid of pids) {
    await run('cmd.exe', ['/c', `taskkill /PID ${pid} /F`], { stdio: 'ignore', windowsHide: true });
  }
}

async function main() {
  if (process.platform === 'win32') {
    await killPortWin32(PORT);
  }

  // `strictPort: true` in vite.config.ts keeps this deterministic.
  const vite = spawn('npx', ['vite', '--port', String(PORT)], { stdio: 'inherit', shell: true });
  vite.on('close', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

