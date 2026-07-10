import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { ScreenType } from '../types';
import { suppressesQuietImmersiveGlobalChrome } from './immersiveScreenPolicy';

export const RK_LIVE_BANNER_DOC_PATH = ['rk_site_public', 'live'] as const;

/** 全員向け・画面上部の3秒通知文言 */
export const RK_YOUTUBE_LIVE_BANNER_LABEL = 'YoutubeLIVE NOW ON AIR';

/** 管理者が NOW ON AIR を ON にしてから、遅れて開いた画面でも出す猶予 */
export const RK_LIVE_BANNER_PULSE_FRESH_MS = 8_000;

export const RK_LIVE_BANNER_DISPLAY_MS = 3_000;

const SEEN_PULSE_SESSION_KEY = 'rk_live_banner_seen_pulse_ms';

const MAJOR_LIVE_BANNER_SCREENS: ReadonlySet<ScreenType> = new Set([
  'seat-selection',
  'select',
  'game',
]);

export function shouldShowLiveBannerPulseScreen(screen: string, showRenrakucho: boolean): boolean {
  if (suppressesQuietImmersiveGlobalChrome(screen)) return false;
  if (MAJOR_LIVE_BANNER_SCREENS.has(screen as ScreenType)) return true;
  return showRenrakucho;
}

export function readLiveBannerSeenPulseMs(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SEEN_PULSE_SESSION_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markLiveBannerSeenPulseMs(pulseMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SEEN_PULSE_SESSION_KEY, String(pulseMs));
  } catch {
    /* ignore */
  }
}

export function firestoreLiveBannerPulseMs(data: Record<string, unknown> | undefined): number | null {
  const raw = data?.liveBannerPulseAtMs;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

/** 管理者: NOW ON AIR ON と同時に全員へ3秒バナーのきっかけを書く */
export async function publishYoutubeLiveBannerPulse(enabled: boolean): Promise<void> {
  const ref = doc(db, RK_LIVE_BANNER_DOC_PATH[0], RK_LIVE_BANNER_DOC_PATH[1]);
  if (enabled) {
    await setDoc(
      ref,
      {
        liveBadgeEnabled: true,
        liveBannerPulseAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }
  await setDoc(
    ref,
    {
      liveBadgeEnabled: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
