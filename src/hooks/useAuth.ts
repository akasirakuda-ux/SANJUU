
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import {
  RAKUDA_CANONICAL_ORIGIN,
  clearGoogleLoginPending,
  clearGoogleSessionUid,
  consumeGoogleRedirectResult,
  expectsGoogleSession,
  isGoogleLoginPending,
  isGoogleSignedInUser,
  markGoogleLoginPending,
  markGoogleSessionUid,
  pickEffectiveAuthUser,
  showAppToast,
  waitForAnyGoogleUser,
  waitForGoogleSessionRestore,
} from '../lib/rakudaHubShell';

export const useAuth = (language: string, setNotification: (msg: string | null) => void) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [googleUser, setGoogleUser] = useState<User | null>(() =>
    isGoogleSignedInUser(auth.currentUser) ? auth.currentUser : null
  );
  const [isAuthReady, setIsAuthReady] = useState(false);
  const lastSessionCookieUidRef = useRef<string | null>(null);
  const googleLoginInProgressRef = useRef(false);

  const effectiveFirebaseUser = useMemo(
    () => pickEffectiveAuthUser(firebaseUser, googleUser),
    [firebaseUser, googleUser]
  );

  const notifyUser = useCallback(
    (msg: string, ms = 5000) => {
      setNotification(msg);
      showAppToast(msg);
      if (ms > 3000) {
        window.setTimeout(() => setNotification(null), ms);
      }
    },
    [setNotification]
  );

  const syncSessionCookie = useCallback(async (user: User) => {
    try {
      const uid = String(user.uid ?? '').trim();
      if (!uid) return;
      if (lastSessionCookieUidRef.current === uid) return;
      const key = 'rk_session_cookie_uid_v1';
      const already = (() => {
        try {
          return window.localStorage.getItem(key) === uid;
        } catch {
          return false;
        }
      })();
      if (already) {
        lastSessionCookieUidRef.current = uid;
        return;
      }

      const idToken = await user.getIdToken();
      if (!idToken) return;
      const r = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!r.ok) return;
      try {
        window.localStorage.setItem(key, uid);
      } catch {
        // ignore
      }
      lastSessionCookieUidRef.current = uid;
    } catch {
      // ignore (fail-open)
    }
  }, []);

  const formatAuthError = useCallback(
    (error: { code?: string; message?: string }) => {
      const code = String(error?.code ?? 'unknown');
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        return language === 'ja'
          ? `このサイト（${host || 'unknown'}）は Firebase の許可ドメインに未登録です。Firebase コンソール → Authentication → Settings → Authorized domains に「${host}」を追加してください。`
          : `Domain not authorized in Firebase Auth (${host}).`;
      }
      if (code === 'auth/popup-blocked') {
        return language === 'ja'
          ? 'ポップアップがブロックされました。アドレスバー横の「ブロック」表示から rakuda.coffee のポップアップを許可して、もう一度「ログインしていません」を押してください。'
          : 'Popup blocked. Allow popups for this site and try again.';
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return language === 'ja' ? 'ログインがキャンセルされました。' : 'Sign-in cancelled.';
      }
      if (code === 'auth/network-request-failed') {
        return language === 'ja'
          ? 'ネットワークエラーです。通信を確認して再度お試しください。'
          : 'Network error. Please try again.';
      }
      if (code === 'auth/operation-not-allowed') {
        return language === 'ja'
          ? 'Google ログインが Firebase で無効です。Authentication → Sign-in method で Google を有効にしてください。'
          : 'Google sign-in is disabled in Firebase Console.';
      }
      return language === 'ja' ? `ログインに失敗しました（${code}）` : `Sign-in failed (${code})`;
    },
    [language]
  );

  const finishGoogleLoginInProgress = useCallback(() => {
    googleLoginInProgressRef.current = false;
  }, []);

  const applyAuthUser = useCallback((user: User | null) => {
    if (isGoogleSignedInUser(user)) {
      markGoogleSessionUid(user!.uid);
      setGoogleUser(user);
      setFirebaseUser(user);
      return;
    }
    if (!user) {
      clearGoogleSessionUid();
      setGoogleUser(null);
      setFirebaseUser(null);
      return;
    }
    setFirebaseUser(user);
  }, []);

  const ensureAuth = useCallback(async () => {
    if (googleLoginInProgressRef.current || isGoogleLoginPending()) return;
    try {
      await auth.authStateReady();
    } catch {
      /* ignore */
    }

    if (isGoogleSignedInUser(auth.currentUser)) return;
    if (auth.currentUser?.isAnonymous) return;

    if (expectsGoogleSession()) {
      const restored = await waitForGoogleSessionRestore(3000);
      if (restored) {
        applyAuthUser(restored);
        return;
      }
      return;
    }

    if (auth.currentUser) return;

    try {
      await signInAnonymously(auth);
    } catch (e: any) {
      if (e.code === 'auth/admin-restricted-operation') {
        console.warn(
          'Anonymous sign-in is disabled in Firebase Console. Please enable it under Authentication > Sign-in method.'
        );
      } else {
        console.error('Anonymous sign-in failed:', e);
      }
    }
  }, [applyAuthUser]);

  const startGoogleRedirect = useCallback(
    async (provider: GoogleAuthProvider) => {
      markGoogleLoginPending();
      googleLoginInProgressRef.current = true;
      await signInWithRedirect(auth, provider);
      notifyUser(language === 'ja' ? 'Google のログイン画面へ移動します…' : 'Redirecting to Google…');
    },
    [language, notifyUser]
  );

  /** 匿名セッションが Google ログインと競合しないよう、Google 前に匿名を外す */
  const prepareForGoogleSignIn = useCallback(async () => {
    try {
      await auth.authStateReady();
    } catch {
      /* ignore */
    }
    const cur = auth.currentUser;
    if (cur?.isAnonymous) {
      await signOut(auth);
      try {
        await auth.authStateReady();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const completeGooglePopupSignIn = useCallback(
    async (resultUser: User | null | undefined) => {
      clearGoogleLoginPending();
      try {
        await auth.authStateReady();
      } catch {
        /* ignore */
      }
      let signedIn: User | null = isGoogleSignedInUser(auth.currentUser)
        ? auth.currentUser
        : isGoogleSignedInUser(resultUser)
          ? resultUser!
          : null;
      if (!signedIn) {
        signedIn = await waitForAnyGoogleUser(4000);
      }
      if (signedIn) {
        applyAuthUser(signedIn);
        void syncSessionCookie(signedIn);
        finishGoogleLoginInProgress();
        notifyUser(language === 'ja' ? 'Google でログインしました' : 'Signed in with Google');
        return true;
      }
      finishGoogleLoginInProgress();
      notifyUser(
        language === 'ja'
          ? 'Google ログインを完了できませんでした。ページを開き直してからもう一度お試しください。'
          : 'Google sign-in did not complete. Please reload and try again.',
        12000,
      );
      return false;
    },
    [
      language,
      notifyUser,
      finishGoogleLoginInProgress,
      applyAuthUser,
      syncSessionCookie,
    ],
  );

  /**
   * クリック直後に signInWithPopup を開始する（await を挟むとポップアップがブロックされる）。
   * 呼び出し元はユーザーの onClick から同期的にこの関数を起動すること。
   */
  const runGoogleSignInViaPopup = useCallback(() => {
    if (googleLoginInProgressRef.current) {
      notifyUser(language === 'ja' ? 'ログイン処理中です…' : 'Sign-in in progress…');
      return;
    }
    googleLoginInProgressRef.current = true;
    clearGoogleLoginPending();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const popupTask = signInWithPopup(auth, provider);

    void (async () => {
      notifyUser(language === 'ja' ? 'Google の画面を開きます（ポップアップ）' : 'Opening Google sign-in…');
      try {
        const result = await popupTask;
        await completeGooglePopupSignIn(result.user);
      } catch (error: any) {
        console.error('Google popup login failed:', error);
        clearGoogleLoginPending();
        finishGoogleLoginInProgress();
        notifyUser(formatAuthError(error), 10000);
      }
    })();
  }, [
    language,
    notifyUser,
    completeGooglePopupSignIn,
    finishGoogleLoginInProgress,
    formatAuthError,
  ]);

  /** 既定: ポップアップ */
  const handleGoogleLogin = useCallback(() => {
    runGoogleSignInViaPopup();
  }, [runGoogleSignInViaPopup]);

  const handleGoogleLoginViaPopup = useCallback(() => {
    runGoogleSignInViaPopup();
  }, [runGoogleSignInViaPopup]);

  /** 設定の「ページ移動でログイン」専用（ポップアップが使えない環境向け） */
  const handleGoogleLoginViaRedirect = useCallback(async () => {
    if (googleLoginInProgressRef.current) {
      notifyUser(language === 'ja' ? 'ログイン処理中です…' : 'Sign-in in progress…');
      return;
    }
    googleLoginInProgressRef.current = true;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    notifyUser(
      language === 'ja'
        ? 'Google ログインを開始します。アカウントを選んでください。'
        : 'Starting Google sign-in…',
    );
    try {
      await prepareForGoogleSignIn();
      await startGoogleRedirect(provider);
    } catch (error: any) {
      console.error('Google redirect login failed:', error);
      clearGoogleLoginPending();
      finishGoogleLoginInProgress();
      notifyUser(formatAuthError(error), 8000);
    }
  }, [
    language,
    notifyUser,
    prepareForGoogleSignIn,
    startGoogleRedirect,
    finishGoogleLoginInProgress,
    formatAuthError,
  ]);

  const clearServerSessionCookie = useCallback(async () => {
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.removeItem('rk_session_cookie_uid_v1');
    } catch {
      /* ignore */
    }
    lastSessionCookieUidRef.current = null;
  }, []);

  const handleGoogleLogout = useCallback(async () => {
    const current = pickEffectiveAuthUser(firebaseUser, googleUser) ?? auth.currentUser;
    if (!isGoogleSignedInUser(current)) {
      notifyUser(language === 'ja' ? 'Google ログインしていません' : 'Not signed in with Google');
      return;
    }

    try {
      clearGoogleSessionUid();
      clearGoogleLoginPending();
      await signOut(auth);
      setGoogleUser(null);
      setFirebaseUser(null);
      await clearServerSessionCookie();
      notifyUser(language === 'ja' ? 'ログアウトしました' : 'Signed out');
    } catch (error: any) {
      console.error('Google logout failed:', error);
      notifyUser(formatAuthError(error), 7000);
      return;
    }

    await ensureAuth();
  }, [
    firebaseUser,
    googleUser,
    language,
    notifyUser,
    formatAuthError,
    clearServerSessionCookie,
    ensureAuth,
  ]);

  useEffect(() => {
    let cancelled = false;

    const handleRedirectReturn = async () => {
      const hadPending = isGoogleLoginPending();
      try {
        const result = await consumeGoogleRedirectResult();
        if (cancelled) return;
        try {
          await auth.authStateReady();
        } catch {
          /* ignore */
        }
        if (cancelled) return;

        let user: User | null = result?.user ?? auth.currentUser;
        if (!isGoogleSignedInUser(user) && hadPending) {
          user = await waitForAnyGoogleUser(14_000);
        }
        if (cancelled) return;

        if (isGoogleSignedInUser(user)) {
          applyAuthUser(user);
          clearGoogleLoginPending();
          finishGoogleLoginInProgress();
          notifyUser(language === 'ja' ? 'Google でログインしました' : 'Signed in with Google');
          return;
        }

        if (hadPending) {
          const restored = await waitForGoogleSessionRestore(8000);
          if (cancelled) return;
          if (restored) {
            applyAuthUser(restored);
            clearGoogleLoginPending();
            finishGoogleLoginInProgress();
            notifyUser(language === 'ja' ? 'Google でログインしました' : 'Signed in with Google');
            return;
          }
          clearGoogleLoginPending();
          finishGoogleLoginInProgress();
          notifyUser(
            language === 'ja'
              ? 'ページ移動でのログインを完了できませんでした。右上の「ログインしていません」からポップアップでログインを試してください（Chrome 推奨）。'
              : 'Redirect sign-in did not complete. Try popup sign-in from the top bar.',
            12000,
          );
        }
      } catch (error: any) {
        clearGoogleLoginPending();
        finishGoogleLoginInProgress();
        console.error('Redirect result error:', error);
        if (error?.code !== 'auth/cancelled-popup-request') {
          notifyUser(formatAuthError(error), 7000);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
      void (async () => {
        if (cancelled) return;
        try {
          await auth.authStateReady();
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        const cur = auth.currentUser;
        if (isGoogleSignedInUser(cur)) {
          applyAuthUser(cur);
          void syncSessionCookie(cur!);
          clearGoogleLoginPending();
          finishGoogleLoginInProgress();
          return;
        }
        if (isGoogleSignedInUser(user)) {
          applyAuthUser(user);
          void syncSessionCookie(user!);
          clearGoogleLoginPending();
          finishGoogleLoginInProgress();
          return;
        }
        handleNonGoogleAuthUser(user);
      })();
    });

    const handleNonGoogleAuthUser = (user: User | null) => {
      if (isGoogleLoginPending() || googleLoginInProgressRef.current) {
        return;
      }
      if (!user) {
        // Firebase が一瞬だけ null を通知することがあり、その場で消すと Google セッション記録まで失って
        // 「未ログイン」表示が固定される。authStateReady 後の currentUser を見てから掃除する。
        void (async () => {
          if (cancelled) return;
          try {
            await auth.authStateReady();
          } catch {
            /* ignore */
          }
          await Promise.resolve();
          if (cancelled) return;
          const cur = auth.currentUser;
          if (cur) {
            if (isGoogleSignedInUser(cur)) {
              applyAuthUser(cur);
              void syncSessionCookie(cur);
              clearGoogleLoginPending();
              finishGoogleLoginInProgress();
            } else if (cur.isAnonymous && expectsGoogleSession()) {
              void (async () => {
                const restored = await waitForGoogleSessionRestore(8000);
                if (cancelled) return;
                if (restored) {
                  applyAuthUser(restored);
                  void syncSessionCookie(restored);
                  return;
                }
                console.warn('[auth] Google session expected but anonymous user active');
                if (!cancelled) {
                  setGoogleUser(null);
                  setFirebaseUser(cur);
                }
              })();
            } else {
              setGoogleUser(null);
              setFirebaseUser(cur);
            }
            return;
          }
          clearGoogleSessionUid();
          setGoogleUser(null);
          setFirebaseUser(null);
          try {
            window.localStorage.removeItem('rk_session_cookie_uid_v1');
          } catch {
            /* ignore */
          }
        })();
        return;
      }
      if (user.isAnonymous && expectsGoogleSession()) {
        void (async () => {
          const restored = await waitForGoogleSessionRestore(8000);
          if (cancelled) return;
          if (restored) {
            applyAuthUser(restored);
            void syncSessionCookie(restored);
            return;
          }
          console.warn('[auth] Google session expected but anonymous user active');
          setFirebaseUser(user);
        })();
        return;
      }
      setFirebaseUser(user);
    };

    void (async () => {
      await handleRedirectReturn();
      if (cancelled) return;
      try {
        await auth.authStateReady();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      if (isGoogleSignedInUser(auth.currentUser)) {
        applyAuthUser(auth.currentUser);
        return;
      }
      if (!isGoogleLoginPending() && !auth.currentUser && !expectsGoogleSession()) {
        await ensureAuth();
      } else if (expectsGoogleSession()) {
        const restored = await waitForGoogleSessionRestore(10_000);
        if (!cancelled && restored) applyAuthUser(restored);
      }
    })();

    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'system', 'connection_test'));
      } catch (error: any) {
        if (error.code !== 'permission-denied') {
          console.warn('Firebase connection failed:', error.message);
        }
      }
    };
    void testConnection();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    language,
    syncSessionCookie,
    notifyUser,
    formatAuthError,
    ensureAuth,
    finishGoogleLoginInProgress,
    applyAuthUser,
  ]);

  return {
    firebaseUser,
    googleUser,
    effectiveFirebaseUser,
    isAuthReady,
    ensureAuth,
    handleGoogleLogin,
    handleGoogleLoginViaPopup,
    handleGoogleLoginViaRedirect,
    handleGoogleLogout,
  };
};
