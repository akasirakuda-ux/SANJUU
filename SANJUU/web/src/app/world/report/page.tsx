'use client';

import { useState } from 'react';

export default function WorldReportPage() {
  const [report] = useState<unknown>(() => {
    try {
      const raw = localStorage.getItem('sanjuu_experiment_report_latest');
      if (!raw) return null;
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  });

  if (!report) return <div style={{ padding: 16 }}>レポートがありません（/world で End Experiment を実行してください）</div>;

  type Report = {
    generatedAt?: string;
    startedAt?: string;
    durationSec?: number;
    world?: { tuneMode?: string; backpressure?: { maxBufferedAmount?: number; backpressureMaxConsecutive?: number; diffRepeat?: number } };
    stability?: {
      normalRTT_p99?: { min?: number; max?: number; avg?: number; samples?: number };
      dcTotal?: number;
      autoKillCount?: number;
      noisyRoomsCount?: number;
      fetchFailures?: number;
      autoTuneTransitions?: unknown[];
      evidence?: unknown[];
    };
  };
  const r = report as Report;
  const n = r.stability?.normalRTT_p99 ?? {};

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', lineHeight: 1.55 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>SANJUU /world/report</div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8, marginBottom: 12 }}>
        <div>generatedAt</div>
        <div>{r.generatedAt}</div>
        <div>startedAt</div>
        <div>{r.startedAt ?? '-'}</div>
        <div>durationSec</div>
        <div>{r.durationSec}</div>
        <div>tuneMode</div>
        <div>{r.world?.tuneMode}</div>
        <div>backpressure</div>
        <div>
          {r.world?.backpressure?.maxBufferedAmount}/{r.world?.backpressure?.backpressureMaxConsecutive}/{r.world?.backpressure?.diffRepeat}
        </div>
        <div>normalRTT p99</div>
        <div>
          min={Number(n.min ?? 0).toFixed(1)} max={Number(n.max ?? 0).toFixed(1)} avg={Number(n.avg ?? 0).toFixed(1)} samples={n.samples ?? 0}
        </div>
        <div>dcTotal</div>
        <div>{r.stability?.dcTotal ?? 0}</div>
        <div>autoKillCount</div>
        <div>{r.stability?.autoKillCount ?? 0}</div>
        <div>noisyRoomsCount</div>
        <div>{r.stability?.noisyRoomsCount ?? 0}</div>
        <div>fetchFailures</div>
        <div>{r.stability?.fetchFailures ?? 0}</div>
      </div>

      <div style={{ fontWeight: 800, margin: '12px 0 6px' }}>Auto-Tune transitions</div>
      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
        {JSON.stringify(r.stability?.autoTuneTransitions ?? [], null, 2)}
      </pre>

      <div style={{ fontWeight: 800, margin: '12px 0 6px' }}>Evidence</div>
      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
        {JSON.stringify(r.stability?.evidence ?? [], null, 2)}
      </pre>
    </div>
  );
}

