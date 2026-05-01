import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { firestoreLikeToMillis } from '../lib/firestoreTime';

function warnPresenceFirestore(label: string, e: unknown) {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code?: string }).code) : '';
  console.warn(`[usePresence] ${label}${code ? ` (${code})` : ''}`, e);
}

export const usePresence = (isAuthReady: boolean, nickname: string, enabled: boolean = true) => {
  const [viewerCount, setViewerCount] = useState<number | undefined>(undefined);
  const presenceIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setViewerCount(undefined);
      return;
    }
    if (!isAuthReady) return;

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const viewerRef = doc(db, 'system', 'viewers', 'active', currentUid);
    
    const updatePresence = async () => {
      try {
        await setDoc(viewerRef, {
          lastActive: serverTimestamp(),
          nickname: nickname || 'ななし'
        }, { merge: true });
      } catch (e) {
        warnPresenceFirestore('setDoc viewers/active', e);
      }
    };

    updatePresence();
    if (presenceIntervalRef.current !== null) {
      clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = null;
    }
    presenceIntervalRef.current = window.setInterval(updatePresence, 60000);

    const viewersCollection = collection(db, 'system', 'viewers', 'active');
    const unsubscribe = onSnapshot(
      viewersCollection,
      (snapshot) => {
        const now = Date.now();
        const activeViewers = snapshot.docs.filter((d) => {
          const data = d.data();
          const lastActive = firestoreLikeToMillis(data.lastActive) ?? now;
          return now - lastActive < 180000;
        });
        setViewerCount(Math.max(1, activeViewers.length));
      },
      (err) => {
        warnPresenceFirestore('onSnapshot system/viewers/active', err);
      }
    );

    const handleUnload = () => {
      deleteDoc(viewerRef).catch((e) => warnPresenceFirestore('deleteDoc viewers/active', e));
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (presenceIntervalRef.current !== null) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [enabled, isAuthReady, nickname]);

  return { viewerCount };
};
