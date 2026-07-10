'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { getSanjuuAuth, isSanjuuFirebaseOAuthHost } from '../lib/sanjuuFirebase';
import { getAuthLoginDisplay } from '../lib/rakudaRenrakuAdminClient';
import { readRakudaQueryProfile } from '../lib/rakudaQueryProfile';
import styles from './RakudaHubStatusBadge.module.css';

function presenceTitleLine(emojiRaw: string, nicknameRaw: string): string {
  const emoji = (emojiRaw ?? '').trim();
  const nick = (nicknameRaw ?? '').trim();
  if (emoji && nick) return `${emoji}・${nick}`;
  if (emoji) return emoji;
  if (nick) return nick;
  return '（未設定）';
}

function toneClass(tone: string): string {
  if (tone === 'google') return styles.toneGoogle;
  if (tone === 'guest') return styles.toneGuest;
  if (tone === 'loading') return styles.toneLoading;
  return styles.toneNone;
}

/**
 * らくだ本体 `AppHeader` と同等の右上ステータス（ログイン種別・回線・表示名）
 */
export default function RakudaHubStatusBadge() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const online = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener('online', onStoreChange);
      window.addEventListener('offline', onStoreChange);
      return () => {
        window.removeEventListener('online', onStoreChange);
        window.removeEventListener('offline', onStoreChange);
      };
    },
    () => typeof navigator !== 'undefined' && navigator.onLine,
    () => true
  );
  const [profileLine, setProfileLine] = useState('（未設定）');

  const loadProfile = useCallback(async (firebaseUser: User | null) => {
    const { urlEmoji, urlNick } = readRakudaQueryProfile();
    try {
      const headers: Record<string, string> = { accept: 'application/json' };
      if (firebaseUser) {
        try {
          const t = await firebaseUser.getIdToken();
          headers.authorization = `Bearer ${t}`;
        } catch {
          /* ignore */
        }
      }
      const r = await fetch('/api/rakuda-profile', { cache: 'no-store', headers });
      const j: unknown = await r.json();
      const prof =
        typeof j === 'object' && j && typeof (j as { profile?: unknown }).profile === 'object'
          ? (j as { profile: { emoji?: unknown; nickname?: unknown } }).profile
          : null;
      const apiEmoji = prof && typeof prof.emoji === 'string' ? prof.emoji.trim() : '';
      const apiNick = prof && typeof prof.nickname === 'string' ? prof.nickname.trim() : '';
      setProfileLine(presenceTitleLine(urlEmoji || apiEmoji, urlNick || apiNick));
    } catch {
      setProfileLine(presenceTitleLine(urlEmoji, urlNick));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isSanjuuFirebaseOAuthHost()) {
      setReady(true);
      void loadProfile(null);
      return;
    }
    const auth = getSanjuuAuth();
    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        await getRedirectResult(auth);
      } catch (e) {
        console.warn('[RakudaHubStatusBadge] getRedirectResult', e);
      }
      try {
        await auth.authStateReady();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setReady(true);
      void loadProfile(auth.currentUser);
      unsub = onAuthStateChanged(auth, (u) => {
        if (!u) {
          void (async () => {
            try {
              await auth.authStateReady();
            } catch {
              /* ignore */
            }
            await Promise.resolve();
            if (cancelled) return;
            const cur = auth.currentUser;
            if (cur) {
              setUser(cur);
              void loadProfile(cur);
              return;
            }
            setUser(null);
            void loadProfile(null);
          })();
          return;
        }
        if (cancelled) return;
        setUser(u);
        void loadProfile(u);
      });
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [loadProfile]);

  const handleGoogleRedirect = useCallback(() => {
    const auth = getSanjuuAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    void signInWithRedirect(auth, provider);
  }, []);

  const handleGooglePopup = useCallback(() => {
    const auth = getSanjuuAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    void (async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        console.warn('[RakudaHubStatusBadge] signInWithPopup', e);
      }
    })();
  }, []);

  const authDisp = getAuthLoginDisplay(user, ready);
  const lineNetwork = online ? 'オンライン' : 'オフライン';
  const oauthHost = isSanjuuFirebaseOAuthHost();
  const showLoginAction =
    oauthHost && ready && authDisp.tone !== 'google' && authDisp.tone !== 'loading';
  const aria = `${authDisp.label} ${lineNetwork} ${profileLine}`;

  return (
    <aside className={styles.wrap} aria-label={aria}>
      {showLoginAction ? (
        <div className={styles.loginActions}>
          <button
            type="button"
            className={`${styles.loginBtn} ${toneClass(authDisp.tone)}`}
            onClick={handleGoogleRedirect}
            title="Google でログイン（リダイレクト）"
          >
            {authDisp.label}（ログイン）
          </button>
          <button
            type="button"
            className={styles.popupHint}
            onClick={handleGooglePopup}
            title="リダイレクトがうまくいかないとき用。ポップアップをブロックしないでください。"
          >
            ポップアップでログイン
          </button>
        </div>
      ) : (
        <div className={`${toneClass(authDisp.tone)}`} title={authDisp.title}>
          {authDisp.label}
        </div>
      )}
      <div className={`${styles.lineNet} ${online ? styles.online : styles.offline}`}>
        {lineNetwork}
      </div>
      <div className={styles.profile} title={profileLine}>
        {profileLine}
      </div>
    </aside>
  );
}
