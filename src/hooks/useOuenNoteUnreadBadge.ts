import { useEffect, useState } from 'react';
import { subscribeOuenNoteTopics, type OuenNoteTopic } from '../lib/ouenNoteClient';
import {
  OUEN_NOTE_READ_CHANGED_EVENT,
  ouenNoteHasAnyUnread,
} from '../lib/ouenNoteReadState';

/**
 * メインハブ「ちょっと誰かに…」未読バッジ用。
 * 相談の新規投稿・コメント（将来の返信含む）で lastActivity が進んだ相談があるとき true。
 */
export function useOuenNoteUnreadBadge(
  enabled: boolean,
  viewerUid: string | null,
): boolean {
  const [topics, setTopics] = useState<OuenNoteTopic[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setTopics([]);
      return;
    }
    const unsub = subscribeOuenNoteTopics(setTopics, () => setTopics([]));
    return unsub;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(OUEN_NOTE_READ_CHANGED_EVENT, bump);
    return () => window.removeEventListener(OUEN_NOTE_READ_CHANGED_EVENT, bump);
  }, [enabled]);

  if (!enabled) return false;
  void tick;
  return ouenNoteHasAnyUnread(topics, viewerUid);
}
