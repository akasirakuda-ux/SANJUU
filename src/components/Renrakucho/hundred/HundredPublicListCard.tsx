import React, { useEffect, useMemo, useState } from 'react';
import RakudaGreenGateEmoji from '../../RakudaGreenGateEmoji';
import { useGreenGateActiveByUids } from '../../../hooks/useGreenGateActiveByUids';
import {
  formatFirestoreTimeJa,
  hundredDisplayDeadlineMs,
  isHundredBetweenRounds,
  isHundredRoomInPlayOrStarting,
} from '../../../lib/rakudaHubShell';
import { HUNDRED_OPEN_RECRUIT_DEADLINE_MS } from '../../../lib/firestoreTime';
import { formatBoardDimensions } from '../../../lib/boardDimensions';
import { HUNDRED_MAX_PLAYERS } from '../../../lib/hundredRoomCapacity';
import { reconcileHundredRoomPlayerCount } from '../../../lib/hundredRoomPlayer';
import {
  resolveHundredRecruitBoardFields,
  resolveHundredRecruitPickupCharset,
  resolveHundredRecruitRoundStartedAt,
  resolveHundredRecruitTargetWord,
} from '../../../lib/hundredRecruitDisplay';
import {
  isRoboPickupLoungeRecruit,
  roboPickupLoungeHostEmojiForRoom,
  roboPickupLoungeTitleForRoom,
} from '../../../lib/roboPickupLoungeConfig';
import { pickupCharsetBadge } from '../../../lib/hundredPickupCharset';
import {
  TILE_MATCH_DIFFICULTY_LABELS_JA,
  TILE_MATCH_EMOJI,
  TILE_MATCH_HUNDRED_MODE,
  TILE_MATCH_LABEL_JA,
  type TileMatchDifficultyId,
} from '../../../lib/tileMatch/config';
import ModerationCardActions from '../ModerationCardActions';
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
  const isRoboLounge = isRoboPickupLoungeRecruit(item);

  if (status === 'finished') {
    return {
      label: '終了',
      sub: 'このあそびはおわりました',
      badgeClass: 'bg-rk-slate-700 text-rk-white border-rk-slate-700',
      tone: 'ended',
    };
  }
  if (status === 'cancelled') {
    return {
      label: '取消',
      sub: 'ホストが募集を取り消しました',
      badgeClass: 'bg-rk-slate-600 text-rk-white border-rk-slate-600',
      tone: 'ended',
    };
  }
  if (isHundredRoomInPlayOrStarting(room)) {
    return {
      label: isRoboLounge ? '常設' : 'あそび中',
      sub: '途中参加OK',
      badgeClass: 'bg-rk-hundred-recruit text-rk-white border-rk-hundred-recruit',
      tone: 'active',
    };
  }
  if (isHundredBetweenRounds(room)) {
    return {
      label: '次のお題待ち',
      sub: '前のお題はおわり — ホストが次を始めるまで待てます',
      badgeClass: 'bg-rk-amber-600 text-rk-white border-rk-amber-600',
      tone: 'active',
    };
  }
  // 募集中のみ: 募集締切後は締切
  if (deadlineMs !== null && now > deadlineMs) {
    return { label: '締切', sub: '募集は終了しました', badgeClass: 'bg-rk-slate-700 text-rk-white border-rk-slate-700', tone: 'ended' };
  }
  return {
    label: isRoboLounge ? '常設' : '募集中',
    badgeClass: 'bg-rk-hundred-recruit text-rk-white border-rk-hundred-recruit',
    tone: 'active',
  };
}

