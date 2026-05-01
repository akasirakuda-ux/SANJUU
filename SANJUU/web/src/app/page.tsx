import Link from 'next/link';
import styles from './page.module.css';

async function createRoom(password: string, roomName?: string) {
  const base = process.env.NEXT_PUBLIC_WS_HTTP ?? 'http://localhost:8080';
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
        <h1 className={styles.title}>30SANJUU</h1>
        <p className={styles.sub}>30人で押すだけ。名前入力なし。チャットなし。</p>

        <section className={styles.card}>
          <h2>ルームを作る（ホスト）</h2>
          <form
            action={async (formData) => {
              'use server';
              const password = String(formData.get('password') ?? '');
              const roomName = String(formData.get('roomName') ?? '').trim() || undefined;
              const out = await createRoom(password, roomName);
              // redirect server action
              const { redirect } = await import('next/navigation');
              redirect(out.joinUrlPath);
            }}
            className={styles.form}
          >
            <label className={styles.label}>
              パスワード（必須）
              <input name="password" type="password" required minLength={1} maxLength={64} />
            </label>
            <label className={styles.label}>
              ルーム名（任意 / NGワード検知）
              <input name="roomName" type="text" maxLength={32} />
            </label>
            <button className={styles.primary} type="submit">
              作成して入室
            </button>
          </form>
        </section>

        <section className={styles.card}>
          <h2>参加（URLを持っている）</h2>
          <p className={styles.small}>
            ルームURL（例: <code>/r/xxxx</code>）を開いて、パスワードを入力してください。
          </p>
          <div className={styles.row}>
            <Link className={styles.secondary} href="/r/demo">
              例の参加ページを見る
            </Link>
            <Link className={styles.secondary} href="/play">
              /play（900マス ひらがな）
            </Link>
            <Link className={styles.secondary} href="/notes">
              連絡帳（募集）
            </Link>
            <Link className={styles.secondary} href="/world">
              /world ダッシュボード
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
