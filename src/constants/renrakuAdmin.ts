/**
 * 連絡帳「管理者」として扱う Firebase Auth の UID（任意・複数可）。
 * ID トークンに `email` が載らない場合に使う。`firestore.rules` の `isRenrakuAdminUid()` と **同一 UID 文字列** を並べる（ルールは TS を import できない）。
 *
 * 追加入手順: App 上部の赤バーで「現在のUID」を確認し、ここに文字列を 1 行追加する。
 * 続けて `firestore.rules` の `isRenrakuAdminUid()` に `|| request.auth.uid == 'そのUID'` を足し、`firebase deploy --only firestore:rules` する。
 */
export const ADMIN_UIDS: readonly string[] = ['6YGjqqBB0RejB5N01WUYupEogh53'];

/** メールでも管理者（`firestore.rules` の `normalizedRenrakuAdminEmail` と同じ正規化後に比較） */
export const RENRAKU_ADMIN_EMAIL_FALLBACK = 'akasirakuda@gmail.com';
