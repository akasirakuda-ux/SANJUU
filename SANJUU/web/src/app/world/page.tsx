'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Healthz = {
  ok: number;
  r: number; // rooms
  t: number; // timestamp
  tm?: string; // tune mode
  e: [number, number, number]; // eld p50/p90/p99
  m: [number, number, number]; // mem rss/heap/ext
  dc: number; // global disconnectCount
  bp: [number, number, number?]; // maxBuffered / maxConsecutive / diffRepeat?
  nr: [number, number, number]; // normalRTT p50/p90/p99 (server proxy)
};

type DevRooms = {
  globalDc: number;
  rooms: Array<{ id: number; clients: number; dc: number; p: { samples: number; p50: number; p90: number; p99: number } }>;
  // healthz-like extras (dashboards may inline these)
  r?: number;
  tm?: string;
  m?: [number, number, number];
  bp?: [number, number, number?];
};

type HealthzKv = Record<string, string>;

function parseHealthzKv(text: string): HealthzKv {
  const out: HealthzKv = {};
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function num(kv: HealthzKv | null, key: string): number {
  if (!kv) return 0;
  const v = kv[key];
  const n = typeof v === 'string' ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function PlayRedDot({ cx, cy, value }: { cx?: number; cy?: number; value?: number }) {
  if (!value || value <= 0) return null;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#ef4444" />;
}

function mb(n: number) {
  return (n / 1024 / 1024).toFixed(1);
}

export default function WorldPage() {
  const router = useRouter();
  const base = useMemo(() => process.env.NEXT_PUBLIC_WS_HTTP ?? 'http://localhost:8080', []);
  const [h, setH] = useState<Healthz | null>(null);
  const [kv, setKv] = useState<HealthzKv | null>(null);
  const [playRooms, setPlayRooms] = useState<Array<{ id: number; clients: number }>>([]);
  const lastPlayDisconnectsRef = useRef<number | null>(null);
  const [playDcDelta, setPlayDcDelta] = useState(0);
  const [roomsWithDc, setRoomsWithDc] = useState<number | null>(null);
  const [rooms, setRooms] = useState<DevRooms['rooms']>([]);
  const [selected, setSelected] = useState<DevRooms['rooms'][number] | null>(null);
  const [err, setErr] = useState(false);
  const [history, setHistory] = useState<
    Array<{ t: string; nrP99: number; eldP99: number; dcDelta: number; dc: number }>
  >([]);
  const historyRef = useRef<Array<{ t: string; nrP99: number; eldP99: number; dcDelta: number; dc: number }>>([]);

  const [playHistory, setPlayHistory] = useState<Array<{ t: string; rttP99: number; eldP99: number; dcDelta: number }>>([]);
  const playHistoryRef = useRef<Array<{ t: string; rttP99: number; eldP99: number; dcDelta: number }>>([]);
  const lastDcRef = useRef<number | null>(null);
  const lastRoomsWithDcRef = useRef<number | null>(null);
  const prevRoomP99Ref = useRef<Map<number, number>>(new Map());
  const prevHeapRef = useRef<number | null>(null);

  const [alertNormal, setAlertNormal] = useState(false);
  const [alertDc, setAlertDc] = useState(false);
  const [roomAnomaly, setRoomAnomaly] = useState<Set<number>>(new Set());

  const alertNormalPrev = useRef(false);
  const alertDcPrev = useRef(false);

  type Snapshot = {
    at: string;
    types: string[];
    cause: string;
    values: {
      normalRTT_p99: number;
      eld_p99: number;
      dcDelta: number;
      roomsWithDc: number | null;
      rooms: number;
      tuneMode: string;
      backpressure: { maxBufferedAmount: number; backpressureMaxConsecutive: number; diffRepeat: number };
    };
    noisyRooms: Array<{ id: number; p99: number; delta?: number; dc: number; clients: number }>;
  };
  const [explain, setExplain] = useState<Snapshot | null>(null);
  const explainActivePrev = useRef(false);

  const [busy, setBusy] = useState<string | null>(null);
  const refreshNowRef = useRef<(() => void) | null>(null);
  const [selfHealing, setSelfHealing] = useState(true);
  const [healLog, setHealLog] = useState<Array<{ at: string; type: 'auto-kill' | 'auto-tune'; msg: string }>>([]);
  const [autoKilledMap, setAutoKilledMap] = useState<Map<number, number>>(() => new Map()); // roomId -> lastKillMs
  const autoKilledMapRef = useRef<Map<number, number>>(autoKilledMap);
  const roomBadStreakRef = useRef<Map<number, number>>(new Map()); // roomId -> consecutive seconds p99>120
  const lastAutoTuneAtRef = useRef<number>(0);
  const lastTuneRef = useRef<string | null>(null);

  const [snapLog, setSnapLog] = useState<Snapshot[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const errCountRef = useRef(0);

  const [experimentOn, setExperimentOn] = useState(false);
  const experimentStartRef = useRef<number | null>(null);
  const experimentDcStartRef = useRef<number>(0);
  const selfHealingRef = useRef(selfHealing);

  useEffect(() => {
    autoKilledMapRef.current = autoKilledMap;
  }, [autoKilledMap]);

  useEffect(() => {
    selfHealingRef.current = selfHealing;
  }, [selfHealing]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      let json: Healthz | null = null;
      let dcDelta = 0;
      let nrP99 = 0;
      let eldP99 = 0;
      let nowStr = '';

      try {
        const res = await fetch(`${base}/healthz`, { cache: 'no-store' });
        if (!res.ok) throw new Error('healthz');
        json = (await res.json()) as Healthz;
        if (!alive) return;
        setH(json);
        setErr(false);
        setNowMs(Date.now());

        const dcPrev = lastDcRef.current;
        lastDcRef.current = json.dc ?? 0;
        dcDelta = dcPrev == null ? 0 : Math.max(0, (json.dc ?? 0) - dcPrev);
        nrP99 = json.nr?.[2] ?? 0;
        eldP99 = json.e?.[2] ?? 0;
        nowStr = new Date(json.t ?? Date.now()).toLocaleTimeString();

        const nextHist = [...historyRef.current, { t: nowStr, nrP99, eldP99, dcDelta, dc: json.dc ?? 0 }];
        const trimmed = nextHist.length > 60 ? nextHist.slice(nextHist.length - 60) : nextHist;
        historyRef.current = trimmed;
        setHistory(trimmed);

        // Alerts evaluated from most recent window (client-side)
        const recentNr = trimmed.map((x) => x.nrP99).filter((v) => Number.isFinite(v) && v > 0);
        const avgNr = recentNr.length ? recentNr.reduce((a, b) => a + b, 0) / recentNr.length : 0;
        const last3 = trimmed.slice(-3);
        const consecutiveHigh = last3.length === 3 && last3.every((x) => x.nrP99 > 60);
        const spikeVsAvg = avgNr > 0 && nrP99 >= avgNr * 2.5;
        const normalAlertNow = consecutiveHigh || spikeVsAvg;
        setAlertNormal(normalAlertNow);
        if (normalAlertNow && !alertNormalPrev.current) console.log('[alert] normalRTT spike');
        alertNormalPrev.current = normalAlertNow;

        const dcAlertNow = dcDelta > 10;
        setAlertDc(dcAlertNow);
        if (dcAlertNow && !alertDcPrev.current) console.log('[alert] dc surge');
        alertDcPrev.current = dcAlertNow;
      } catch {
        if (!alive) return;
        setErr(true);
        errCountRef.current += 1;
      }

      // dev-only: roomsWithDc
      try {
        const res = await fetch(`${base}/api/dev/rooms`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as DevRooms;
        if (!alive) return;
        const list = json.rooms ?? [];
        setRooms(list);
        const withDc = list.filter((r) => (r.dc ?? 0) > 0).length;
        setRoomsWithDc(withDc);
        const prevWithDc = lastRoomsWithDcRef.current;
        lastRoomsWithDcRef.current = withDc;
        const withDcDelta = prevWithDc == null ? 0 : Math.max(0, withDc - prevWithDc);
        if (withDcDelta >= 5) {
          setAlertDc(true);
          if (!alertDcPrev.current) console.log('[alert] dc surge');
          alertDcPrev.current = true;
        }

        // room anomaly detection (p99 > 100 or +40ms vs previous)
        const prevMap = prevRoomP99Ref.current;
        const nextAnom = new Set<number>();
        const noisy: Array<{ id: number; p99: number; delta?: number; dc: number; clients: number }> = [];
        const nowMs = Date.now();
        for (const r of list) {
          const p99 = r.p?.p99 ?? 0;
          const prev = prevMap.get(r.id) ?? 0;
          if (p99 > 100 || (prev > 0 && p99 - prev >= 40)) nextAnom.add(r.id);
          if (p99 > 100 || (prev > 0 && p99 - prev >= 40)) {
            noisy.push({ id: r.id, p99, delta: prev > 0 ? p99 - prev : undefined, dc: r.dc ?? 0, clients: r.clients ?? 0 });
          }
          prevMap.set(r.id, p99);
        }
        setRoomAnomaly(nextAnom);

        // Self-Healing: Auto-Kill
        if (selfHealingRef.current) {
          const streakMap = roomBadStreakRef.current;
          const killedMap = autoKilledMapRef.current;
          for (const r of list) {
            const p99 = r.p?.p99 ?? 0;
            const prevStreak = streakMap.get(r.id) ?? 0;
            const nextStreak = p99 > 120 ? prevStreak + 1 : 0;
            streakMap.set(r.id, nextStreak);

            const alreadyKilledRecently = (killedMap.get(r.id) ?? 0) > nowMs - 30_000;
            const shouldKill = !alreadyKilledRecently && (nextStreak >= 3 || (r.dc ?? 0) > 10);
            if (shouldKill) {
              killedMap.set(r.id, nowMs);
              setAutoKilledMap(new Map(killedMap));
              const at = new Date().toLocaleTimeString();
              setHealLog((prev) => [{ at, type: 'auto-kill' as const, msg: `room ${r.id} killed (p99=${p99.toFixed(1)} streak=${nextStreak} dc=${r.dc})` }, ...prev].slice(0, 200));
              console.log('[self-heal] auto-kill', r.id);
              fetch(`${base}/api/dev/rooms/kill`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: r.id }),
              })
                .then(() => refreshNowRef.current?.())
                .catch(() => {});
            }
          }
        }

        // Explanation + snapshot (rule-based) – recompute every tick; snapshot saved on transition to active
        const roomAlertNow = noisy.length > 0;
        const anyAlertNow = alertNormalPrev.current || alertDcPrev.current || roomAlertNow;
        if (!anyAlertNow) {
          explainActivePrev.current = false;
          setExplain(null);
        } else {
          const becameActive = !explainActivePrev.current && anyAlertNow;
          explainActivePrev.current = true;

          const types: string[] = [];
          if (alertNormalPrev.current) types.push('normalRTT spike');
          if (alertDcPrev.current) types.push('dc surge');
          if (roomAlertNow) types.push('room p99 anomaly');

          // cause estimation
          const heapNow = json?.m?.[1] ?? null;
          const heapPrev = prevHeapRef.current;
          prevHeapRef.current = typeof heapNow === 'number' ? heapNow : heapPrev;
          const heapDeltaMb = heapPrev != null && heapNow != null ? (heapNow - heapPrev) / 1024 / 1024 : 0;

          let cause = '';
          if (types.includes('normalRTT spike')) {
            if (eldP99 > 30) cause = 'tick遅延（ELD高）';
            else if (heapDeltaMb > 8) cause = 'GC/メモリ圧の疑い（heap急増）';
            else cause = 'leader遅延/ネットワーク/端末負荷の疑い（ELD低）';
          } else if (types.includes('dc surge')) {
            cause = 'slow/freeze/spam 混入増加 or backpressure閾値が厳しすぎる可能性';
          } else if (types.includes('room p99 anomaly')) {
            cause = '特定roomのleader遅延 or slow混入';
          }

          const mode = (json?.tm ?? '-') as string;
          const bp = json?.bp ?? [0, 0, 1];
          const snap: Snapshot = {
            at: nowStr || new Date().toLocaleTimeString(),
            types,
            cause,
            values: {
              normalRTT_p99: nrP99,
              eld_p99: eldP99,
              dcDelta,
              roomsWithDc: withDc,
              rooms: json?.r ?? 0,
              tuneMode: mode,
              backpressure: {
                maxBufferedAmount: bp[0] ?? 0,
                backpressureMaxConsecutive: bp[1] ?? 0,
                diffRepeat: (bp[2] ?? 1) as number,
              },
            },
            noisyRooms: noisy.sort((a, b) => b.p99 - a.p99).slice(0, 20),
          };

          if (becameActive) {
            console.log('[snapshot]', snap);
            setExplain(snap);
            setSnapLog((prev) => [snap, ...prev].slice(0, 200));
          } else {
            // keep latest snapshot while active (more useful than freezing stale values)
            setExplain(snap);
          }
        }

        setSelected((prevSel) => {
          if (!prevSel) return prevSel;
          const found = list.find((r) => r.id === prevSel.id);
          return found ?? prevSel;
        });
      } catch {
        // ignore
      }

      // PLAY: kv metrics + room list (dev-only)
      try {
        const res = await fetch(`${base}/healthz?fmt=kv`, { cache: 'no-store' });
        if (!res.ok) throw new Error('healthz_kv');
        const text = await res.text();
        if (!alive) return;
        const nextKv = parseHealthzKv(text);
        setKv(nextKv);
        const disc = num(nextKv, 'play_disconnects');
        const prevDisc = lastPlayDisconnectsRef.current;
        lastPlayDisconnectsRef.current = disc;
        const delta = prevDisc == null ? 0 : Math.max(0, disc - prevDisc);
        setPlayDcDelta(delta);

        const tLabel = nowStr || new Date().toLocaleTimeString();
        const rttP99 = num(nextKv, 'play_rtt_p99');
        const eldP99 = num(nextKv, 'play_eld_p99');
        const nextHist = [...playHistoryRef.current, { t: tLabel, rttP99, eldP99, dcDelta: delta }];
        const trimmed = nextHist.length > 60 ? nextHist.slice(nextHist.length - 60) : nextHist;
        playHistoryRef.current = trimmed;
        setPlayHistory(trimmed);
      } catch {
        // ignore
      }

      try {
        const res = await fetch(`${base}/api/dev/play/rooms`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as { rooms?: Array<{ id: number; clients: number }> };
        if (!alive) return;
        setPlayRooms(Array.isArray(j.rooms) ? j.rooms : []);
      } catch {
        // ignore
      }

      // Self-Healing: Auto-Tune (based on latest h + alerts)
      if (selfHealingRef.current && json) {
        const nrP99 = json.nr?.[2] ?? 0;
        const desired = nrP99 > 60 ? 'strict' : alertDcPrev.current ? 'standard' : 'lenient';

        const now = Date.now();
        const cooldownMs = 10_000;
        const can = now - lastAutoTuneAtRef.current > cooldownMs;
        if (can && desired && desired !== (json.tm ?? '')) {
          lastAutoTuneAtRef.current = now;
          lastTuneRef.current = desired;
          const at = new Date().toLocaleTimeString();
          setHealLog((prev) => [{ at, type: 'auto-tune' as const, msg: `tune => ${desired} (nrP99=${nrP99.toFixed(1)} dcAlert=${alertDcPrev.current})` }, ...prev].slice(0, 200));
          console.log('[self-heal] auto-tune', desired);
          fetch(`${base}/api/dev/tune`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: desired }),
          })
            .then(() => refreshNowRef.current?.())
            .catch(() => {});
        }
      }
    };

    refreshNowRef.current = () => void tick();
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
      refreshNowRef.current = null;
    };
  }, [base]);

  if (err || !h) return <div style={{ padding: 16 }}>取得失敗</div>;

  const [eld50, eld90, eld99] = h.e ?? [0, 0, 0];
  const [rss, heap, ext] = h.m ?? [0, 0, 0];
  const [nr50, nr90, nr99] = h.nr ?? [0, 0, 0];
  const [maxBuffered, maxConsecutive, diffRepeat] = h.bp ?? [0, 0, 0];

  const cellColor = (r: DevRooms['rooms'][number] | null) => {
    if (!r) return '#1f2937'; // empty
    if ((r.dc ?? 0) > 0) return '#000000';
    const p99 = r.p?.p99 ?? 0;
    if (!r.p || r.p.samples <= 0) return '#374151'; // no data
    if (p99 < 30) return '#16a34a';
    if (p99 < 60) return '#eab308';
    return '#dc2626';
  };

  const playMetric = (label: string, key: string, color?: string) => (
    <>
      <div>{label}</div>
      <div style={{ color: color ?? undefined }}>{kv?.[key] ?? '-'}</div>
    </>
  );

  const playRttP99 = num(kv, 'play_rtt_p99');
  const playEldP99 = num(kv, 'play_eld_p99');
  const playClientsTotal = num(kv, 'play_clients_total');
  const playDisconnectsDelta = playDcDelta;

  const playHeatColor = (c: number) => {
    const t = Math.max(0, Math.min(1, c / 30));
    const r = Math.round(40 + t * (220 - 40));
    const g = Math.round(110 - t * 70);
    const b = Math.round(200 - t * 160);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', lineHeight: 1.55 }}>
      <style>{`
        @keyframes sanjuuBlink {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.8); }
          100% { filter: brightness(1); }
        }
      `}</style>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>SANJUU /world</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button
          disabled={!!busy}
          onClick={async () => {
            setBusy('reset');
            try {
              await fetch(`${base}/api/dev/reset`, { method: 'POST' });
            } finally {
              setBusy(null);
              refreshNowRef.current?.();
            }
          }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Reset World
        </button>

        <div style={{ opacity: 0.85 }}>Tune:</div>
        {(['strict', 'standard', 'lenient'] as const).map((m) => (
          <button
            key={m}
            disabled={!!busy}
            onClick={async () => {
              setBusy(`tune:${m}`);
              try {
                await fetch(`${base}/api/dev/tune`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ mode: m }),
                });
              } finally {
                setBusy(null);
                refreshNowRef.current?.();
              }
            }}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: h.tm === m ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontWeight: h.tm === m ? 800 : 400,
            }}
          >
            {m}
          </button>
        ))}

        {busy ? <div style={{ opacity: 0.75 }}>working...</div> : null}

        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8, opacity: 0.9 }}>
          <input type="checkbox" checked={selfHealing} onChange={(e) => setSelfHealing(e.target.checked)} />
          Self-Healing
        </label>

        <button
          disabled={!!busy}
          onClick={() => {
            setExperimentOn(true);
            experimentStartRef.current = Date.now();
            experimentDcStartRef.current = h.dc ?? 0;
            setHealLog([]);
            setSnapLog([]);
          }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Start Experiment
        </button>

        <button
          disabled={!!busy || !experimentOn}
          onClick={() => {
            const hist = historyRef.current;
            const nr = hist.map((x) => x.nrP99).filter((v) => Number.isFinite(v) && v > 0);
            const nrMin = nr.length ? Math.min(...nr) : 0;
            const nrMax = nr.length ? Math.max(...nr) : 0;
            const nrAvg = nr.length ? nr.reduce((a, b) => a + b, 0) / nr.length : 0;

            const dcStart = experimentDcStartRef.current ?? 0;
            const dcEnd = h.dc ?? 0;
            const dcTotal = Math.max(0, dcEnd - dcStart);

            const autoKillCount = healLog.filter((e) => e.type === 'auto-kill').length;
            const tuneEvents = healLog.filter((e) => e.type === 'auto-tune').map((e) => ({ at: e.at, msg: e.msg }));

            const noisyRoomIds = new Set<number>();
            for (const s of snapLog) {
              for (const r of (s.noisyRooms ?? [])) noisyRoomIds.add(Number(r.id));
            }

            const report = {
              generatedAt: new Date().toISOString(),
              startedAt: experimentStartRef.current ? new Date(experimentStartRef.current).toISOString() : null,
              durationSec: experimentStartRef.current ? Math.round((Date.now() - experimentStartRef.current) / 1000) : 0,
              world: {
                tuneMode: h.tm ?? '-',
                backpressure: {
                  maxBufferedAmount: h.bp?.[0] ?? 0,
                  backpressureMaxConsecutive: h.bp?.[1] ?? 0,
                  diffRepeat: h.bp?.[2] ?? 1,
                },
              },
              stability: {
                normalRTT_p99: { min: nrMin, max: nrMax, avg: nrAvg, samples: nr.length },
                dcTotal,
                autoKillCount,
                autoTuneTransitions: tuneEvents,
                noisyRoomsCount: noisyRoomIds.size,
                fetchFailures: errCountRef.current,
                evidence: [
                  'No crash observed (dashboard kept polling).',
                  'Self-heal events recorded with timestamps.',
                ],
              },
            };

            const log = {
              exportedAt: new Date().toISOString(),
              report,
              healLog,
              snapshots: snapLog,
              history: historyRef.current,
            };

            localStorage.setItem('sanjuu_experiment_report_latest', JSON.stringify(report));
            localStorage.setItem('sanjuu_experiment_log_latest', JSON.stringify(log));

            setExperimentOn(false);
            router.push('/world/report');
          }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}
        >
          End Experiment → Report
        </button>

        <button
          disabled={!!busy}
          onClick={() => {
            const payload = {
              exportedAt: new Date().toISOString(),
              healLog,
              snapshots: snapLog,
              history: historyRef.current,
              healthz: h,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sanjuu-experiment-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}
        >
          Export Experiment Log (JSON)
        </button>
      </div>

      {(alertNormal || alertDc) && (
        <div
          style={{
            background: '#b91c1c',
            color: '#fff',
            padding: '10px 12px',
            borderRadius: 8,
            marginBottom: 12,
            fontWeight: 800,
          }}
        >
          {alertNormal ? 'normalRTT 異常: spike 検知' : ''}
          {alertNormal && alertDc ? ' / ' : ''}
          {alertDc ? '隔離急増: dc surge 検知' : ''}
        </div>
      )}

      {explain && (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>異常の説明</div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 6 }}>
            <div>種類</div>
            <div>{explain.types.join(' / ')}</div>
            <div>推定原因</div>
            <div>{explain.cause}</div>
            <div>発生時刻</div>
            <div>{explain.at}</div>
            <div>スナップショット</div>
            <div>
              normalRTT_p99={explain.values.normalRTT_p99.toFixed(1)}ms / eld_p99={explain.values.eld_p99.toFixed(3)}ms / dcΔ=
              {explain.values.dcDelta} / rooms={explain.values.rooms} / roomsWithDc={explain.values.roomsWithDc ?? '-'} / tune=
              {explain.values.tuneMode} / bp={explain.values.backpressure.maxBufferedAmount}/
              {explain.values.backpressure.backpressureMaxConsecutive}/
              {explain.values.backpressure.diffRepeat}
            </div>
            <div>揺れたroom一覧</div>
            <div>
              {explain.noisyRooms.length === 0
                ? '-'
                : explain.noisyRooms
                    .map((r) => `${r.id}(p99=${r.p99.toFixed(1)}${r.delta != null ? `,Δ=${r.delta.toFixed(1)}` : ''}${r.dc ? `,dc=${r.dc}` : ''})`)
                    .join(' ')}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Room heatmap (10×10)</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 26px)',
              gap: 4,
              padding: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              width: 'fit-content',
            }}
          >
            {Array.from({ length: 100 }, (_, i) => {
              const r = rooms[i] ?? null;
              const bg = cellColor(r);
              const isAnom = r ? roomAnomaly.has(r.id) : false;
              const isAutoKilled = r ? (autoKilledMap.get(r.id) ?? 0) > nowMs - 30_000 : false;
              const title = r
                ? `id=${r.id}\nclients=${r.clients}\ndc=${r.dc}\np99=${r.p?.p99 ?? 0}ms`
                : 'empty';
              return (
                <button
                  key={i}
                  title={title}
                  onClick={() => r && setSelected(r)}
                  style={{
                    width: 26,
                    height: 26,
                    background: bg,
                    border: selected?.id === r?.id ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 4,
                    cursor: r ? 'pointer' : 'default',
                    padding: 0,
                    animation: isAnom ? 'sanjuuBlink 0.8s infinite' : undefined,
                    outline: isAutoKilled ? '2px solid #ef4444' : undefined,
                  }}
                />
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
            <div>green: p99&lt;30ms / yellow: p99&lt;60ms / red: ≥60ms / black: dc&gt;0</div>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Room detail</div>
          <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 12, minHeight: 112 }}>
            {selected ? (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 6 }}>
                <div>id</div>
                <div>{selected.id}</div>
                <div>clients</div>
                <div>{selected.clients}</div>
                <div>dc</div>
                <div>{selected.dc}</div>
                <div>anomaly</div>
                <div>{roomAnomaly.has(selected.id) ? '異常検知' : '-'}</div>
                <div>samples</div>
                <div>{selected.p?.samples ?? 0}</div>
                <div>p50/p90/p99</div>
                <div>
                  {(selected.p?.p50 ?? 0).toFixed(1)} / {(selected.p?.p90 ?? 0).toFixed(1)} / {(selected.p?.p99 ?? 0).toFixed(1)} ms
                </div>

                <div>ops</div>
                <div>
                  <button
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy('kill');
                      try {
                        await fetch(`${base}/api/dev/rooms/kill`, {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ id: selected.id }),
                        });
                      } finally {
                        setBusy(null);
                        setSelected(null);
                        refreshNowRef.current?.();
                      }
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: '#111',
                    }}
                  >
                    Kill room
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.75 }}>グリッドをクリックしてください。</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" interval="preserveStartEnd" />
              <YAxis yAxisId="ms" />
              <YAxis yAxisId="dc" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="ms" type="monotone" dataKey="nrP99" name="normalRTT p99 (ms)" dot={false} strokeWidth={2} />
              <Line yAxisId="ms" type="monotone" dataKey="eldP99" name="ELD p99 (ms)" dot={false} strokeWidth={2} />
              <Line yAxisId="dc" type="stepAfter" dataKey="dcDelta" name="dc delta" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={playHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" interval="preserveStartEnd" />
                <YAxis yAxisId="ms" />
                <YAxis yAxisId="dc" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="ms"
                  type="monotone"
                  dataKey="rttP99"
                  name="play RTT p99 (ms)"
                  dot={false}
                  stroke={playRttP99 > 60 ? '#ef4444' : '#f87171'}
                  strokeWidth={playRttP99 > 60 ? 3 : 2}
                />
                <Line
                  yAxisId="ms"
                  type="monotone"
                  dataKey="eldP99"
                  name="play ELD p99 (ms)"
                  dot={false}
                  stroke={playEldP99 > 40 ? '#eab308' : '#fde047'}
                  strokeWidth={playEldP99 > 40 ? 3 : 2}
                />
                <Line
                  yAxisId="dc"
                  type="stepAfter"
                  dataKey="dcDelta"
                  name="play disconnects Δ"
                  dot={<PlayRedDot />}
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>PLAY</div>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 6 }}>
              {playMetric('play_rtt_p50', 'play_rtt_p50')}
              {playMetric('play_rtt_p95', 'play_rtt_p95')}
              {playMetric('play_rtt_p99', 'play_rtt_p99', playRttP99 > 60 ? '#ef4444' : undefined)}
              {playMetric('play_eld_p50', 'play_eld_p50')}
              {playMetric('play_eld_p95', 'play_eld_p95')}
              {playMetric('play_eld_p99', 'play_eld_p99', playEldP99 > 40 ? '#eab308' : undefined)}
              {playMetric('play_mem_rss_mb', 'play_mem_rss_mb')}
              {playMetric('play_mem_heap_mb', 'play_mem_heap_mb')}
              {playMetric('play_rooms', 'play_rooms')}
              {playMetric('play_clients_total', 'play_clients_total', playClientsTotal > 0 ? '#16a34a' : undefined)}
              {playMetric('play_connections', 'play_connections')}
              {playMetric('play_disconnects', 'play_disconnects', playDisconnectsDelta > 0 ? '#ef4444' : undefined)}
              {playMetric('play_errors', 'play_errors')}
            </div>
          </div>

          <div style={{ fontWeight: 800, marginTop: 12, marginBottom: 8 }}>Play rooms heatmap (10×10)</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 26px)',
              gap: 4,
              padding: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              width: 'fit-content',
            }}
          >
            {Array.from({ length: 100 }, (_, i) => {
              const r = playRooms[i] ?? null;
              const c = r?.clients ?? 0;
              const bg = r ? playHeatColor(c) : '#0b1b3a';
              const title = r ? `id=${r.id}\nclients=${c}` : 'empty';
              return (
                <div
                  key={i}
                  title={title}
                  style={{
                    width: 26,
                    height: 26,
                    background: bg,
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 4,
                  }}
                />
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>0人=青 / 30人=赤（グラデーション）</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8 }}>
        <div>rooms</div>
        <div>{h.r}</div>

        <div>tune mode</div>
        <div>{h.tm ?? '-'}</div>

        <div>ELD(ms)</div>
        <div>
          p50={eld50.toFixed(3)} p90={eld90.toFixed(3)} p99={eld99.toFixed(3)}
        </div>

        <div>mem(MB)</div>
        <div>
          rss={mb(rss)} heap={mb(heap)} ext={mb(ext)}
        </div>

        <div>normalRTT(ms)</div>
        <div>
          p50={nr50.toFixed(1)} p90={nr90.toFixed(1)} p99={nr99.toFixed(1)}
        </div>

        <div>disconnectCount</div>
        <div>
          global={h.dc}
          {roomsWithDc != null ? ` roomsWithDc=${roomsWithDc}` : ''}
          {history.length > 0 ? ` (dcΔ=${history[history.length - 1]!.dcDelta})` : ''}
        </div>

        <div>backpressure</div>
        <div>
          maxBufferedAmount={maxBuffered} backpressureMaxConsecutive={maxConsecutive} diffRepeat={diffRepeat ?? 1}
        </div>
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Self-Heal Log</div>
        {healLog.length === 0 ? (
          <div style={{ opacity: 0.75 }}>no events</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {healLog.slice(0, 30).map((e, idx) => (
              <div key={idx} style={{ opacity: 0.9 }}>
                [{e.at}] {e.type} {e.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

