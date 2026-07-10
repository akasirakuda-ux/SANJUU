'use client';

import Link from 'next/link';
import styles from './RakudaReturnCorner.module.css';

/** らくだ本体（固定 URL・省略なし） */
const RAKUDA_ORIGIN = 'https://rakuda.coffee/';

/**
 * 30SANJUU 全画面の右上：らくだ珈琲トップへ（淡色スキュア＋左向きシェブロン）
 */
export default function RakudaReturnCorner() {
  return (
    <Link
      href={RAKUDA_ORIGIN}
      className={styles.link}
      aria-label="らくだ珈琲のトップへもどる"
      title="らくだ珈琲のトップへもどる"
    >
      <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M15 6l-6 6 6 6"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
