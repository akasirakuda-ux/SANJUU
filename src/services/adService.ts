/**
 * 広告（ゲート別の全面表示）
 * 固定バナーは使わない。全面は `tryInterstitialAtNaturalBreak` およびスライドパズル自動から起動。
 * AdMob 等を接続する際はこのファイルを差し替えで済むようにしておく。
 */

import { isAdsenseSiteApprovedForGateAds } from '../lib/adsenseSiteConfig';
import {
  gateAdSequenceForGate,
  pickGateAdDurationSec,
  singleGateAdSlot,
  type GateAdSlot,
  type RakudaGateId,
} from '../lib/rakudaGate';

export type GateAdPresentation = GateAdSlot & {
  durationSec: number;
  slotIndex: number;
  slotTotal: number;
};

export type InterstitialUiHandler = (presentation: GateAdPresentation) => Promise<void>;

let interstitialUiHandler: InterstitialUiHandler | null = null;

/** AppShell が全面プレースホルダー UI を登録する */
export function setInterstitialUiHandler(handler: InterstitialUiHandler | null): void {
  interstitialUiHandler = handler;
}

function buildPresentation(slot: GateAdSlot, slotIndex: number, slotTotal: number): GateAdPresentation {
  return {
    ...slot,
    durationSec: pickGateAdDurationSec(slot),
    slotIndex,
    slotTotal,
  };
}

export const adService = {
  /** 1スロット分の全面広告 */
  showGateAd: async (slot: GateAdSlot, slotIndex: number, slotTotal: number): Promise<boolean> => {
    if (!isAdsenseSiteApprovedForGateAds()) return false;
    const presentation = buildPresentation(slot, slotIndex, slotTotal);
    if (import.meta.env.DEV) {
      console.log('[AD_SERVICE]', presentation.kind, `${presentation.durationSec}s`, `${slotIndex}/${slotTotal}`);
    }
    if (interstitialUiHandler) {
      await interstitialUiHandler(presentation);
    }
    return true;
  },

  /** ゲート契約どおりの列を順に表示（自然な区切り） */
  showInterstitialForGate: async (gate: RakudaGateId | null): Promise<boolean> => {
    const slots = gateAdSequenceForGate(gate);
    for (let i = 0; i < slots.length; i += 1) {
      await adService.showGateAd(slots[i]!, i + 1, slots.length);
    }
    return slots.length > 0;
  },

  /** 1本だけ（スライドパズル自動など） */
  showSingleGateAd: async (gate: RakudaGateId | null): Promise<boolean> => {
    const slot = singleGateAdSlot(gate);
    if (!slot) return false;
    return adService.showGateAd(slot, 1, 1);
  },

  /** @deprecated `showGateAd` / `showInterstitialForGate` を使う */
  showInterstitial: async (): Promise<boolean> => adService.showSingleGateAd('blue'),

  config: {
    rewardedOrInterstitialId: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  },
};
