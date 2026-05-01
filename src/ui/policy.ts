export const cardClass = 'bg-white rounded-xl border border-slate-200 shadow-sm p-3';

export const btnPrimary =
  'rounded-xl bg-indigo-200 text-slate-700 p-2 text-sm font-medium active:scale-95 transition-transform';

export const btnAccent =
  'rounded-xl bg-emerald-200 text-slate-700 p-2 text-sm font-medium active:scale-95 transition-transform';

export const btnGhost =
  'rounded-xl bg-slate-100 text-slate-700 p-2 text-sm font-medium active:scale-95 transition-transform';

export const badgeClass =
  'rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700';

export const limitList = (list: string[], max = 10) =>
  list.length <= max ? { shown: list, more: 0 } : { shown: list.slice(0, max), more: list.length - max };

export const cellColorByGameValue = (gv?: number) => {
  const v = gv ?? 0;
  return [
    'bg-rose-50 border-rose-200',
    'bg-amber-50 border-amber-200',
    'bg-emerald-50 border-emerald-200',
    'bg-sky-50 border-sky-200',
  ][v] || 'bg-rose-50 border-rose-200';
};

