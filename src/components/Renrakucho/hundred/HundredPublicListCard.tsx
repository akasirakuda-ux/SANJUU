import React, { useEffect, useMemo, useState } from 'react';
import { formatFirestoreTimeJa, hundredDisplayDeadlineMs } from '../../../lib/firestoreTime';
import type { HundredPublicRecruit, HundredRoomListMeta } from '../types';

const pad2 = (n: number) => String(n).padStart(2, '0');

function deadlineToMs(item: HundredPublicRecruit, room?: HundredRoomListMeta): number | null {
  return hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: room?.recruitDeadlineAt,
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
}

function getStatusPresentation(
  item: HundredPublicRecruit,
  room: HundredRoomListMeta | undefined,
  now: number
): { label: string; sub?: string; badgeClass: string; tone: 'active' | 'ended' } {
  const status = room?.status ?? 'recruiting';
  const deadlineMs = deadlineToMs(item, room);
  const playerCount = room?.playerCount;

  // 期限切れは DB 状態に関係なく強制で「締切」
  if (deadlineMs !== null && now > deadlineMs) {
    return { label: '締切', sub: '募集は終了しました', badgeClass: 'bg-slate-700 text-white border-slate-700', tone: 'ended' };
  }

  if (status === 'finished') {
    return {
      label: '終了',
      sub: 'このあそびはおわりました',
      badgeClass: 'bg-slate-700 text-white border-slate-700',
      tone: 'ended',
    };
  }
  if (status === 'cancelled') {
    return {
      label: '取消',
      sub: 'ホストが募集を取り消しました',
      badgeClass: 'bg-slate-600 text-white border-slate-600',
      tone: 'ended',
    };
  }
  if (status === 'started') {
    return {
      // 要望: 「進行中」表記はやめて「募集中」に統一
      label: '募集中',
      sub: 'あそびははじまっています',
      badgeClass: 'bg-[#FF0000] text-white border-[#FF0000]',
      tone: 'active',
    };
  }
  if (typeof playerCount === 'number' && playerCount >= 100) {
    return { label: '満員', badgeClass: 'bg-slate-700 text-white border-slate-700', tone: 'ended' };
  }
  return { label: '募集中', badgeClass: 'bg-[#FF0000] text-white border-[#FF0000]', tone: 'active' };
}

const HundredPublicListCard: React.FC<{
  item: HundredPublicRecruit;
  room?: HundredRoomListMeta;
  onSelect: () => void;
  /** 認証ユーザーの uid（ホストかどうかの判定に使用） */
  currentUid?: string;
}> = ({ item, room, onSelect, currentUid }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const hostLabel = useMemo(() => {
    const name = (item.hostNickname || room?.hostNickname || '').trim() || 'ホスト';
    const emoji = (item.hostEmoji || room?.hostEmoji || '').trim() || '🐫';
    return `${emoji}${name}さんの募集`;
  }, [item.hostNickname, item.hostEmoji, room?.hostNickname, room?.hostEmoji]);

  const createdLabel = useMemo(
    () =>
      formatFirestoreTimeJa(item.createdAt, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [item.createdAt]
  );

  const pres = useMemo(() => getStatusPresentation(item, room, now), [item, room, now]);

  /** ホスト本人のみ「募集中」バッジ。ゲストは参加可能なとき赤バッジを「募集に参加する」にする。 */
  const isHost = !!currentUid && !!item.hostUid && currentUid === item.hostUid;
  const guestCanJoin = !isHost && pres.tone === 'active';
  const badgeText = guestCanJoin ? '募集に参加する' : pres.label;

  const countdownLabel = useMemo(() => {
    if (pres.label === '進行中' || pres.label === '満員') return '—';
    const deadlineMs = deadlineToMs(item, room);
    if (deadlineMs === null) return '—';
    const left = Math.max(0, deadlineMs - now);
    if (left <= 0) return '0:00';
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return `${m}:${pad2(s)}`;
  }, [item, room, now, pres.label]);

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        'w-full text-left rounded-xl bg-white p-3 mb-3 cursor-pointer transition active:scale-[0.99]',
        pres.tone === 'active'
          ? 'border-[3px] border-[#FF0000] shadow-md hover:shadow-lg'
          : 'border border-slate-200 bg-slate-50 text-slate-500 opacity-80 shadow-sm hover:shadow',
      ].join(' ')}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">みんなであそぶ</div>
          <div className="text-sm font-bold text-slate-800 truncate">{hostLabel}</div>
        </div>
        <span
          className={`shrink-0 self-center text-[1.2rem] font-bold leading-none px-5 py-3 rounded-2xl border shadow-sm ${pres.badgeClass}`}
        >
          {badgeText}
        </span>
      </div>
      {pres.sub ? <p className="text-[10px] text-slate-500 mb-1.5">{pres.sub}</p> : null}
      <div className="text-xs text-slate-700 space-y-0.5">
        <div>
          <span className="text-slate-400">探すことば</span> {item.targetWord || '—'}
        </div>
        <div>
          <span className="text-slate-400">盤面</span> {item.boardSize || '—'}×{item.boardSize || '—'}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-slate-100 mt-1.5">
          <span>
            <span className="text-slate-400">募集開始</span> {createdLabel}
          </span>
          <span>
            <span className="text-slate-400">募集の残り</span>{' '}
            <span className="font-mono tabular-nums text-slate-800">{countdownLabel}</span>
          </span>
          {typeof room?.playerCount === 'number' ? (
            <span>
              <span className="text-slate-400">参加</span> {room.playerCount}/100
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default HundredPublicListCard;
