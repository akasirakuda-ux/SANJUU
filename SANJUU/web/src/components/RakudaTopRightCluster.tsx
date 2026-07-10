'use client';

import { usePathname } from 'next/navigation';
import RakudaReturnCorner from './RakudaReturnCorner';
import styles from './RakudaTopRightCluster.module.css';

function isRecruitBoardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const norm = pathname.replace(/\/+$/, '') || '/';
  return (
    norm === '/sanjuu/recruit-board' ||
    norm.endsWith('/sanjuu/recruit-board') ||
    norm === '/sanjuu/tile-match-recruit-board' ||
    norm.endsWith('/sanjuu/tile-match-recruit-board')
  );
}

/** 三十すべての画面：右上にトップへ戻る（３０募集一覧は左上「トップに戻る」と重複するため非表示） */
export default function RakudaTopRightCluster() {
  const pathname = usePathname();
  if (isRecruitBoardPath(pathname)) {
    return null;
  }

  return (
    <div className={styles.cluster}>
      <RakudaReturnCorner />
    </div>
  );
}