const HundredPublicListCard: React.FC<{
  item: HundredPublicRecruit;
  room?: HundredRoomListMeta;
  onSelect: () => void;
  /** 認証ユーザーの uid（ホストかどうかの判定に使用） */
  currentUid?: string;
  isAdmin?: boolean;
  onIssueYellowCard?: (userId: string, userName: string) => void | Promise<void>;
  onIssueRedCard?: (userId: string, userName: string) => void | Promise<void>;
}> = ({ item, room, onSelect, currentUid, isAdmin = false, onIssueYellowCard, onIssueRedCard }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const isRoboLounge = isRoboPickupLoungeRecruit(item);
  const hostEmoji = isRoboLounge
    ? roboPickupLoungeHostEmojiForRoom(item.roomId)
    : (item.hostEmoji || room?.hostEmoji || '').trim() || '🐫';
  const hostName = (item.hostNickname || room?.hostNickname || '').trim() || 'ホスト';
  const hostDisplayName = `${hostEmoji}${hostName}`.trim() || hostName;
  const showModeration =
    isAdmin &&
    !isRoboLounge &&
    !!item.hostUid &&
    !!onIssueYellowCard &&
    !!onIssueRedCard;
  const hostGreenByUid = useGreenGateActiveByUids([item.hostUid], now);

  const roundStartedLabel = useMemo(
    () =>
      formatFirestoreTimeJa(resolveHundredRecruitRoundStartedAt(item, room), {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [item, room],
  );

  const pres = useMemo(() => getStatusPresentation(item, room, now), [item, room, now]);
  const displayTargetWord = useMemo(() => resolveHundredRecruitTargetWord(item, room), [item, room]);
  const displayPickupCharset = useMemo(() => resolveHundredRecruitPickupCharset(item, room), [item, room]);
  const displayBoard = useMemo(() => resolveHundredRecruitBoardFields(item, room), [item, room]);

  useEffect(() => {
    const roomId = (item.roomId || '').trim();
    if (!isRoboLounge || !roomId || room?.startedAt == null) return;
    void reconcileHundredRoomPlayerCount(roomId, {
      isRoboLounge: true,
      roundStartedAt: room.startedAt,
      foundWords: Array.isArray(room.foundWords) ? room.foundWords : [],
      pruneAbsent: true,
    }).catch((e) => {
      console.warn('[HundredPublicListCard] reconcile robo lounge players', e);
    });
  }, [isRoboLounge, item.roomId, room?.startedAt]);

  /** ホスト本人のみ「募集中」バッジ。ゲストは参加可能なとき赤バッジを「募集に参加する」にする。 */
  const isHost = !isRoboLounge && !!currentUid && !!item.hostUid && currentUid === item.hostUid;
  const guestCanJoin = !isHost && pres.tone === 'active';
  const badgeText = guestCanJoin
    ? pres.label === '次のお題待ち'
      ? '次のお題待ち'
      : pres.label === 'あそび中' || pres.label === '常設'
        ? '途中参加OK'
        : '募集に参加する'
    : pres.label;

  const countdownLabel = useMemo(() => {
    if (isRoboLounge) return '常設';
    if (
      pres.label === 'あそび中' ||
      pres.label === '満員' ||
      pres.label === '締切' ||
      pres.label === '終了' ||
      pres.label === '次のお題待ち'
    ) {
      return '—';
    }
    const deadlineMs = deadlineToMs(item, room);
    if (deadlineMs != null && deadlineMs >= HUNDRED_OPEN_RECRUIT_DEADLINE_MS - 24 * 60 * 60 * 1000) {
      return 'いつでも';
    }
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
        'w-full text-left rounded-xl bg-rk-white p-3 mb-3 cursor-pointer transition active:scale-[0.99]',
        pres.tone === 'active'
          ? 'border-[3px] border-rk-hundred-recruit shadow-md hover:shadow-lg'
          : 'border border-rk-slate-200 bg-rk-slate-50 text-rk-slate-500 opacity-80 shadow-sm hover:shadow',
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
          <div className="text-[10px] font-black text-rk-slate-400 uppercase tracking-widest">みんなであそぶ</div>
          <div className="text-sm font-bold text-rk-slate-800 truncate flex items-center gap-1 min-w-0">
            <RakudaGreenGateEmoji size="inline" greenGate={item.hostUid ? hostGreenByUid[item.hostUid] : false}>
              {hostEmoji}
            </RakudaGreenGateEmoji>
            <span className="truncate">
              {isRoboLounge ? roboPickupLoungeTitleForRoom(item.roomId) : `${hostName}さんの募集`}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 self-center text-[1.2rem] font-bold leading-none px-5 py-3 rounded-2xl border shadow-sm ${pres.badgeClass}`}
        >
          {badgeText}
        </span>
      </div>
      {pres.sub ? <p className="text-[10px] text-rk-slate-500 mb-1.5">{pres.sub}</p> : null}
      <div className="text-xs text-rk-slate-700 space-y-0.5">
        <div>
          {item.hundredMode === TILE_MATCH_HUNDRED_MODE ? (
            <>
              <span className="text-rk-slate-400">ゲーム</span> {TILE_MATCH_EMOJI} {TILE_MATCH_LABEL_JA}
              {item.tileMatchDifficulty ? (
                <span className="text-rk-slate-600">
                  {' '}
                  （
                  {TILE_MATCH_DIFFICULTY_LABELS_JA[item.tileMatchDifficulty as TileMatchDifficultyId] ??
                    item.tileMatchDifficulty}
                  ）
                </span>
              ) : null}
            </>
          ) : (
            <>
              <span className="inline-flex items-center justify-center min-w-[1.75rem] rounded-md border border-rk-amber-300 bg-rk-amber-50 px-1.5 py-0.5 text-[10px] font-black text-rk-amber-900 mr-1">
                {pickupCharsetBadge(displayPickupCharset)}
              </span>
              <span className="text-rk-slate-400">探すことば</span> {displayTargetWord}
            </>
          )}
        </div>
        <div>
          <span className="text-rk-slate-400">盤面</span> {formatBoardDimensions(displayBoard)}
        </div>
        {item.hundredMode !== TILE_MATCH_HUNDRED_MODE ? (
          <div>
            <span className="text-rk-slate-400">ヒント</span>{' '}
            {item.hintsEnabled === false ? 'なし' : 'あり'}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-rk-slate-100 mt-1.5">
          <span>
            <span className="text-rk-slate-400">{isRoboLounge ? 'お題開始' : '募集開始'}</span>{' '}
            {roundStartedLabel}
          </span>
          <span>
            <span className="text-rk-slate-400">募集の残り</span>{' '}
            <span className="font-mono tabular-nums text-rk-slate-800">{countdownLabel}</span>
          </span>
          {typeof room?.playerCount === 'number' ? (
            <span>
              <span className="text-rk-slate-400">{isRoboLounge ? 'いま' : '参加'}</span>{' '}
              {isRoboLounge ? `${room.playerCount}人` : `${room.playerCount}/${HUNDRED_MAX_PLAYERS}`}
            </span>
          ) : null}
        </div>
      </div>
      {showModeration ? (
        <div
          className="mt-2 pt-2 border-t border-rk-slate-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] font-bold text-rk-slate-400 mb-1">管理者</div>
          <ModerationCardActions
            userId={item.hostUid}
            userName={hostDisplayName}
            onIssueYellowCard={onIssueYellowCard}
            onIssueRedCard={onIssueRedCard}
            compact
          />
        </div>
      ) : null}
    </div>
  );
};

export default HundredPublicListCard;
