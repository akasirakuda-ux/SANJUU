import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export type GreenGateFirestoreRecord = {
  greenUntilMs: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string | null;
};

const EMPTY: GreenGateFirestoreRecord = {
  greenUntilMs: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  status: null,
};

/** Stripe Webhook が書き込む `rk_green_gate/{uid}` を購読 */
export function useGreenGateFirestore(uid: string | null | undefined): GreenGateFirestoreRecord {
  const [record, setRecord] = useState<GreenGateFirestoreRecord>(EMPTY);

  useEffect(() => {
    if (!uid) {
      setRecord(EMPTY);
      return;
    }
    const ref = doc(db, 'rk_green_gate', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRecord(EMPTY);
          return;
        }
        const data = snap.data();
        const greenUntilMs =
          typeof data?.greenUntilMs === 'number' && Number.isFinite(data.greenUntilMs)
            ? data.greenUntilMs
            : null;
        const stripeCustomerId = String(data?.stripeCustomerId ?? '').trim() || null;
        const stripeSubscriptionId = String(data?.stripeSubscriptionId ?? '').trim() || null;
        const status = String(data?.status ?? '').trim() || null;
        setRecord({ greenUntilMs, stripeCustomerId, stripeSubscriptionId, status });
      },
      () => setRecord(EMPTY),
    );
  }, [uid]);

  return record;
}
