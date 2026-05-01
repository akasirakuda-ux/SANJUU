
import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export const useAuth = (language: string, setNotification: (msg: string | null) => void) => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const shouldForceRedirectLogin = useCallback((): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      // Popup auth often fails in embedded webviews / iframes due to COOP/COEP restrictions.
      if (window.self !== window.top) return true;
      const ua = String(window.navigator?.userAgent ?? '');
      // Cursor/Electron webviews tend to auto-close auth popups.
      if (/Cursor|CursorBrowser|Electron/i.test(ua)) return true;
      return false;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });

    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'system', 'connection_test'));
        console.log("Firebase connection successful.");
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.log("Firebase connection successful (Permission Denied is expected for root).");
        } else {
          console.warn("Firebase connection failed:", error.message);
        }
      }
    };
    testConnection();

    // Handle redirect result
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setNotification(language === 'ja' ? 'オンラインになりました' : 'Online now');
      }
    }).catch((error) => {
      console.error("Redirect result error:", error);
      if (error.code !== 'auth/cancelled-popup-request') {
        const errorMsg = language === 'ja' ? `接続に失敗しました (${error.code})` : `Connection failed (${error.code})`;
        setNotification(errorMsg);
      }
    });

    return () => unsubscribe();
  }, [language, setNotification]);

  const ensureAuth = useCallback(async () => {
    if (!auth.currentUser) {
      try {
        console.log("TRY SIGNIN");
        await signInAnonymously(auth);
      } catch (e: any) {
        console.log("SIGNIN ERROR", e);
        if (e.code === 'auth/admin-restricted-operation') {
          console.warn("Anonymous sign-in is disabled in Firebase Console. Please enable it under Authentication > Sign-in method.");
        } else {
          console.error("Anonymous sign-in failed:", e);
        }
      }
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    const provider = new GoogleAuthProvider();

    // In embedded environments, start with redirect (popup often closes instantly).
    if (shouldForceRedirectLogin()) {
      try {
        // If we're anonymous, linking commonly fails (credential-already-in-use).
        // Sign out first and do a normal Google sign-in via redirect.
        if (auth.currentUser?.isAnonymous) {
          await signOut(auth);
        }
        await signInWithRedirect(auth, provider);
        setNotification(language === 'ja' ? 'ログイン画面へ移動します' : 'Redirecting to login');
        return;
      } catch (e) {
        console.error('Google login redirect start failed:', e);
        // fall through to popup attempt
      }
    }

    try {
      // If the user is currently anonymous, "upgrade" the same uid to Google
      // so blocks/admin checks don't get bypassed by uid rotation.
      if (auth.currentUser?.isAnonymous) {
        await linkWithPopup(auth.currentUser, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      setNotification(language === 'ja' ? 'オンラインになりました' : 'Online now');
    } catch (error: any) {
      console.error("Google login with popup failed:", error);
      
      // If the Google account is already linked to a different Firebase user,
      // linking from an anonymous session fails. Fall back to a normal Google sign-in.
      if (error?.code === 'auth/credential-already-in-use') {
        try {
          await signOut(auth);
          // Prefer redirect here because popup is commonly blocked in embedded browsers.
          await signInWithRedirect(auth, provider);
          setNotification(language === 'ja' ? 'ログイン画面へ移動します' : 'Redirecting to login');
          return;
        } catch (e2: any) {
          console.error('Google login fallback after signOut failed:', e2);
          // If popup is blocked, force redirect as the last resort.
          if (e2?.code === 'auth/popup-blocked') {
            try {
              await signInWithRedirect(auth, provider);
              setNotification(language === 'ja' ? 'ログイン画面へ移動します' : 'Redirecting to login');
              return;
            } catch (e3) {
              console.error('Google login forced redirect failed:', e3);
            }
          }
          // continue to generic handler below
        }
      }

      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        try {
          if (auth.currentUser?.isAnonymous) {
            await linkWithRedirect(auth.currentUser, provider);
          } else {
            await signInWithRedirect(auth, provider);
          }
        } catch (redirectError) {
          console.error("Google login with redirect failed:", redirectError);
          setNotification(language === 'ja' ? '接続に失敗しました（リダイレクト失敗）' : 'Connection failed (redirect failed)');
        }
      } else {
        let msg = language === 'ja' ? `接続に失敗しました (${error.code})` : `Connection failed (${error.code})`;
        if (error.code === 'auth/unauthorized-domain') {
          const host =
            typeof window !== 'undefined' ? window.location.hostname : '';
          msg =
            language === 'ja'
              ? `このドメイン（${host || 'unknown'}）は Firebase Auth に許可されていません。\nFirebase コンソール > Authentication > Settings > Authorized domains に「${host || 'rakuda.coffee'}」を追加してください。`
              : `This domain (${host || 'unknown'}) is not authorized in Firebase Auth. Add it in Firebase Console > Authentication > Settings > Authorized domains.`;
        }
        setNotification(msg);
      }
    }
  }, [language, setNotification, shouldForceRedirectLogin]);

  return {
    firebaseUser,
    isAuthReady,
    ensureAuth,
    handleGoogleLogin
  };
};
