/** らくだ珈琲 — ゲート（blue＝無料・green＝応援¥500/月）。茶は廃止（既存は blue へ移行）。らくださん呼称: 応援＝青ゲート */

import {
  RAKUDA_DEFAULT_PLAY_LABEL,
  RAKUDA_SUPPORT_GATE_LABEL,
} from '../constants/rakudaSupportGateLabels';
import { GREEN_GATE_PERIOD_MONTHS } from './greenGateStripeConfig';

export type RakudaGateId = 'blue' | 'brown' | 'green';

const STORAGE_GATE = 'rk_gate_id_v1';
const STORAGE_GREEN_UNTIL_MS = 'rk_gate_green_until_ms_v1';
/** 初回のみ：ゲート画面を出さず青で入場した印 */
const STORAGE_GATE_DEFAULTED = 'rk_gate_defaulted_v1';
/** ようこそ文を一度表示して閉じた印（全員に届ける） */
const STORAGE_WELCOME_DISMISSED = 'rk_welcome_dismissed_v1';

/** 自分の名前表示に付けるクラス（`globals.css` の `--rk-gate-nick-color` を参照） */
export const RK_GATE_NICK_DISPLAY_CLASS = 'rk-gate-nick';

export function gateNicknameCssColor(gate: RakudaGateId): string {
  switch (gate) {
    case 'blue':
      return 'rgb(7 89 133)';
    case 'brown':
      return 'rgb(120 53 15)';
    case 'green':
      return 'rgb(21 128 61)';
  }
}

export function applyGateNicknameCssColor(gate: RakudaGateId | null): void {
  if (typeof document === 'undefined') return;
  if (!gate) {
    document.documentElement.style.removeProperty('--rk-gate-nick-color');
    return;
  }
  document.documentElement.style.setProperty('--rk-gate-nick-color', gateNicknameCssColor(gate));
}

export function readRakudaGateChoice(): RakudaGateId | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_GATE);
    if (raw === 'brown') {
      writeRakudaGateChoice('blue');
      return 'blue';
    }
    if (raw === 'blue' || raw === 'green') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeRakudaGateChoice(gate: RakudaGateId): void {
  try {
    localStorage.setItem(STORAGE_GATE, gate);
  } catch {
    /* ignore */
  }
}

export function clearRakudaGateChoice(): void {
  try {
    localStorage.removeItem(STORAGE_GATE);
    /** 月額・配布コードの有効期限は消さない（見た目だけ青に戻しても広告なし期間は維持） */
  } catch {
    /* ignore */
  }
}

/** 暦の1か月後（例: 5/26 → 6/26） */
export function addCalendarMonth(from: Date): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

export function readGreenGateUntilMs(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_GREEN_UNTIL_MS);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function isServerGreenGateActive(serverGreenUntilMs: number | null | undefined, nowMs: number): boolean {
  return serverGreenUntilMs != null && Number.isFinite(serverGreenUntilMs) && nowMs < serverGreenUntilMs;
}

export function isGreenGateActive(nowMs = Date.now(), serverGreenUntilMs?: number | null): boolean {
  if (isServerGreenGateActive(serverGreenUntilMs, nowMs)) return true;
  const localUntil = readGreenGateUntilMs();
  return localUntil != null && nowMs < localUntil;
}

/** 在席 `renraku_presence` に載せる緑ゲート期限（他者の絵文字枠表示用） */
export function greenUntilMsForPresenceHeartbeat(
  serverGreenUntilMs?: number | null,
  nowMs = Date.now()
): number | null {
  if (isServerGreenGateActive(serverGreenUntilMs, nowMs)) return serverGreenUntilMs!;
  if (readRakudaGateChoice() !== 'green') return null;
  const until = readGreenGateUntilMs();
  return until != null && nowMs < until ? until : null;
}

/** Firestore の有効期限を端末のゲート選択に反映（Stripe 決済後） */
export function syncLocalGreenGateFromServer(serverGreenUntilMs: number | null | undefined, nowMs = Date.now()): void {
  if (!isServerGreenGateActive(serverGreenUntilMs, nowMs)) return;
  writeRakudaGateChoice('green');
  try {
    localStorage.setItem(STORAGE_GREEN_UNTIL_MS, String(serverGreenUntilMs));
  } catch {
    /* ignore */
  }
}

/** 緑ゲートのサブスク有効化（暦1か月） */
export function activateGreenGateSubscription(now = new Date()): number {
  const until = addCalendarMonths(now, GREEN_GATE_PERIOD_MONTHS);
  writeRakudaGateChoice('green');
  try {
    localStorage.setItem(STORAGE_GREEN_UNTIL_MS, String(until.getTime()));
  } catch {
    /* ignore */
  }
  return until.getTime();
}

