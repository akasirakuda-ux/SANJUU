/** ゲームクリア → YouTube LIVE チャット報告用（コピペ） */
export type LiveClearReportKind =
  | 'kotoba'
  | 'hitokoto'
  | 'slide-puzzle'
  | 'sudoku'
  | 'reversi'
  | 'gomoku';

const RAKUDA_SITE_URL = 'https://rakuda.coffee/';

const LIVE_CLEAR_REPORT_TEXT: Record<LiveClearReportKind, string> = {
  hitokoto: `ひと言探しクリヤしたよ！ 🐪 ${RAKUDA_SITE_URL}`,
  kotoba: `ことば探しクリアしたよ！ 🐪 ${RAKUDA_SITE_URL}`,
  'slide-puzzle': `スライドパズルクリアしたよ！ 🐪 ${RAKUDA_SITE_URL}`,
  sudoku: `9×9パズルクリアしたよ！ 🐪 ${RAKUDA_SITE_URL}`,
  reversi: `リバーシに勝ったよ！ 🐪 ${RAKUDA_SITE_URL}`,
  gomoku: `五目並べに勝ったよ！ 🐪 ${RAKUDA_SITE_URL}`,
};

export function liveClearReportText(kind: LiveClearReportKind): string {
  return LIVE_CLEAR_REPORT_TEXT[kind];
}

export async function copyLiveClearReportText(kind: LiveClearReportKind): Promise<boolean> {
  const value = liveClearReportText(kind);
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function liveClearReportToastMessage(ok: boolean): string {
  return ok
    ? 'コピーしたよ！LIVEのチャット欄に貼り付けてね'
    : 'コピーできませんでした。もう一度お試しください';
}

/** 1人クリア時 — クリア画面のお祝い・LIVE案内（文言固定） */
export const LIVE_SOLO_CLEAR_CELEBRATION =
  '1人でクリアできたら、大したものです。周りの大人はできるかな？';

export const LIVE_SOLO_CLEAR_ENCOURAGEMENT = [
  'らくだで配信に教えてあげてね。',
  'みんなが「スゴー！😀」って言ってくれますよ。',
] as const;
