import Link from 'next/link';

/** らくだ珈琲トップ「掲示板」から `…/sanjuu/bulletin` で開く先（本文は随時拡張） */
export default function SanjuuBulletinPage() {
  return (
    <main style={{ padding: '1.5rem', maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>全体掲示板</h1>
      <p style={{ marginTop: 12, color: '#334155', lineHeight: 1.6 }}>
        らくだ珈琲のトップからこのページへ遷移しています。
      </p>
      <p style={{ marginTop: 20 }}>
        <Link href="/" style={{ color: '#0369a1', fontWeight: 700 }}>
          ← 30SANJUU トップへ
        </Link>
      </p>
    </main>
  );
}
