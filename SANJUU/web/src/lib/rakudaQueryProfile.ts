/** らくだから三十へ渡すクエリ（掲示板・ハブからの遷移で URL に付与される） */

export function readRakudaQueryProfile(): { urlEmoji: string; urlNick: string } {
  if (typeof window === 'undefined') return { urlEmoji: '', urlNick: '' };
  try {
    const sp = new URL(window.location.href).searchParams;
    return {
      urlEmoji: (sp.get('rkEmoji') ?? '').trim(),
      urlNick: (sp.get('rkNick') ?? '').trim(),
    };
  } catch {
    return { urlEmoji: '', urlNick: '' };
  }
}

/** らくだ珈琲トップメニュー（席選択） */
export function rakudaTopMenuUrl(rakudaOrigin: string): string {
  const base = rakudaOrigin.replace(/\/+$/, '');
  const u = new URL(`${base}/`);
  const { urlEmoji, urlNick } = readRakudaQueryProfile();
  if (urlEmoji) u.searchParams.set('rkEmoji', urlEmoji);
  if (urlNick) u.searchParams.set('rkNick', urlNick);
  return u.toString();
}

/** 三十募集板「ひと言探し　問題を作る」→ らくだ本体の作成フォーム */
export function rakudaHundredCreateUrl(rakudaOrigin: string): string {
  const base = rakudaOrigin.replace(/\/+$/, '');
  const u = new URL(`${base}/hundred`);
  const { urlEmoji, urlNick } = readRakudaQueryProfile();
  if (urlEmoji) u.searchParams.set('rkEmoji', urlEmoji);
  if (urlNick) u.searchParams.set('rkNick', urlNick);
  u.hash = 'rk-hundred-create';
  return u.toString();
}

/** 三十募集板「ペア探し　問題を作る」→ らくだ本体の作成フォーム */
export function rakudaTileMatchCreateUrl(rakudaOrigin: string): string {
  const base = rakudaOrigin.replace(/\/+$/, '');
  const u = new URL(`${base}/hundred`);
  const { urlEmoji, urlNick } = readRakudaQueryProfile();
  if (urlEmoji) u.searchParams.set('rkEmoji', urlEmoji);
  if (urlNick) u.searchParams.set('rkNick', urlNick);
  u.hash = 'rk-tile-match-create';
  return u.toString();
}

/** 三十募集板「ペア探し　ひとりで遊ぶ」→ らくだ本体ソロプレイ */
export function rakudaTileMatchSoloPlayUrl(rakudaOrigin: string): string {
  const base = rakudaOrigin.replace(/\/+$/, '');
  const u = new URL(`${base}/`);
  u.searchParams.set('play', 'tile-match');
  const { urlEmoji, urlNick } = readRakudaQueryProfile();
  if (urlEmoji) u.searchParams.set('rkEmoji', urlEmoji);
  if (urlNick) u.searchParams.set('rkNick', urlNick);
  return u.toString();
}
