import Link from 'next/link';
import styles from './page.module.css';

async function createRoom(password: string, roomName?: string) {
  const base =
    process.env.NEXT_PUBLIC_HTTP_URL ??
    process.env.NEXT_PUBLIC_WS_HTTP ??
    'http://127.0.0.1:8080';
  const res = await fetch(`${base}/api/room`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password, roomName }),
    cache: 'no-store',
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const code = (() => {
      if (typeof json !== 'object' || !json) return undefined;
      const err = (json as Record<string, unknown>).error;
      if (typeof err !== 'object' || !err) return undefined;
      const c = (err as Record<string, unknown>).code;
      return typeof c === 'string' ? c : undefined;
    })();
    throw new Error(code ?? 'create_failed');
  }
  return json as { roomId: string; joinUrlPath: string };
}

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>30SANJUU</h1>
          <p className={styles.sub}>
            全員が同じ画面の数字（1〜30）を順番に問わず押していくだけの集団用ミニゲームです。名前入力・チャットはありません。
          </p>
        </header>

        <section className={`${styles.card} ${styles.tryFirst}`}>
          <h2 className={styles.h2}>いま試すならこれだけ</h2>
          <p className={styles.lead}>
            準備やパスワードは不要です。押すと、そのままお試し用の教室が開きます。
          </p>
          <Link className={styles.bigStart} href="/r/demo">
            お試し教室に入る
          </Link>
          <p className={styles.afterStart}>
            30個の四角が並んだら成功です。気になる番号をタップまたはクリックしてください。
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>新しい教室を作る（先生・司会向け）</h2>
          <p className={styles.small}>実際の授業や会で配る用です。参加者には後から表示されるページの URL を共有します。</p>
          <form
            action={async (formData) => {
              'use server';
              const password = String(formData.get('password') ?? '');
              const roomName = String(formData.get('roomName') ?? '').trim() || undefined;
              const out = await createRoom(password, roomName);
              const { redirect } = await import('next/navigation');
              redirect(out.joinUrlPath);
            }}
            className={styles.form}
          >
            <label className={styles.label}>
              合言葉メモ（先生用だけ。参加者は別 URL からそのまま入れます）。1文字以上で作成できます。
              <input name="password" type="password" required minLength={1} maxLength={64} placeholder="例: クラス名や日付" />
            </label>
            <label className={styles.label}>
              教室名（任意）
              <input name="roomName" type="text" maxLength={32} placeholder="省略してもかまいません" />
            </label>
            <button className={styles.primary} type="submit">
              作成して参加者用のページへ行く
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>ほかの画面</h2>
          <ul className={styles.links}>
            <li>
              <Link href="/play">ひらがな900マスの版へ行く（別ルール）</Link>
            </li>
            <li>
              <Link href="/notes">募集リスト（連絡帳）</Link>
            </li>
            <li>
              <Link href="/world">サーバー状況（ダッシュボード）</Link>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
