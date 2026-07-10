import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth';
import { type Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';

/**
 * 公開クライアント用（apiKey 等はブラウザに出る前提）。本番は環境変数、無ければらくだ本番プロジェクト既定。
 */
function firebaseOptions(): FirebaseOptions {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (apiKey) {
    return {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || 'rakuda-coffee.firebaseapp.com',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'rakuda-coffee',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim(),
    };
  }
  return {
    apiKey: 'AIzaSyA9ItHfLgUmoNaF7LpzWfk5KVmSe2wbr1Q',
    authDomain: 'rakuda-coffee.firebaseapp.com',
    projectId: 'rakuda-coffee',
    storageBucket: 'rakuda-coffee.firebasestorage.app',
    messagingSenderId: '941052820154',
    appId: '1:941052820154:web:7c4568b58239005bc1a083',
    measurementId: 'G-QQE6PP8MF3',
  };
}

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

/** Firebase Console の OAuth 許可ドメインに載せているホストだけ Auth（popup/redirect）を使う */
const SANJUU_FIREBASE_OAUTH_HOSTS = new Set([
  'rakuda.coffee',
  'www.rakuda.coffee',
  'rakuda-coffee.web.app',
  'rakuda-coffee.firebaseapp.com',
  'localhost',
  '127.0.0.1',
]);

export function isSanjuuFirebaseOAuthHost(): boolean {
  if (typeof window === 'undefined') return false;
  return SANJUU_FIREBASE_OAUTH_HOSTS.has(window.location.hostname);
}

function ensureSanjuuApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseOptions());
  return _app;
}

export function getSanjuuAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(ensureSanjuuApp());
  void setPersistence(_auth, browserLocalPersistence).catch(() => {
    /* ignore */
  });
  return _auth;
}

export function getSanjuuFirestore(): Firestore {
  if (_db) return _db;
  const app = ensureSanjuuApp();
  try {
    _db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 30 },
    });
  } catch {
    _db = getFirestore(app);
  }
  return _db;
}
