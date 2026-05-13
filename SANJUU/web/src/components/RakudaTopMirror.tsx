'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './RakudaTopMirror.module.css';
import Link from 'next/link';

/** らくだトップに寄せた「表示名」ブロック。取得は同一オリジンの `/api/rakuda-profile` 経由 */
function readRakudaQueryProfile(): { urlEmoji: string; urlNick: string } {
  if (typeof window === 'undefined') return { urlEmoji: '', urlNick: '' };
  try {
    const sp = new URL(window.location.href).searchParams;
    return {
      urlEmoji: (sp.get('rkEmoji') ?? '').trim(),
      urlNick: (sp.get('rkNick') ?? '').trim(),
    };
  } catch {
    return { urlEmoji: '', urlNick: '' };
  }
}

export default function RakudaTopMirror() {
  const [emoji, setEmoji] = useState('');
  const [nickname, setNickname] = useState('');
  const load = useCallback(async () => {
    const { urlEmoji, urlNick } = readRakudaQueryProfile();
    try {
      const r = await fetch('/api/rakuda-profile', { cache: 'no-store' });
      const j: unknown = await r.json();
      if (typeof j !== 'object' || !j || typeof (j as { profile?: unknown }).profile !== 'object') {
        setEmoji(urlEmoji);
        setNickname(urlNick);
        return;
      }
      const p = (j as { profile: { emoji?: unknown; nickname?: unknown } }).profile;
      const apiEmoji = typeof p.emoji === 'string' ? p.emoji : '';
      const apiNick = typeof p.nickname === 'string' ? p.nickname : '';
      setEmoji(urlEmoji || apiEmoji);
      setNickname(urlNick || apiNick);
    } catch {
      setEmoji(urlEmoji);
      setNickname(urlNick);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.wrap}>
      <div className={styles.badge}>試作・ローカル</div>
      <p className={styles.lead}>
        公式の表示名は<strong>らくだ珈琲</strong>が管理します。ここではこの端末向けの表示確認と、掲示板などへの利用に使います。
      </p>
      <div className={styles.row}>
        <input
          type="text"
          className={styles.emojiIn}
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="絵文字"
          aria-label="絵文字"
          maxLength={8}
        />
        <input
          type="text"
          className={styles.nameIn}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="ニックネーム"
          maxLength={32}
        />
      </div>
      <div className={styles.preview}>
        <span className={styles.previewLabel}>表示の例</span>
        <span className={styles.previewBody}>
          {emoji || '…'} {nickname || '（未入力）'}
        </span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => void load()}>
          取り込み直す
        </button>
        <Link className={styles.link} href="https://rakuda.coffee/" target="_blank" rel="noreferrer">
          らくだ珈琲で表示名を設定
        </Link>
      </div>
      <p className={styles.ok}>
        表示名の取得はこのページから（CORS なし）行っています。らくだでログインすると、取り込みで同期されます。
      </p>
    </section>
  );
}
