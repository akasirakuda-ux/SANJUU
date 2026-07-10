'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import RakudaTopMirror from './RakudaTopMirror';

function querySuffix(): string {
  if (typeof window === 'undefined') return '';
  try {
    const s = window.location.search;
    return s && s.startsWith('?') ? s : '';
  } catch {
    return '';
  }
}

/** らくだから `/sanjuu` / `/sanjuu/recruit-lobby` / `/sanjuu/recruit-board` で開くハブ。全体掲示板・募集掲示板への導線はらくだトップのみ（ここには置かない） */
export default function SanjuuFromRakudaHub({ heading }: { heading: string }) {
  const [suffix, setSuffix] = useState('');

  useEffect(() => {
    setSuffix(querySuffix());
  }, []);

  return (
    <main
      style={{
        padding: '1.5rem',
        maxWidth: 640,
        margin: '0 auto',
        fontFamily: 'var(--sj-rk-font-ui)',
        color: 'var(--sj-rk-fg-default)',
      }}
    >
      <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{heading}</h1>
      <p style={{ marginTop: 10, color: 'var(--sj-rk-fg-muted)', lineHeight: 1.6 }}>
        らくだ珈琲から渡した絵文字・ニックネームは下のブロックに反映されます。各あそびへ進むと、URL のクエリもそのまま引き継がれます。
      </p>
      <div style={{ marginTop: 20 }}>
        <RakudaTopMirror />
      </div>
      <nav
        style={{
          marginTop: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px 0',
          borderTop: '1px solid var(--sj-rk-border-muted)',
        }}
        aria-label="三十への導線（全体掲示板・募集掲示板はらくだトップから）"
      >
        <Link href={`/notes${suffix}`} className="sj-rk-inline-link">
          募集リスト（連絡帳）→
        </Link>
        <Link href={`/play${suffix}`} className="sj-rk-inline-link">
          ひらがな900マス →
        </Link>
        <Link href={`/r/demo${suffix}`} className="sj-rk-inline-link">
          お試し教室 →
        </Link>
      </nav>
    </main>
  );
}
