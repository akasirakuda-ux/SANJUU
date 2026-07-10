import { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { firestoreLikeToMillis } from '../lib/rakudaHubShell';
import { resolveSiteViewerPresenceId } from '../lib/siteViewerSession';

const ACTIVE_VIEWER_MS = 300_000;
const HEARTBEAT_MS = 30_000;

function warnPresenceFirestore(label: string, e: unknown) {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code?: string }).code) : '';
  console.warn(`[usePresence] ${label}${code ? ` (${code})` : ''}`, e);
}

function normalizePresenceEmoji(raw: unknown): string {
  const emoji = String(raw ?? '').trim();
  return emoji || '👤';
}

function normalizePresenceNickname(raw: unknown): string {
  const name = String(raw ?? '').trim();
  return name || 'ななし';
}

export type HubPresencePeer = {
  uid: string;
  emoji: string;
  nickname: string;
};

function resolveLastActiveMs(data: Record<string, unknown>, now: number): number {
  const clientMs = data.lastActiveMs;
  if (typeof clientMs === 'number' && Number.isFinite(clientMs)) return clientMs;
  return firestoreLikeToMillis(data.lastActive) ?? now;
}

export const usePresence = (
  nickname: string,
  userEmoji: string,
  enabled: boolean = true,
) => {
  const [viewerCount, setViewerCount] = useState<number | undefined>(undefined);
  const [hubPresencePeers, setHubPresencePeers] = useState<HubPresencePeer[]>([]);
  const presenceIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setViewerCount(undefined);
      setHubPresencePeers([]);
      return;
    }

    const presenceId = resolveSiteViewerPresenceId();
    const selfEmoji = normalizePresenceEmoji(userEmoji);

    const applyActiveViewers = (snapshot: import('firebase/firestore').QuerySnapshot) => {
      const now = Date.now();
      const activeViewers = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const lastActive = resolveLastActiveMs(data, now);
          if (now - lastActive >= ACTIVE_VIEWER_MS) return null;
          return {
            uid: d.id,
            emoji: normalizePresenceEmoji(data.emoji),
            nickname: normalizePresenceNickname(data.nickname),
            lastActive,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.lastActive - b.lastActive);

      const peers: HubPresencePeer[] = activeViewers.map((v) => ({
        uid: v.uid,
        emoji: v.emoji,
        nickname: v.nickname,
      }));
      const headcount = activeViewers.length;

      setViewerCount(headcount);
      setHubPresencePeers(peers);
    };

    setViewerCount(0);
    setHubPresencePeers([]);

    const viewersCollection = collection(db, 'system', 'viewers', 'active');
    const unsubscribe = onSnapshot(
      viewersCollection,
      applyActiveViewers,
      (err) => {
        warnPresenceFirestore('onSnapshot system/viewers/active', err);
        setViewerCount(0);
        setHubPresencePeers([]);
      },
    );

    const viewerRef = doc(db, 'system', 'viewers', 'active', presenceId);

    const updatePresence = async () => {
      const now = Date.now();
      try {
        await setDoc(
          viewerRef,
          {
            lastActive: serverTimestamp(),
            lastActiveMs: now,
            nickname: nickname || 'ななし',
            emoji: selfEmoji,
          },
          { merge: true },
        );
      } catch (e) {
        warnPresenceFirestore('setDoc viewers/active', e);
      }
    };

    const handleUnload = () => {
      deleteDoc(viewerRef).catch((e) => warnPresenceFirestore('deleteDoc viewers/active', e));
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void updatePresence();
    };

    void updatePresence();
    if (presenceIntervalRef.current !== null) {
      clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = null;
    }
    presenceIntervalRef.current = window.setInterval(() => {
      void updatePresence();
    }, HEARTBEAT_MS);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (presenceIntervalRef.current !== null) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
      unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, nickname, userEmoji]);

  return { viewerCount, hubPresencePeers };
};
