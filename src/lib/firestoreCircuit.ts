import type { Firestore } from 'firebase/firestore';
import { disableNetwork, enableNetwork } from 'firebase/firestore';

type TripReason = 'resource-exhausted' | 'unknown';

let trippedUntilMs = 0;
let enableTimer: number | null = null;
let networkDisabledByCircuit = false;

function getCode(err: unknown): string | null {
  const anyErr = err as any;
  const code = typeof anyErr?.code === 'string' ? anyErr.code : null;
  return code;
}

export function tripFirestoreCircuit(db: Firestore, err: unknown, opts?: { cooldownMs?: number }) {
  const code = getCode(err);
  const reason: TripReason = code === 'resource-exhausted' ? 'resource-exhausted' : 'unknown';
  if (reason !== 'resource-exhausted') return false;

  // Keep cooldown short: we want to stop the retry storm,
  // but recover quickly so lobby chat doesn't feel "dead".
  const cooldownMs = Math.max(5_000, Math.min(60_000, opts?.cooldownMs ?? 10_000));
  const now = Date.now();
  const nextUntil = now + cooldownMs;
  if (nextUntil <= trippedUntilMs) return true;
  trippedUntilMs = nextUntil;

  if (!networkDisabledByCircuit) {
    networkDisabledByCircuit = true;
    try {
      void disableNetwork(db);
    } catch {
      networkDisabledByCircuit = false;
    }
  }

  if (enableTimer != null) {
    try {
      window.clearTimeout(enableTimer);
    } catch {
      // ignore
    }
    enableTimer = null;
  }
  enableTimer = window.setTimeout(() => {
    enableTimer = null;
    if (Date.now() < trippedUntilMs) return;
    if (!networkDisabledByCircuit) return;
    networkDisabledByCircuit = false;
    try {
      void enableNetwork(db);
    } catch {
      // ignore
    }
  }, cooldownMs);

  return true;
}

