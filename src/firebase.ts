import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Initialize Firebase SDK
import firebaseConfig from '../firebase-applet-config.json';

/** auth/configuration-not-found の多くは、Console の Auth 未設定・別プロジェクトの config・削除済みプロジェクトで発生する */
const cfg = firebaseConfig as Record<string, string | undefined>;
const missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter((k) => !cfg[k]?.trim());
if (missing.length > 0) {
  console.error(
    `[Firebase] firebase-applet-config.json に必須キーがありません: ${missing.join(', ')}。Firebase Console の「プロジェクトの設定」→「マイアプリ」の Web 設定と一致させてください。`
  );
}

const app = initializeApp(firebaseConfig);
/**
 * Firestore transport can be flaky depending on environment (proxy/AV/VPN/embedded frame).
 * Force long-polling + disable fetch streams to avoid 400 (Bad Request) on channel endpoints.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);

/** 実行時にどの JSON が読み込まれたか確認用（apiKey は出さない） */
if (import.meta.env.DEV) {
  console.info('[Firebase] firebase-applet-config.json 読み込み済み', {
    projectId: cfg.projectId,
    authDomain: cfg.authDomain,
    appId: cfg.appId,
    firestoreDatabase: '(default)',
  });
} else {
  console.info('[Firebase] 初期化', cfg.projectId);
}

// DevTools から現在ログイン状態を確認できるようにする（本番では露出しない）
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__rk_auth = auth;
  (window as any).__rk_db = db;
  // 全角/半角の入力ミスを避けるための短い別名
  (window as any).rkAuth = auth;
  (window as any).rkDb = db;
}

// Ensure persistence is set to local to maintain session in iframes
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

// NOTE: Do not "probe" Firestore on boot.
// It adds an extra read for every visitor and can worsen quota spikes (429).

export default app;
