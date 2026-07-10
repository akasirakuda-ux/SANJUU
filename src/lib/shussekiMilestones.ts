/** しゅっせき簿の節目（ランキングなし・画面だけのお祝い） */

import { RAKUDA_SUPPORT_GATE_LABEL } from '../constants/rakudaSupportGateLabels';

export type ShussekiMilestone = {
  days: number;
  title: string;
  body: string;
  toast: string;
};

export const SHUSSEKI_MILESTONES: readonly ShussekiMilestone[] = [
  {
    days: 10,
    title: '10日おめでとう',
    body: 'らくだ珈琲に来てくれて、ありがとう。',
    toast: 'しゅっせき10日 — おめでとう！',
  },
  {
    days: 30,
    title: '30日おめでとう',
    body: 'だんだんお店になじんできたね。',
    toast: 'しゅっせき30日 — おめでとう！',
  },
  {
    days: 100,
    title: '常連さん',
    body: '100日、ありがとう。らくだ珈琲の常連さんです。',
    toast: '常連さんになりました — しゅっせき100日、ありがとう！',
  },
] as const;

export const SHUSSEKI_100_GREEN_HINT_JA =
  `（任意）広告なしで応援するなら、設定の「${RAKUDA_SUPPORT_GATE_LABEL}」`;

export type ShussekiMilestoneToastOpts = {
  /** 100日到達時のみ。緑決済ONかつ本人が緑でないとき */
  appendGreenHint?: boolean;
};

/** 到達済みのうちいちばん大きい節目（表示用） */
export function getShussekiMilestoneForTotal(total: number): ShussekiMilestone | null {
  let best: ShussekiMilestone | null = null;
  for (const m of SHUSSEKI_MILESTONES) {
    if (total >= m.days) best = m;
  }
  return best;
}

/** 新しいスタンプで初めて節目を越えたときのトースト（最大1件・いちばん大きい節目） */
export function shussekiMilestoneToastAfterNewStamp(
  beforeTotal: number,
  afterTotal: number,
  opts: ShussekiMilestoneToastOpts = {},
): string | null {
  if (afterTotal <= beforeTotal) return null;
  let crossed: ShussekiMilestone | null = null;
  for (const m of SHUSSEKI_MILESTONES) {
    if (beforeTotal < m.days && afterTotal >= m.days) crossed = m;
  }
  if (!crossed) return null;
  if (crossed.days === 100 && opts.appendGreenHint) {
    return `${crossed.toast}\n${SHUSSEKI_100_GREEN_HINT_JA}`;
  }
  return crossed.toast;
}
