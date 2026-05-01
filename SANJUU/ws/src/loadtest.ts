import { setTimeout as delay } from 'node:timers/promises';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { clampInt, nowMs, randomId } from './util.js';

type Args = {
  game: 'base' | 'play';
  rooms: number;
  clientsPerRoom: number;
  durationSec: number;
  pressEveryMs: number;
  url: string;
  playUrl: string;
  warmupSec: number;
  httpBase: string;
  reset: boolean;
  workers: number;
  tune?: string;
  slowRecvPerRoom: number;
  freezeRecvPerRoom: number;
  spamRoomsPct: number;
  spamPressEveryMs: number;
  diffRepeat: number;

  // play scenario
  playMode: 'default' | 'play-normal' | 'play-slow' | 'play-freeze' | 'play-spam';
  playNormalPerRoom: number;
  playSlowPerRoom: number;
  playFreezePerRoom: number;
  playSpamPerRoom: number;
  playFreezeRecv: boolean;
  playNormalPressMinMs: number;
  playNormalPressMaxMs: number;
  playSlowPressMinMs: number;
  playSlowPressMaxMs: number;
  playSpamPressMinMs: number;
  playSpamPressMaxMs: number;
};

function parseArgs(argv: string[]): Args {
  const get = (k: string) => {
    const idx = argv.indexOf(`--${k}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const game = (String(get('game') ?? 'base').toLowerCase() === 'play' ? 'play' : 'base') as 'base' | 'play';
  const isPlay = game === 'play';
  const playModeRaw = String(get('playMode') ?? 'default').toLowerCase();
  const playMode =
    playModeRaw === 'play-normal' || playModeRaw === 'play-slow' || playModeRaw === 'play-freeze' || playModeRaw === 'play-spam'
      ? (playModeRaw as Args['playMode'])
      : 'default';

  let playNormalPerRoom = clampInt(Number(get('playNormalPerRoom') ?? 26), 0, 50);
  let playSlowPerRoom = clampInt(Number(get('playSlowPerRoom') ?? 2), 0, 50);
  let playFreezePerRoom = clampInt(Number(get('playFreezePerRoom') ?? 1), 0, 50);
  let playSpamPerRoom = clampInt(Number(get('playSpamPerRoom') ?? 1), 0, 50);
  if (isPlay && playMode !== 'default') {
    playNormalPerRoom = playMode === 'play-normal' ? 30 : 0;
    playSlowPerRoom = playMode === 'play-slow' ? 30 : 0;
    playFreezePerRoom = playMode === 'play-freeze' ? 30 : 0;
    playSpamPerRoom = playMode === 'play-spam' ? 30 : 0;
  }
  return {
    game,
    rooms: clampInt(Number(get('rooms') ?? (isPlay ? 3 : 100)), 1, 1000),
    clientsPerRoom: clampInt(Number(get('clientsPerRoom') ?? 30), 1, 50),
    durationSec: clampInt(Number(get('durationSec') ?? (isPlay ? 600 : 60)), 1, 3600),
    pressEveryMs: clampInt(Number(get('pressEveryMs') ?? 800), 50, 60_000),
    url: String(get('url') ?? 'ws://localhost:8080/ws'),
    playUrl: String(get('playUrl') ?? 'ws://localhost:8080/playws'),
    warmupSec: clampInt(Number(get('warmupSec') ?? 3), 0, 60),
    httpBase: String(get('httpBase') ?? 'http://localhost:8080').replace(/\/+$/, ''),
    reset: String(get('reset') ?? '1') !== '0',
    workers: clampInt(Number(get('workers') ?? Math.max(1, Math.min(8, (os.cpus()?.length ?? 4) - 1))), 1, 64),
    tune: get('tune') ? String(get('tune')) : undefined,
    slowRecvPerRoom: clampInt(Number(get('slowRecvPerRoom') ?? 0), 0, 30),
    freezeRecvPerRoom: clampInt(Number(get('freezeRecvPerRoom') ?? 0), 0, 30),
    spamRoomsPct: clampInt(Number(get('spamRoomsPct') ?? 0), 0, 100),
    spamPressEveryMs: clampInt(Number(get('spamPressEveryMs') ?? 10), 1, 1000),
    diffRepeat: clampInt(Number(get('diffRepeat') ?? 1), 1, 20),

    playMode,
    playNormalPerRoom,
    playSlowPerRoom,
    playFreezePerRoom,
    playSpamPerRoom,
    playFreezeRecv: String(get('playFreezeRecv') ?? '0') === '1',
    playNormalPressMinMs: clampInt(Number(get('playNormalPressMinMs') ?? 1000), 100, 60_000),
    playNormalPressMaxMs: clampInt(Number(get('playNormalPressMaxMs') ?? 2000), 100, 60_000),
    playSlowPressMinMs: clampInt(Number(get('playSlowPressMinMs') ?? 5000), 100, 60_000),
    playSlowPressMaxMs: clampInt(Number(get('playSlowPressMaxMs') ?? 10000), 100, 120_000),
    playSpamPressMinMs: clampInt(Number(get('playSpamPressMinMs') ?? 100), 20, 5000),
    playSpamPressMaxMs: clampInt(Number(get('playSpamPressMaxMs') ?? 200), 20, 5000),
  };
}

async function httpCreateRoom(httpBase: string, password: string): Promise<{ roomId: string; joinUrlPath: string }> {
  const res = await fetch(`${httpBase}/api/room`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`create room failed: ${JSON.stringify(json)}`);
  return json;
}

async function httpCreatePlayRoom(httpBase: string, word?: string): Promise<{ roomId: number; roomCode: string; hostKey: string }> {
  const res = await fetch(`${httpBase}/api/play/room`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ word }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`create play room failed: ${JSON.stringify(json)}`);
  return { roomId: Number(json.roomId) >>> 0, roomCode: String(json.roomCode ?? ''), hostKey: String(json.hostKey ?? '') };
}

async function httpResetRooms(httpBase: string): Promise<void> {
  const res = await fetch(`${httpBase}/api/dev/reset`, { method: 'POST' });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`reset failed: ${res.status} ${t}`);
  }
}

async function httpTune(httpBase: string, mode: string): Promise<void> {
  const res = await fetch(`${httpBase}/api/dev/tune`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`tune failed: ${res.status} ${t}`);
  }
}

async function httpSetDiffRepeat(httpBase: string, diffRepeat: number): Promise<void> {
  const res = await fetch(`${httpBase}/api/dev/tune`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ diffRepeat }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`diffRepeat failed: ${res.status} ${t}`);
  }
}

async function httpDevRooms(httpBase: string): Promise<{ globalDc: number; rooms: Array<{ id: number; clients: number; dc: number }> } | undefined> {
  const res = await fetch(`${httpBase}/api/dev/rooms`, { method: 'GET' }).catch(() => undefined);
  if (!res || !('ok' in res) || !res.ok) return undefined;
  const json = (await res.json().catch(() => undefined)) as any;
  if (!json || !Array.isArray(json.rooms)) return undefined;
  return { globalDc: Number(json.globalDc ?? 0), rooms: json.rooms as any };
}

type Healthz = {
  ok: boolean;
  rooms: number;
  mem: { rss: number; heapUsed: number; external: number };
  eldMs: { p50: number; p90: number; p99: number };
  dc?: number;
  bp?: { maxBuffered: number; maxConsecutive: number };
  nr?: { p50: number; p90: number; p99: number };
};

async function httpHealthz(): Promise<Healthz> {
  const res = await fetch(`${httpBaseGlobal}/healthz`, { method: 'GET' });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`healthz failed: ${JSON.stringify(json)}`);
  // support both old(verbose) and new(minimal cached) shapes
  if (json?.ok === 1 && typeof json?.r === 'number') {
    return {
      ok: true,
      rooms: json.r,
      mem: { rss: json.m?.[0] ?? 0, heapUsed: json.m?.[1] ?? 0, external: json.m?.[2] ?? 0 },
      eldMs: { p50: json.e?.[0] ?? 0, p90: json.e?.[1] ?? 0, p99: json.e?.[2] ?? 0 },
      dc: typeof json.dc === 'number' ? json.dc : undefined,
      bp: Array.isArray(json.bp)
        ? { maxBuffered: Number(json.bp[0] ?? 0), maxConsecutive: Number(json.bp[1] ?? 0) }
        : undefined,
      nr: Array.isArray(json.nr)
        ? { p50: Number(json.nr[0] ?? 0), p90: Number(json.nr[1] ?? 0), p99: Number(json.nr[2] ?? 0) }
        : undefined,
    };
  }
  return json as Healthz;
}

let httpBaseGlobal = 'http://localhost:8080';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prefix = args.game === 'play' ? 'play-' : '';
  const total = args.rooms * args.clientsPerRoom;
  console.log(`[${prefix}loadtest] game=${args.game} rooms=${args.rooms} clientsPerRoom=${args.clientsPerRoom} total=${total}`);
  if (args.game === 'base') {
    console.log(
      `[loadtest] inject slowRecvPerRoom=${args.slowRecvPerRoom} freezeRecvPerRoom=${args.freezeRecvPerRoom} spamRoomsPct=${args.spamRoomsPct} spamPressEveryMs=${args.spamPressEveryMs} diffRepeat=${args.diffRepeat}`
    );
  } else {
    console.log(
      `[play-loadtest] mode=${args.playMode} scenario normal=${args.playNormalPerRoom} slow=${args.playSlowPerRoom} freeze=${args.playFreezePerRoom} spam=${args.playSpamPerRoom} perRoom (freezeRecv=${args.playFreezeRecv ? 1 : 0})`
    );
    console.log(
      `[play-loadtest] pressMs normal=[${args.playNormalPressMinMs},${args.playNormalPressMaxMs}] slow=[${args.playSlowPressMinMs},${args.playSlowPressMaxMs}] spam=[${args.playSpamPressMinMs},${args.playSpamPressMaxMs}]`
    );
  }

  httpBaseGlobal = args.httpBase;
  if (args.game === 'base') {
    if (args.tune) await httpTune(args.httpBase, args.tune);
    if (args.diffRepeat !== 1) await httpSetDiffRepeat(args.httpBase, args.diffRepeat);
    if (args.reset) await httpResetRooms(args.httpBase);
  }

  const roomIds =
    args.game === 'base'
      ? (await Promise.all(Array.from({ length: args.rooms }, () => httpCreateRoom(args.httpBase, randomId(6))))).map(
          (r) => (Number(r.roomId) >>> 0) as number
        )
      : (await Promise.all(Array.from({ length: args.rooms }, () => httpCreatePlayRoom(args.httpBase)))).map((r) => (r.roomId >>> 0) as number);

  const eldP99: number[] = [];
  const rss: number[] = [];
  const heapUsed: number[] = [];
  const dcSamples: number[] = [];
  let bpSeen: string | undefined;
  const nrP99Samples: number[] = [];
  console.log(`[${prefix}loadtest] warmup ${args.warmupSec}s (no health logging)`);

  let metricsStop = false;
  const metricsLoop = async () => {
    while (!metricsStop) {
      const h = await httpHealthz().catch(() => undefined);
      if (h) {
        eldP99.push(h.eldMs.p99);
        rss.push(h.mem.rss);
        heapUsed.push(h.mem.heapUsed);
        if (typeof h.dc === 'number') dcSamples.push(h.dc);
        if (h.nr && typeof h.nr.p99 === 'number') nrP99Samples.push(h.nr.p99);
        if (h.bp) bpSeen = `${h.bp.maxBuffered}/${h.bp.maxConsecutive}${(h as any).bp?.[2] != null ? `/${(h as any).bp?.[2]}` : ''}`;
        console.log(
          `[health] rooms=${h.rooms} eld_p99=${h.eldMs.p99.toFixed(3)} normalRTT_p99=${(h.nr?.p99 ?? 0).toFixed(1)} mem_mb rss=${(h.mem.rss / 1024 / 1024).toFixed(1)} heap=${(h.mem.heapUsed / 1024 / 1024).toFixed(1)} dc=${h.dc ?? '-'} bp=${bpSeen ?? '-'}`
        );
      }
      await delay(1000);
    }
  };
  void metricsLoop();

  try {
    // Split rooms into worker batches (separate processes)
    const w = Math.min(args.workers, roomIds.length);
    const batches: number[][] = Array.from({ length: w }, () => []);
    for (let i = 0; i < roomIds.length; i++) batches[i % w]!.push(roomIds[i]!);

    const t0 = nowMs();
    const results = await Promise.all(
      batches.map(
        (batch) =>
          new Promise<{
            pressesSent: number;
            diffsRecv: number;
            samples: number;
            p50: number;
            p90: number;
            p99: number;
            roomStats: Record<string, { samples: number; p50: number; p90: number; p99: number }>;
            inject?: { slowRecv: number; freezeRecv: number; spamRooms: number; spamPressEveryMs: number };
            rtt?: {
              normal: { samples: number; p50: number; p90?: number; p95?: number; p99: number };
              slow: { samples: number; p50: number; p90?: number; p95?: number; p99: number };
              freeze: { samples: number; p50: number; p90?: number; p95?: number; p99: number };
              spam: { samples: number; p50: number; p90?: number; p95?: number; p99: number };
            };
            connects?: number;
            opens?: number;
            disconnects?: number;
            errors?: number;
          }>((resolve, reject) => {
            const payload = JSON.stringify({
              url: args.game === 'play' ? args.playUrl : args.url,
              roomIds: batch,
              clientsPerRoom: args.clientsPerRoom,
              durationSec: args.durationSec,
              pressEveryMs: args.pressEveryMs,
              warmupSec: args.warmupSec,
              slowRecvPerRoom: args.slowRecvPerRoom,
              freezeRecvPerRoom: args.freezeRecvPerRoom,
              spamRoomsPct: args.spamRoomsPct,
              spamPressEveryMs: args.spamPressEveryMs,

              normalPerRoom: args.playNormalPerRoom,
              slowPerRoom: args.playSlowPerRoom,
              freezePerRoom: args.playFreezePerRoom,
              spamPerRoom: args.playSpamPerRoom,
              freezeRecv: args.playFreezeRecv,
              normalPressMinMs: args.playNormalPressMinMs,
              normalPressMaxMs: args.playNormalPressMaxMs,
              slowPressMinMs: args.playSlowPressMinMs,
              slowPressMaxMs: args.playSlowPressMaxMs,
              spamPressMinMs: args.playSpamPressMinMs,
              spamPressMaxMs: args.playSpamPressMaxMs,
            });
            const child = spawn(process.execPath, [args.game === 'play' ? 'src/playLoadtestChild.mjs' : 'src/loadtestChild.mjs', payload], {
              cwd: process.cwd(),
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let out = '';
            let err = '';
            child.stdout.on('data', (d) => (out += d.toString('utf8')));
            child.stderr.on('data', (d) => (err += d.toString('utf8')));
            child.on('error', reject);
            child.on('exit', (code) => {
              if (code !== 0) return reject(new Error(`worker exit ${code}: ${err || out}`));
              try {
                resolve(JSON.parse(out));
              } catch (e) {
                reject(new Error(`bad worker json: ${String(e)} out=${out} err=${err}`));
              }
            });
          })
      )
    );
    const elapsedMs = nowMs() - t0;

    eldP99.sort((a, b) => a - b);
    rss.sort((a, b) => a - b);
    const pressesSent = results.reduce((a, r) => a + r.pressesSent, 0);
    const diffsRecv = results.reduce((a, r) => a + r.diffsRecv, 0);
    const samples = results.reduce((a, r) => a + r.samples, 0);
    const approxP = (k: 'p50' | 'p90' | 'p99') => {
      const denom = results.reduce((a, r) => a + r.samples, 0);
      if (denom <= 0) return 0;
      return results.reduce((a, r) => a + r[k] * r.samples, 0) / denom;
    };
    console.log(
      `[${prefix}loadtest] workers=${w} elapsed_ms=${elapsedMs} pressesSent=${pressesSent} diffsRecv=${diffsRecv} press_to_diff_ms approx_p50=${approxP(
        'p50'
      ).toFixed(1)} approx_p90=${approxP('p90').toFixed(1)} approx_p99=${approxP('p99').toFixed(1)} samples=${samples}`
    );

    if (args.game === 'play') {
      const conns = results.reduce((a, r) => a + (r.connects ?? 0), 0);
      const opens = results.reduce((a, r) => a + (r.opens ?? 0), 0);
      const dcs = results.reduce((a, r) => a + (r.disconnects ?? 0), 0);
      const errs = results.reduce((a, r) => a + (r.errors ?? 0), 0);
      console.log(`[play-loadtest] connections connects=${conns} opens=${opens} disconnects=${dcs} errors=${errs}`);
    }
    if (args.game === 'base') {
      const inj = results.reduce(
        (a, r) => {
          a.slowRecv += r.inject?.slowRecv ?? 0;
          a.freezeRecv += r.inject?.freezeRecv ?? 0;
          a.spamRooms += r.inject?.spamRooms ?? 0;
          a.spamPressEveryMs = r.inject?.spamPressEveryMs ?? a.spamPressEveryMs;
          return a;
        },
        { slowRecv: 0, freezeRecv: 0, spamRooms: 0, spamPressEveryMs: args.spamPressEveryMs }
      );
      console.log(
        `[inject] slowRecv=${inj.slowRecv} freezeRecv=${inj.freezeRecv} spamRooms=${inj.spamRooms} spamPressEveryMs=${inj.spamPressEveryMs}`
      );
    }

    const agg = (key: 'normal' | 'slow' | 'freeze' | 'spam', p: 'p50' | 'p90' | 'p95' | 'p99') => {
      let num = 0;
      let den = 0;
      for (const r of results) {
        const s = r.rtt?.[key];
        if (!s) continue;
        num += (s[p] ?? 0) * (s.samples ?? 0);
        den += s.samples ?? 0;
      }
      return den ? num / den : 0;
    };
    const aggN = (key: 'normal' | 'slow' | 'freeze' | 'spam') => results.reduce((a, r) => a + (r.rtt?.[key]?.samples ?? 0), 0);
    const mid = args.game === 'play' ? 'p95' : 'p90';
    console.log(
      `[${prefix}rtt] normal p50=${agg('normal','p50').toFixed(1)} ${mid}=${agg('normal', mid as any).toFixed(1)} p99=${agg('normal','p99').toFixed(1)} samples=${aggN('normal')}`
    );
    console.log(
      `[${prefix}rtt] slow   p50=${agg('slow','p50').toFixed(1)} ${mid}=${agg('slow', mid as any).toFixed(1)} p99=${agg('slow','p99').toFixed(1)} samples=${aggN('slow')}`
    );
    console.log(
      `[${prefix}rtt] spam   p50=${agg('spam','p50').toFixed(1)} ${mid}=${agg('spam', mid as any).toFixed(1)} p99=${agg('spam','p99').toFixed(1)} samples=${aggN('spam')}`
    );
    console.log(
      `[${prefix}rtt] freeze p50=${agg('freeze','p50').toFixed(1)} ${mid}=${agg('freeze', mid as any).toFixed(1)} p99=${agg('freeze','p99').toFixed(1)} samples=${aggN('freeze')}`
    );
    console.log(
      `[${prefix}loadtest] eld_ms(p99) p50=${percentile(eldP99, 50).toFixed(3)} p90=${percentile(eldP99, 90).toFixed(3)} p99=${percentile(eldP99, 99).toFixed(3)} samples=${eldP99.length}`
    );
    console.log(
      `[${prefix}loadtest] mem_mb rss min=${(percentile(rss, 0) / 1024 / 1024).toFixed(1)} p50=${(percentile(rss, 50) / 1024 / 1024).toFixed(1)} p90=${(percentile(rss, 90) / 1024 / 1024).toFixed(1)} max=${(percentile(rss, 100) / 1024 / 1024).toFixed(1)} samples=${rss.length}`
    );
    console.log(
      `[${prefix}loadtest] mem_mb heapUsed p50=${(percentile(heapUsed, 50) / 1024 / 1024).toFixed(1)} p90=${(percentile(heapUsed, 90) / 1024 / 1024).toFixed(1)} max=${(percentile(heapUsed, 100) / 1024 / 1024).toFixed(1)} samples=${heapUsed.length}`
    );
    if (nrP99Samples.length > 0) {
      const sorted = [...nrP99Samples].sort((a, b) => a - b);
      console.log(
        `[loadtest] normalRTT_p99(server) p50=${percentile(sorted, 50).toFixed(1)} p90=${percentile(sorted, 90).toFixed(1)} p99=${percentile(sorted, 99).toFixed(1)} samples=${sorted.length}`
      );
    }
    if (dcSamples.length > 0) {
      const dcStart = dcSamples[0] ?? 0;
      const dcEnd = dcSamples[dcSamples.length - 1] ?? dcStart;
      console.log(`[loadtest] disconnectCount global start=${dcStart} end=${dcEnd} delta=${dcEnd - dcStart}`);
    }

    const devRooms = args.game === 'base' ? await httpDevRooms(args.httpBase) : undefined;
    if (devRooms) {
      const top = [...devRooms.rooms].sort((a, b) => b.dc - a.dc).slice(0, 10);
      console.log(`[dc] global=${devRooms.globalDc} roomsWithDc=${devRooms.rooms.filter((r) => r.dc > 0).length}/${devRooms.rooms.length}`);
      for (const r of top) {
        if (r.dc <= 0) break;
        console.log(`[dc-room] id=${r.id} dc=${r.dc} clients=${r.clients}`);
      }
    }

    // Room-level histogram (by p99)
    const merged: Array<{ roomId: string; samples: number; p50: number; p90: number; p99: number }> = [];
    for (const r of results) {
      for (const [roomId, s] of Object.entries(r.roomStats ?? {})) {
        merged.push({ roomId, samples: s.samples, p50: s.p50, p90: s.p90, p99: s.p99 });
      }
    }
    merged.sort((a, b) => b.p99 - a.p99);
    const bins = { le20: 0, le40: 0, le60: 0, le100: 0, gt100: 0 };
    for (const s of merged) {
      if (s.p99 <= 20) bins.le20++;
      else if (s.p99 <= 40) bins.le40++;
      else if (s.p99 <= 60) bins.le60++;
      else if (s.p99 <= 100) bins.le100++;
      else bins.gt100++;
    }
    console.log(
      `[rooms] count=${merged.length} p99_bins le20=${bins.le20} le40=${bins.le40} le60=${bins.le60} le100=${bins.le100} gt100=${bins.gt100}`
    );
    for (const s of merged.slice(0, 10)) {
      console.log(`[room] id=${s.roomId} samples=${s.samples} p50=${s.p50} p90=${s.p90} p99=${s.p99}`);
    }
  } finally {
    metricsStop = true;
  }

}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

