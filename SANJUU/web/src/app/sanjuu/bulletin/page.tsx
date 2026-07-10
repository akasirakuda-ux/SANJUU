import Link from 'next/link';

/** らくだ本体の `/keijiban`（`api/rakuda-profile` と同じ `NEXT_PUBLIC_RAKUDA_ORIGIN`） */
const rakudaKeijibanUrl = () =>
  `${(process.env.NEXT_PUBLIC_RAKUDA_ORIGIN || 'https://rakuda.coffee').replace(/\/+$/, '')}/keijiban`;

/** らくだ珈琲トップ「掲示板」から `…/sanjuu/bulletin` で開く先（本文は随時拡張） */
export default function SanjuuBulletinPage() {
  const keijibanHref = rakudaKeijibanUrl();
  return (
    <main
      style={{
        padding: '1.5rem',
        maxWidth: 560,
        margin: '0 auto',
        fontFamily: 'var(--sj-rk-font-ui)',
        color: 'var(--sj-rk-fg-default)',
      }}
    >
      <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>全体掲示板</h1>
      <p style={{ marginTop: 12, color: 'var(--sj-rk-fg-default)', lineHeight: 1.6 }}>
        らくだ珈琲のトップからこのページへ遷移しています。
      </p>
      <p style={{ marginTop: 16, lineHeight: 1.6 }}>
        <a href={keijibanHref} className="sj-rk-inline-link" target="_blank" rel="noopener noreferrer">
          らくだ珈琲の掲示板（みんなであそぶ）を開く
        </a>
        <span style={{ marginLeft: 8, color: 'var(--sj-rk-fg-subtle)', fontSize: '0.92rem' }}>
          （らくだ本体・Firebase）
        </span>
      </p>
      <p style={{ marginTop: 20 }}>
        <Link href="/sanjuu" className="sj-rk-inline-link">
          ← ひと言探し（らくだ入口）へ
        </Link>
      </p>
    </main>
  );
}
