'use client';

import Link from 'next/link';
import styles from './RK19QuietRoomBackButton.module.css';

type Props = {
  href: string;
  title?: string;
};

/** RK-19 しずかの間・左上戻る（白角丸） */
export default function RK19QuietRoomBackButton({ href, title = 'もどる' }: Props) {
  return (
    <Link href={href} className={styles.btn} aria-label={title} title={title}>
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
