/**
 * 基本 UI ビジュアルカタログ — RK-01 … を目で見て選ぶ
 *
 * 開き方: `/#ui-catalog`（開発・本番どちらでも可。初回のみ chunk 読込）
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';
import {
  RK01HubMenuRow,
  RK02PrimaryTouchButton,
  RK03GhostTouchButton,
  RK04HomeBackButton,
  RK06ImmersiveHeader,
  RK07Card,
  RK08Badge,
  RK10ContentColumn,
  RK11PrimaryTouchButtonHalfW,
  RK12PrimaryTouchButtonHalfH,
  RK13GhostTouchButtonHalfW,
  RK14GhostTouchButtonHalfH,
  RK15HubMenuRowHalfW,
  RK16HubMenuRowHalfH,
  RK17ContentColumnHalfW,
  RK18HomeBackButtonHalf,
  RK19QuietRoomBackButton,
} from './baselineParts';
import { listBaselineParts, type RakudaBaselinePartId, type RakudaBaselinePartMeta } from './partsRegistry';
import { showAppToast } from '../lib/appToast';
import { vibrate } from '../lib/utils';

type FilterKey = 'all' | 'hub' | 'immersive' | 'modal' | 'any' | 'half-w' | 'half-h';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'すべて',
  hub: 'ハブ',
  immersive: '没入',
  modal: 'モーダル',
  any: '共通',
  'half-w': '半幅',
  'half-h': '半高',
};

function patternToFilter(pattern: RakudaBaselinePartMeta['pattern']): FilterKey {
  return pattern;
}

function CatalogPreview({ id }: { id: RakudaBaselinePartId }) {
  const noop = useCallback(() => vibrate(8), []);

  switch (id) {
    case 'RK-01':
      return (
        <RK01HubMenuRow
          className="bg-gradient-to-r from-rk-sky-200 to-rk-cyan-200 border-rk-sky-700/45 text-rk-sky-950 shadow-md pointer-events-none"
          onClick={noop}
        >
          <span className="font-black">ひと言探し</span>
          <span className="text-[10px] font-bold text-rk-sky-800">みんなで</span>
        </RK01HubMenuRow>
      );
    case 'RK-02':
      return (
        <RK02PrimaryTouchButton className="w-full pointer-events-none" type="button">
          もう一局
        </RK02PrimaryTouchButton>
      );
    case 'RK-03':
      return (
        <RK03GhostTouchButton className="w-full pointer-events-none" type="button">
          最初から
        </RK03GhostTouchButton>
      );
    case 'RK-04':
      return (
        <div className="flex justify-center py-2">
          <RK04HomeBackButton onClick={noop} />
        </div>
      );
    case 'RK-05':
      return (
        <div className="relative h-32 rounded-xl border-2 border-dashed border-rk-indigo-300 bg-gradient-to-b from-rk-violet-100 to-rk-indigo-50 flex flex-col items-center justify-center text-rk-slate-600 text-[0.72em] px-2 text-center leading-snug pointer-events-none">
          <span className="font-bold text-rk-violet-900">没入シェル</span>
          safe-area · 縦 flex · z-40
        </div>
      );
    case 'RK-06':
      return (
        <div className="relative rounded-xl border border-rk-success-300/80 bg-gradient-to-b from-rk-success-50 to-rk-white overflow-hidden">
          <RK06ImmersiveHeader
            title="オセロ"
            subtitle="CPU ふつう · あなたは黒"
            kickerClassName="text-rk-success-900/75"
            titleClassName="text-rk-success-950"
            subtitleClassName="text-rk-success-900/70"
            onBack={noop}
          />
        </div>
      );
    case 'RK-07':
      return (
        <RK07Card>
          <p className="text-sm font-bold text-rk-slate-800">カードの見出し</p>
          <p className="text-xs text-rk-slate-600 mt-1 leading-snug">説明文やフォームを載せる面です。</p>
        </RK07Card>
      );
    case 'RK-08':
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          <RK08Badge>募集中</RK08Badge>
          <RK08Badge className="bg-rk-amber-50 border-rk-amber-200 text-rk-amber-900">工事中</RK08Badge>
        </div>
      );
    case 'RK-09':
      return (
        <div className="rounded-xl border-2 border-[var(--rk-hub-bark)] bg-[var(--rk-hub-parchment-screen)] p-3 text-center text-sm">
          <p className="font-black text-[var(--rk-hub-bark-deep)] text-base drop-shadow-sm">らくだ珈琲</p>
          <p className="text-[0.72em] text-rk-slate-600 mt-2">ModeEntryLayout</p>
          <p className="text-[0.68em] text-rk-slate-500 mt-1">hubScroll / 大タイトル縁取り</p>
        </div>
      );
    case 'RK-10':
      return (
        <RK10ContentColumn className="mx-auto rounded-lg border border-rk-slate-300 bg-rk-white/80 py-3 text-center text-xs text-rk-slate-600">
          max-w-md 中央列
        </RK10ContentColumn>
      );
    case 'RK-11':
      return (
        <div className="flex gap-2 justify-center">
          <RK11PrimaryTouchButtonHalfW className="pointer-events-none" type="button">
            もう一局
          </RK11PrimaryTouchButtonHalfW>
          <RK13GhostTouchButtonHalfW className="pointer-events-none opacity-60" type="button">
            戻る
          </RK13GhostTouchButtonHalfW>
        </div>
      );
    case 'RK-12':
      return (
        <RK12PrimaryTouchButtonHalfH className="w-full pointer-events-none" type="button">
          もう一局
        </RK12PrimaryTouchButtonHalfH>
      );
    case 'RK-13':
      return (
        <div className="flex gap-2 justify-center">
          <RK13GhostTouchButtonHalfW className="pointer-events-none" type="button">
            最初から
          </RK13GhostTouchButtonHalfW>
          <RK13GhostTouchButtonHalfW className="pointer-events-none opacity-70" type="button">
            戻る
          </RK13GhostTouchButtonHalfW>
        </div>
      );
    case 'RK-14':
      return (
        <RK14GhostTouchButtonHalfH className="w-full pointer-events-none" type="button">
          選び直す
        </RK14GhostTouchButtonHalfH>
      );
    case 'RK-15':
      return (
        <div className="flex gap-2 justify-center">
          <RK15HubMenuRowHalfW
            className="bg-gradient-to-r from-rk-amber-200 to-rk-orange-200 border-rk-amber-700/45 text-rk-amber-950 pointer-events-none"
            onClick={noop}
          >
            <span className="text-xs font-black">掲示板</span>
          </RK15HubMenuRowHalfW>
          <RK15HubMenuRowHalfW
            className="bg-gradient-to-r from-rk-success-300 to-rk-success-300 border-rk-success-600/55 text-rk-success-950 pointer-events-none"
            onClick={noop}
          >
            <span className="text-xs font-black">しゅっせき</span>
          </RK15HubMenuRowHalfW>
        </div>
      );
    case 'RK-16':
      return (
        <RK16HubMenuRowHalfH
          className="bg-[var(--rk-hub-rose-panel)] border-[var(--rk-hub-bark)] text-[var(--rk-hub-bark-deep)] pointer-events-none"
          onClick={noop}
        >
          <span className="font-medium">ことば探し</span>
        </RK16HubMenuRowHalfH>
      );
    case 'RK-17':
      return (
        <div className="flex gap-2 justify-center w-full">
          <RK17ContentColumnHalfW className="rounded-lg border border-rk-slate-300 bg-rk-white/80 py-2 text-center text-[0.65em] text-rk-slate-600">
            左列
          </RK17ContentColumnHalfW>
          <RK17ContentColumnHalfW className="rounded-lg border border-rk-slate-300 bg-rk-white/80 py-2 text-center text-[0.65em] text-rk-slate-600">
            右列
          </RK17ContentColumnHalfW>
        </div>
      );
    case 'RK-18':
      return (
        <div className="flex items-center justify-center gap-3 py-1">
          <RK04HomeBackButton onClick={noop} />
          <span className="text-[0.65em] text-rk-slate-400">→</span>
          <RK18HomeBackButtonHalf onClick={noop} />
        </div>
      );
    case 'RK-19':
      return (
        <div className="flex justify-center py-2 rounded-xl bg-gradient-to-b from-rk-sky-100 to-rest-bg/30 px-4">
          <RK19QuietRoomBackButton onClick={noop} />
        </div>
      );
    default:
      return null;
  }
}

function CatalogCard({
  part,
  selected,
  onSelect,
}: {
  part: RakudaBaselinePartMeta;
  selected: boolean;
  onSelect: (id: RakudaBaselinePartId) => void;
}) {
  const copyId = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(part.id).then(() => {
        showAppToast(`${part.id} をコピーしました`);
        vibrate(8);
      });
    },
    [part.id],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(part.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(part.id);
        }
      }}
      className={[
        'w-full text-left rounded-2xl border-2 bg-rk-white p-3 shadow-sm transition-all cursor-pointer',
        selected
          ? 'border-rk-indigo-500 ring-2 ring-rk-indigo-200 scale-[1.01]'
          : 'border-rk-slate-200 hover:border-rk-indigo-300 active:scale-[0.99]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="shrink-0 inline-flex items-center justify-center min-w-[3.25rem] h-9 px-2 rounded-xl bg-rk-indigo-600 text-rk-white font-black text-sm tracking-tight">
          {part.id}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-black text-rk-slate-900 leading-tight">{part.labelJa}</h2>
          <p className="text-[0.72em] font-mono text-rk-indigo-800/80 mt-0.5 truncate">{part.replaceWith}</p>
          {part.basedOn ? (
            <p className="text-[0.68em] text-rk-violet-700 mt-0.5">← {part.basedOn} の半サイズ</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={copyId}
          className="shrink-0 p-2 rounded-lg bg-rk-slate-100 text-rk-slate-600 hover:bg-rk-indigo-100 hover:text-rk-indigo-800"
          title={`${part.id} をコピー`}
          aria-label={`${part.id} をコピー`}
        >
          <Copy className="size-4" aria-hidden />
        </button>
      </div>

      <div className="rounded-xl bg-rk-slate-50/90 border border-rk-slate-100 p-3 mb-2 pointer-events-none">
        <CatalogPreview id={part.id} />
      </div>

      <p className="text-[0.78em] text-rk-slate-600 leading-snug">{part.note}</p>
    </div>
  );
}

export interface RakudaUiCatalogProps {
  onClose: () => void;
}

export function RakudaUiCatalog({ onClose }: RakudaUiCatalogProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<RakudaBaselinePartId | null>(null);

  const parts = useMemo(() => {
    const all = listBaselineParts();
    if (filter === 'all') return all;
    if (filter === 'half-w') return all.filter((p) => p.sizeVariant === 'half-w');
    if (filter === 'half-h') return all.filter((p) => p.sizeVariant === 'half-h');
    return all.filter((p) => patternToFilter(p.pattern) === filter);
  }, [filter]);

  const selectedPart = selected ? parts.find((p) => p.id === selected) ?? null : null;

  const handleClose = useCallback(() => {
    vibrate(10);
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-rk-shell text-rk-fg font-rounded overflow-hidden">
      <header className="shrink-0 border-b border-rk-amber-300/80 bg-rk-white/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="max-w-3xl mx-auto flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[0.72em] font-medium text-rk-amber-900/75">らくだ珈琲</p>
            <h1 className="text-lg font-black text-rk-slate-900 leading-tight">基本 UI カタログ</h1>
            <p className="text-[0.78em] text-rk-slate-600 mt-0.5 leading-snug">
              タップで選択 · コピーアイコンで番号をコピー · Cursor には「RK-xx で」と指定
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 size-10 flex items-center justify-center rounded-xl bg-rk-slate-100 text-rk-slate-700 active:scale-95"
            aria-label="カタログを閉じる"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="max-w-3xl mx-auto flex flex-wrap gap-1.5 mt-3">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                filter === key
                  ? 'bg-rk-indigo-600 text-rk-white'
                  : 'bg-rk-slate-100 text-rk-slate-700 hover:bg-rk-indigo-100',
              ].join(' ')}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto grid gap-3 sm:grid-cols-2">
          {parts.map((part) => (
            <div key={part.id}>
              <CatalogCard part={part} selected={selected === part.id} onSelect={setSelected} />
            </div>
          ))}
        </div>
      </div>

      {selectedPart ? (
        <footer className="shrink-0 border-t border-rk-indigo-200 bg-rk-indigo-50/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2 text-sm">
            <span className="font-black text-rk-indigo-900">{selectedPart.id}</span>
            <span className="text-rk-slate-700">{selectedPart.labelJa}</span>
            <span className="text-rk-slate-400">→</span>
            <code className="text-xs font-mono bg-rk-white px-2 py-1 rounded-lg border border-rk-indigo-200 text-rk-indigo-900">
              {selectedPart.replaceWith}
            </code>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

/** URL ハッシュ `#ui-catalog` でカタログを開く */
export function isUiCatalogHash(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hash === '#ui-catalog';
}

export function closeUiCatalogHash(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', url || '/');
  } catch {
    window.location.hash = '';
  }
}

export function openUiCatalogHash(): void {
  if (typeof window === 'undefined') return;
  window.location.hash = 'ui-catalog';
}
