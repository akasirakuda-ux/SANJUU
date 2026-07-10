import React, { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { cardClass } from '../../ui/policy';

const STORAGE_KEY = 'rk_admin_revenue_sim_v1';
const TARGET_MONTHLY_YEN = 1_000_000;

type SimInputs = {
  monthlyUsers: number;
  adRevenuePerUser: number;
  subCount: number;
  subMonthlyFee: number;
};

const DEFAULTS: SimInputs = {
  monthlyUsers: 690,
  adRevenuePerUser: 0,
  subCount: 0,
  subMonthlyFee: 0,
};

function loadInputs(): SimInputs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SimInputs>;
    return {
      monthlyUsers: Number(parsed.monthlyUsers) || 0,
      adRevenuePerUser: Number(parsed.adRevenuePerUser) || 0,
      subCount: Number(parsed.subCount) || 0,
      subMonthlyFee: Number(parsed.subMonthlyFee) || 0,
    };
  } catch {
    return DEFAULTS;
  }
}

function formatYen(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

const RevenueSimulator: React.FC = () => {
  const [inputs, setInputs] = useState<SimInputs>(() => loadInputs());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      /* ignore */
    }
  }, [inputs]);

  const results = useMemo(() => {
    const adTotal = inputs.monthlyUsers * inputs.adRevenuePerUser;
    const subTotal = inputs.subCount * inputs.subMonthlyFee;
    const monthlyTotal = adTotal + subTotal;
    return {
      adTotal,
      subTotal,
      monthlyTotal,
      annualTotal: monthlyTotal * 12,
      gapToTarget: TARGET_MONTHLY_YEN - monthlyTotal,
      pctOfTarget: TARGET_MONTHLY_YEN > 0 ? (monthlyTotal / TARGET_MONTHLY_YEN) * 100 : 0,
    };
  }, [inputs]);

  const setField = (key: keyof SimInputs, raw: string) => {
    const n = raw === '' ? 0 : Math.max(0, Number(raw));
    setInputs((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const fields: {
    key: keyof SimInputs;
    label: string;
    labelNote?: string;
    unit: string;
    step?: string;
  }[] = [
    { key: 'monthlyUsers', label: '月の利用者数（アナリティクスのアクティブユーザ）', unit: '人' },
    {
      key: 'adRevenuePerUser',
      label: '1人あたり広告収入',
      labelNote: '広告平均単価',
      unit: '円/月',
      step: '0.1',
    },
    { key: 'subCount', label: 'サブスク人数', unit: '人' },
    { key: 'subMonthlyFee', label: 'サブスク月額', unit: '円/月' },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Calculator size={16} aria-hidden /> 収益シミュレーション
      </h3>
      <div className={`${cardClass} space-y-4 border-rk-amber-200 bg-rk-amber-50/60`}>
        <p className="text-[10px] font-bold text-rk-slate-500 leading-relaxed">
          数字を入れると自動計算します。入力はこの端末にだけ保存されます。
        </p>
        <div className="grid grid-cols-1 gap-3">
          {fields.map(({ key, label, labelNote, unit, step }) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs font-black text-rk-slate-700">
                {label}
                {labelNote ? (
                  <span className="font-bold text-rk-slate-500">（{labelNote}）</span>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={step ?? '1'}
                  inputMode="decimal"
                  value={inputs[key] === 0 ? '' : inputs[key]}
                  placeholder="0"
                  onChange={(e) => setField(key, e.target.value)}
                  className="flex-1 h-11 px-3 rounded-xl border-2 border-rk-slate-200 bg-rk-white text-sm font-bold text-rk-slate-800 focus:border-rk-amber-400 outline-none"
                />
                <span className="text-[10px] font-bold text-rk-slate-500 shrink-0 w-14">{unit}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="rounded-xl border-2 border-rk-amber-300 bg-rk-white p-3 space-y-2">
          <div className="flex justify-between gap-2 text-xs font-bold text-rk-slate-600">
            <span>広告収入（月）</span>
            <span className="tabular-nums">{formatYen(results.adTotal)}</span>
          </div>
          <div className="flex justify-between gap-2 text-xs font-bold text-rk-slate-600">
            <span>サブスク収入（月）</span>
            <span className="tabular-nums">{formatYen(results.subTotal)}</span>
          </div>
          <div className="border-t border-rk-amber-200 pt-2 flex justify-between gap-2">
            <span className="text-sm font-black text-rk-slate-800">合計（月）</span>
            <span className="text-sm font-black text-rk-slate-900 tabular-nums">{formatYen(results.monthlyTotal)}</span>
          </div>
          <div className="flex justify-between gap-2 text-xs font-bold text-rk-slate-500">
            <span>合計（年）</span>
            <span className="tabular-nums">{formatYen(results.annualTotal)}</span>
          </div>
          <div className="rounded-lg bg-rk-slate-50 px-2 py-2 text-[10px] font-bold text-rk-slate-600 leading-relaxed">
            目標 {formatYen(TARGET_MONTHLY_YEN)}/月 に対して{' '}
            <span className="text-rk-slate-800">{results.pctOfTarget.toFixed(1)}%</span>
            {results.gapToTarget > 0 ? (
              <>
                {' '}
                （あと <span className="text-rk-slate-800">{formatYen(results.gapToTarget)}</span>）
              </>
            ) : (
              <> — 目標達成</>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RevenueSimulator;
