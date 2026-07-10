/** ゲート画面「らくだ珈琲（自己紹介）」— URL・文面は後から足せる */

export type RakudaIntroLinkItem = {
  label: string;
  href: string;
};

/** 配信・プロフィール用の検索ワード（盤面左上など） */
export const RAKUDA_SEARCH_KEYWORD_LABEL = '🔎らくだ珈琲';

/** 折りたたみ見出し */
export const RAKUDA_INTRO_SUMMARY = '配信・自己紹介';

/** 閉じたときに見える一行（配信時間の予告） */
export const RAKUDA_INTRO_TEASER = '基本毎日 · TikTok 11:00 / YouTube 18:30';

/**
 * パネル内の説明文（任意・複数行可）
 */
export const RAKUDA_INTRO_LEAD = '配信でもこのサイトで一緒に遊んでいます。';

export type RakudaIntroScheduleItem = {
  platform: string;
  time: string;
  emoji: string;
};

export const RAKUDA_INTRO_SCHEDULE: readonly RakudaIntroScheduleItem[] = [
  { emoji: '📱', platform: 'TikTok', time: '11:00〜12:00' },
  { emoji: '📺', platform: 'YouTube', time: '18:30〜19:30' },
];

/** @deprecated body lines — use RAKUDA_INTRO_LEAD + RAKUDA_INTRO_SCHEDULE */
export const RAKUDA_INTRO_BODY_LINES: readonly string[] = [];

/** 自己紹介動画・YouTube・TikTok など（href が空の行は表示しない） */
export const RAKUDA_INTRO_LINKS: readonly RakudaIntroLinkItem[] = [
  { label: '自己紹介動画（2025/1/31）', href: 'https://www.youtube.com/watch?v=uUX3oklSMsA' },
  { label: 'TikTok @akasirakuda', href: 'https://www.tiktok.com/@akasirakuda' },
  { label: 'YouTube らくだ珈琲', href: 'https://www.youtube.com/@らくだ珈琲' },
];

export function rakudaIntroHasContent(): boolean {
  return (
    Boolean(RAKUDA_INTRO_LEAD.trim()) ||
    RAKUDA_INTRO_SCHEDULE.length > 0 ||
    RAKUDA_INTRO_BODY_LINES.some((line) => line.trim()) ||
    RAKUDA_INTRO_LINKS.some((l) => l.href.trim())
  );
}

export function rakudaIntroVisibleLinks(): RakudaIntroLinkItem[] {
  return RAKUDA_INTRO_LINKS.filter((l) => l.label.trim() && l.href.trim());
}