/** 初回訪問：ゲート画面なしで青を記録（「ゲートを選び直す」時は未実行） */
export function applyFirstVisitDefaultBlueGate(): void {
  if (typeof localStorage === 'undefined') return;
  if (readRakudaGateChoice()) return;
  try {
    if (localStorage.getItem(STORAGE_GATE_DEFAULTED)) return;
    writeRakudaGateChoice('blue');
    localStorage.setItem(STORAGE_GATE_DEFAULTED, '1');
  } catch {
    /* ignore */
  }
}

export function hasWelcomeIntroBeenDismissed(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_WELCOME_DISMISSED) === '1';
  } catch {
    return true;
  }
}

/** 初回・未読：全員に一度はようこそ文を見せる（ゲート選択とは別） */
export function shouldShowWelcomeIntro(): boolean {
  return !hasWelcomeIntroBeenDismissed();
}

export function dismissWelcomeIntro(): void {
  try {
    localStorage.setItem(STORAGE_WELCOME_DISMISSED, '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowGateSelection(nowMs = Date.now(), serverGreenUntilMs?: number | null): boolean {
  if (isServerGreenGateActive(serverGreenUntilMs, nowMs)) return false;
  const gate = readRakudaGateChoice();
  if (!gate) return false;
  if (gate === 'green' && !isGreenGateActive(nowMs, serverGreenUntilMs)) return true;
  return false;
}

/** ようこそ（未読）のみ。応援の申込・期限切れは設定へ（C案） */
export function shouldShowGateOverlay(_nowMs = Date.now(), _serverGreenUntilMs?: number | null): boolean {
  return shouldShowWelcomeIntro();
}

/** 緑期限切れ時は blue に戻す（広告列が空になるのを防ぐ） */
export function ensureDefaultFreeGateWhenGreenExpired(
  serverGreenUntilMs?: number | null,
  nowMs = Date.now(),
): void {
  if (isGreenGateActive(nowMs, serverGreenUntilMs)) return;
  const gate = readRakudaGateChoice();
  if (gate === 'green') {
    writeRakudaGateChoice('blue');
  }
  if (!readRakudaGateChoice()) {
    applyFirstVisitDefaultBlueGate();
  }
}

/** 有効なゲート（緑期限切れは null 扱い） */
export function resolveActiveRakudaGate(nowMs = Date.now(), serverGreenUntilMs?: number | null): RakudaGateId | null {
  if (isServerGreenGateActive(serverGreenUntilMs, nowMs)) return 'green';
  const gate = readRakudaGateChoice();
  if (!gate) return null;
  if (gate === 'green' && !isGreenGateActive(nowMs, serverGreenUntilMs)) return null;
  return gate;
}

export function shouldSuppressAdsForGate(nowMs = Date.now(), serverGreenUntilMs?: number | null): boolean {
  return isGreenGateActive(nowMs, serverGreenUntilMs);
}

/** ゲートごとの広告種別（SDK 接続前のプレースホルダーでも同じ契約） */
export type GateAdKind = 'interstitial' | 'short_video';

export type GateAdSlot = {
  kind: GateAdKind;
  durationMinSec: number;
  durationMaxSec: number;
  labelJa: string;
};

const BLUE_INTERSTITIAL: GateAdSlot = {
  kind: 'interstitial',
  durationMinSec: 5,
  durationMaxSec: 15,
  labelJa: 'インタースティシャル広告',
};

const BROWN_SHORT_VIDEO: GateAdSlot = {
  kind: 'short_video',
  durationMinSec: 12,
  durationMaxSec: 20,
  labelJa: '短尺動画広告',
};

/** 自然な区切りで出す広告列（緑＝空） */
export function gateAdSequenceForGate(gate: RakudaGateId | null): readonly GateAdSlot[] {
  if (!gate || gate === 'green') return [];
  if (gate === 'blue' || gate === 'brown') return [BLUE_INTERSTITIAL];
  return [BROWN_SHORT_VIDEO, BROWN_SHORT_VIDEO];
}

/** 1本だけ出す場面（スライドパズル自動再生など） */
export function singleGateAdSlot(gate: RakudaGateId | null): GateAdSlot | null {
  const seq = gateAdSequenceForGate(gate);
  return seq[0] ?? null;
}

export function pickGateAdDurationSec(slot: GateAdSlot): number {
  const span = slot.durationMaxSec - slot.durationMinSec;
  return slot.durationMinSec + Math.floor(Math.random() * (span + 1));
}

/** 自然な区切りで出す全面広告の本数 */
export function interstitialCountForGate(gate: RakudaGateId | null): number {
  return gateAdSequenceForGate(gate).length;
}

export function gateLabelJa(gate: RakudaGateId): string {
  switch (gate) {
    case 'blue':
      return RAKUDA_DEFAULT_PLAY_LABEL;
    case 'brown':
      return RAKUDA_DEFAULT_PLAY_LABEL;
    case 'green':
      return RAKUDA_SUPPORT_GATE_LABEL;
  }
}
