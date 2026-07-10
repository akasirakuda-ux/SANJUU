import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Users } from 'lucide-react';
import { auth } from '../../firebase';
import { cardClass } from '../../ui/policy';
import {
  buildGreenPassDistributorHandout,
  buildGreenPassUserInstruction,
  createGreenPassesAdmin,
  GREEN_PASS_DEFAULT_LABEL,
  greenPassManualEntryUrl,
  listGreenPassReferrersAdmin,
  listGreenPassesAdmin,
  type GreenPassAdminRow,
  type GreenPassReferrerRow,
} from '../../lib/greenGatePassConfig';

function statusLabelJa(status: GreenPassAdminRow['status']): string {
  switch (status) {
    case 'available':
      return '未使用';
    case 'redeemed':
      return '使用済';
    case 'revoked':
      return '無効';
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const GreenGatePassAdmin: React.FC = () => {
  const [rows, setRows] = useState<GreenPassAdminRow[]>([]);
  const [referrers, setReferrers] = useState<GreenPassReferrerRow[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ok' | 'denied' | 'error'>('idle');
  const [issueCount, setIssueCount] = useState(1);
  const [issueLabel, setIssueLabel] = useState(GREEN_PASS_DEFAULT_LABEL);
  const [selectedReferrerId, setSelectedReferrerId] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [referrerFacility, setReferrerFacility] = useState('');
  const [introducedBy, setIntroducedBy] = useState('');
  const [referrerNote, setReferrerNote] = useState('');
  const [referrerAdvocate, setReferrerAdvocate] = useState(false);
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueNotice, setIssueNotice] = useState<string | null>(null);
  const [freshCodes, setFreshCodes] = useState<{ code: string; redeemUrl: string }[]>([]);
  const [lastIssueLabel, setLastIssueLabel] = useState(GREEN_PASS_DEFAULT_LABEL);
  const [lastReferrerName, setLastReferrerName] = useState('');
  const [lastReferrerFacility, setLastReferrerFacility] = useState('');

  const applyReferrerToForm = (ref: GreenPassReferrerRow) => {
    setSelectedReferrerId(ref.id);
    setReferrerName(ref.name);
    setReferrerFacility(ref.facility);
    setIntroducedBy(ref.introducedBy);
    setReferrerNote(ref.note);
    setReferrerAdvocate(ref.advocate);
  };

  const clearReferrerForm = () => {
    setSelectedReferrerId('');
    setReferrerName('');
    setReferrerFacility('');
    setIntroducedBy('');
    setReferrerNote('');
    setReferrerAdvocate(false);
  };

  const copyHandout = async (
    passes: { code: string; redeemUrl: string }[],
    label: string,
    refName: string,
    refFacility: string,
  ) => {
    const ok = await copyText(
      buildGreenPassDistributorHandout(passes, {
        label,
        referrerName: refName,
        referrerFacility: refFacility,
      }),
    );
    if (ok) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '配布担当者向け説明をコピーしました' }));
    }
  };

  const reload = useCallback(async () => {
    setLoadState('loading');
    try {
      const user = auth.currentUser;
      if (!user) {
        setLoadState('denied');
        setRows([]);
        setReferrers([]);
        return;
      }
      const token = await user.getIdToken();
      const [passesResult, referrersResult] = await Promise.all([
        listGreenPassesAdmin(token),
        listGreenPassReferrersAdmin(token),
      ]);
      if (!passesResult.ok) {
        setLoadState(passesResult.error === 'admin_required' ? 'denied' : 'error');
        setRows([]);
        setReferrers([]);
        return;
      }
      setRows(passesResult.passes);
      setReferrers(referrersResult.ok ? referrersResult.referrers : []);
      setLoadState('ok');
    } catch {
      setLoadState('error');
      setRows([]);
      setReferrers([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(() => {
    const available = rows.filter((r) => r.status === 'available').length;
    const redeemed = rows.filter((r) => r.status === 'redeemed').length;
    return { available, redeemed, total: rows.length };
  }, [rows]);

  const handleIssue = async () => {
    if (issueBusy) return;
    setIssueBusy(true);
    setIssueNotice(null);
    setFreshCodes([]);
    try {
      const user = auth.currentUser;
      if (!user) {
        setIssueNotice('Google 管理者ログインが必要です');
        return;
      }
      const token = await user.getIdToken();
      const nameTrim = referrerName.trim();
      const result = await createGreenPassesAdmin(token, {
        count: issueCount,
        label: issueLabel.trim() || undefined,
        ...(selectedReferrerId
          ? {
              referrerId: selectedReferrerId,
              referrer: {
                name: nameTrim || referrers.find((r) => r.id === selectedReferrerId)?.name || '—',
                facility: referrerFacility.trim() || undefined,
                introducedBy: introducedBy.trim() || undefined,
                note: referrerNote.trim() || undefined,
                advocate: referrerAdvocate,
              },
            }
          : nameTrim
            ? {
                referrer: {
                  name: nameTrim,
                  facility: referrerFacility.trim() || undefined,
                  introducedBy: introducedBy.trim() || undefined,
                  note: referrerNote.trim() || undefined,
                  advocate: referrerAdvocate,
                },
              }
            : {}),
      });
      if (!result.ok) {
        setIssueNotice('発行に失敗しました');
        return;
      }
      setFreshCodes(result.passes);
      setLastIssueLabel(result.label);
      setLastReferrerName(result.referrerName || nameTrim);
      setLastReferrerFacility(referrerFacility.trim());
      setIssueNotice(
        result.referrerName
          ? `${result.passes.length} 件発行しました（紹介者: ${result.referrerName}）。`
          : `${result.passes.length} 件発行しました。`,
      );
      await reload();
    } finally {
      setIssueBusy(false);
    }
  };

  return (
    <section
      className={`${cardClass} space-y-3 border-2 border-rk-success-600 bg-rk-success-50/50 shadow-sm ring-1 ring-rk-success-300/80`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-black text-rk-slate-400 uppercase tracking-widest flex items-center gap-2 min-w-0">
          <Gift size={16} className="text-rk-success-800" /> 感謝の1年無料パス
        </h3>
        <button type="button" onClick={() => void reload()} className="text-[10px] font-bold text-rk-slate-600 underline">
          再読み込み
        </button>
      </div>

      <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">
        緑のゲート（1年・広告なし）の<strong>配布コード</strong>を発行します。紹介者・配布担当を記録すると、誰経由か残ります。
        未使用 {counts.available} / 使用済 {counts.redeemed}
      </p>
      <div className="rounded-lg border border-rk-amber-200 bg-rk-amber-50/90 px-3 py-2 text-[10px] font-bold text-rk-amber-950 leading-relaxed space-y-1">
        <p>
          <strong>サイトには載せていません。</strong>
          トップ・緑ゲートにコード入力は出しません。渡す相手だけに送ってください。
        </p>
        <p>
          受け取った方: ① 発行リンク（推奨） ②{' '}
          <button
            type="button"
            onClick={() => void copyText(greenPassManualEntryUrl())}
            className="underline text-rk-sky-800"
          >
            手入力ページ
          </button>
          （{greenPassManualEntryUrl()}）
        </p>
        <p>「配布担当者向け説明をコピー」＝ 担当者向けルール＋受け取り用メッセージ（1人分ずつ）一式</p>
      </div>

      {referrers.length > 0 ? (
        <div className="rounded-xl border border-rk-violet-200 bg-rk-violet-50/80 p-3 space-y-2">
          <p className="text-[10px] font-black text-rk-violet-900 flex items-center gap-1">
            <Users size={12} /> 紹介者一覧（{referrers.length}人）
          </p>
          <ul className="space-y-1.5 max-h-[min(28vh,240px)] overflow-y-auto custom-scrollbar">
            {referrers.map((ref) => (
              <li key={ref.id} className="rounded-lg border border-rk-violet-200 bg-rk-white px-2.5 py-2 text-[10px] font-bold text-rk-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-rk-slate-900">
                      {ref.name}
                      {ref.facility ? <span className="font-bold text-rk-slate-500">（{ref.facility}）</span> : null}
                      {ref.advocate ? (
                        <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-rk-amber-100 text-rk-amber-900 border border-rk-amber-200">
                          宣伝役
                        </span>
                      ) : null}
                    </p>
                    {ref.introducedBy ? (
                      <p className="text-rk-slate-500 mt-0.5">紹介: {ref.introducedBy} 経由</p>
                    ) : null}
                    <p className="text-rk-slate-500 mt-0.5">
                      発行 {ref.issuedCount} / 使用 {ref.redeemedCount} / 未使用目安 {ref.availableCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyReferrerToForm(ref)}
                    className="shrink-0 text-[9px] font-black underline text-rk-sky-800"
                  >
                    再発行
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-rk-success-300 bg-rk-white/90 p-3 space-y-2">
        <p className="text-[10px] font-black text-rk-success-900 uppercase tracking-widest">紹介者・配布担当</p>
        {referrers.length > 0 ? (
          <select
            value={selectedReferrerId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                clearReferrerForm();
                return;
              }
              const ref = referrers.find((r) => r.id === id);
              if (ref) applyReferrerToForm(ref);
            }}
            className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-xs font-bold"
          >
            <option value="">新しい紹介者を入力</option>
            {referrers.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {ref.name}
                {ref.facility ? `（${ref.facility}）` : ''}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="text"
          value={referrerName}
          onChange={(e) => {
            setSelectedReferrerId('');
            setReferrerName(e.target.value);
          }}
          placeholder="名前（例: 田中さん）"
          maxLength={80}
          className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-sm font-bold"
        />
        <input
          type="text"
          value={referrerFacility}
          onChange={(e) => setReferrerFacility(e.target.value)}
          placeholder="施設・場所（例: ○○放デイ）任意"
          maxLength={80}
          className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-sm font-bold"
        />
        <input
          type="text"
          value={introducedBy}
          onChange={(e) => setIntroducedBy(e.target.value)}
          placeholder="誰の紹介か（例: 佐藤さん）任意"
          maxLength={80}
          className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-sm font-bold"
        />
        <input
          type="text"
          value={referrerNote}
          onChange={(e) => setReferrerNote(e.target.value)}
          placeholder="メモ（任意）"
          maxLength={200}
          className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-sm font-bold"
        />
        <label className="flex items-center gap-2 text-[11px] font-bold text-rk-slate-700">
          <input
            type="checkbox"
            checked={referrerAdvocate}
            onChange={(e) => setReferrerAdvocate(e.target.checked)}
            className="rounded border-rk-slate-300"
          />
          宣伝役（当面口コミで広げてくれる方）
        </label>
      </div>

      <div className="rounded-xl border border-rk-success-300 bg-rk-white/90 p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIssueCount(5)}
            className="text-[10px] font-black px-3 py-1.5 rounded-lg border border-rk-success-300 bg-rk-success-50 text-rk-success-900"
          >
            5枚プリセット
          </button>
        </div>
        <label className="block text-[10px] font-black text-rk-slate-500 uppercase tracking-widest">発行枚数</label>
        <input
          type="number"
          min={1}
          max={20}
          value={issueCount}
          onChange={(e) => setIssueCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-sm font-bold"
        />
        <label className="block text-[10px] font-black text-rk-slate-500 uppercase tracking-widest">パス名メモ（任意）</label>
        <input
          type="text"
          value={issueLabel}
          onChange={(e) => setIssueLabel(e.target.value)}
          maxLength={80}
          className="w-full rounded-lg border border-rk-slate-200 px-3 py-2 text-sm font-bold"
        />
        <button
          type="button"
          disabled={issueBusy}
          onClick={() => void handleIssue()}
          className="w-full py-2.5 rounded-xl bg-rk-success-700 text-rk-white font-black text-sm disabled:opacity-60"
        >
          {issueBusy ? '発行中…' : 'コードを発行'}
        </button>
        {issueNotice ? <p className="text-[10px] font-bold text-rk-success-800">{issueNotice}</p> : null}
      </div>

      {freshCodes.length > 0 ? (
        <div className="rounded-xl border border-rk-sky-200 bg-rk-sky-50/80 p-3 space-y-2">
          <button
            type="button"
            onClick={() =>
              void copyHandout(freshCodes, lastIssueLabel, lastReferrerName, lastReferrerFacility)
            }
            className="w-full py-2 rounded-xl border-2 border-rk-sky-500 bg-rk-sky-600 text-rk-white font-black text-xs"
          >
            配布担当者向け説明をコピー（{freshCodes.length}枚分）
          </button>
        </div>
      ) : null}

      {freshCodes.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-rk-amber-300 bg-rk-amber-50/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black text-rk-amber-900">今回発行したコード</p>
            <button
              type="button"
              onClick={() =>
                void copyHandout(freshCodes, lastIssueLabel, lastReferrerName, lastReferrerFacility)
              }
              className="text-[10px] font-black underline text-rk-sky-800"
            >
              説明＋一覧をコピー
            </button>
          </div>
          <ul className="space-y-2">
            {freshCodes.map((row) => (
              <li
                key={row.code}
                className="rounded-lg border border-rk-amber-200 bg-rk-white px-2.5 py-2 text-[10px] font-bold text-rk-slate-700 space-y-1.5"
              >
                <div className="font-black text-rk-success-900 tracking-widest">{row.code}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(buildGreenPassUserInstruction(row.redeemUrl, lastIssueLabel, row.code))
                    }
                    className="underline text-rk-sky-800"
                  >
                    受け取り用メッセージ
                  </button>
                  <button type="button" onClick={() => void copyText(row.redeemUrl)} className="underline text-rk-sky-800">
                    リンクURL
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(greenPassManualEntryUrl())}
                    className="underline text-rk-sky-800"
                  >
                    手入力ページ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loadState === 'loading' ? <p className="text-center py-4 text-rk-slate-400 text-xs font-bold">読み込み中…</p> : null}
      {loadState === 'denied' ? (
        <p className="text-xs font-bold text-rk-red-800">管理者のみ利用できます。</p>
      ) : null}
      {loadState === 'error' ? <p className="text-xs font-bold text-rk-red-800">読み込みに失敗しました。</p> : null}

      {rows.length > 0 ? (
        <ul className="space-y-2 max-h-[min(40vh,360px)] overflow-y-auto custom-scrollbar">
          {rows.map((row) => (
            <li
              key={row.code}
              className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${
                row.status === 'available'
                  ? 'border-rk-success-300 bg-rk-success-50/80 text-rk-slate-700'
                  : 'border-rk-slate-200 bg-rk-slate-50 text-rk-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-black tracking-widest text-rk-success-900">{row.code}</span>
                <span className="shrink-0 rounded-full bg-rk-white px-2 py-0.5 border border-rk-slate-200">
                  {statusLabelJa(row.status)}
                </span>
              </div>
              {row.referrerName ? (
                <p className="mt-1 text-rk-violet-800">
                  紹介: {row.referrerName}
                  {row.referrerFacility ? `（${row.referrerFacility}）` : ''}
                  {row.introducedBy ? ` ← ${row.introducedBy}経由` : ''}
                </p>
              ) : null}
              {row.status === 'available' ? (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(
                        buildGreenPassUserInstruction(row.redeemUrl, row.label || GREEN_PASS_DEFAULT_LABEL, row.code),
                      )
                    }
                    className="underline text-rk-sky-800"
                  >
                    受け取り用
                  </button>
                  <button type="button" onClick={() => void copyText(row.code)} className="underline text-rk-sky-800">
                    コード
                  </button>
                  <button type="button" onClick={() => void copyText(row.redeemUrl)} className="underline text-rk-sky-800">
                    リンク
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(greenPassManualEntryUrl())}
                    className="underline text-rk-sky-800"
                  >
                    /pass
                  </button>
                </div>
              ) : row.redeemedByUid ? (
                <p className="mt-1 text-rk-slate-500">使用者 UID: {row.redeemedByUid.slice(0, 12)}…</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : loadState === 'ok' ? (
        <p className="text-center py-4 text-rk-slate-400 text-xs font-bold">まだコードがありません。</p>
      ) : null}
    </section>
  );
};

export default GreenGatePassAdmin;
