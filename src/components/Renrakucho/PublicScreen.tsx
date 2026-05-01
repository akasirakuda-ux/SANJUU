import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  firestoreLikeToMillis,
  hundredDisplayDeadlineMs,
  shouldHideHundredPublicFromListItem,
} from '../../lib/firestoreTime';
import { formatFirestoreTimeJa } from '../../lib/firestoreTime';
import type { HundredPublicRecruit, HundredRoomListMeta, Message } from './types';
import RecruitMessage from './RecruitMessage';
import HundredPublicListCard from './hundred/HundredPublicListCard';
import HundredFlow from './HundredFlow';
import HundredClosedNotice from './hundred/HundredClosedNotice';
import RenrakuchoBoardNotice from './RenrakuchoBoardNotice';
import RenrakuchoSanjuuPlaySection from './RenrakuchoSanjuuPlaySection';
import PublicBoardMessageCard from './PublicBoardMessageCard';
import PrivateTimelineCard from './PrivateTimelineCard';
import { Trash2 } from 'lucide-react';
import SanjuuBrandHeading from '../SanjuuBrandHeading';

function createdAtMs(item: { createdAt?: unknown }): number {
  const m = firestoreLikeToMillis(item?.createdAt);
  return m != null && Number.isFinite(m) ? m : 0;
}

function hundredDeadlineMs(item: HundredPublicRecruit, room: HundredRoomListMeta | undefined): number | null {
  return hundredDisplayDeadlineMs({
    roomRecruitDeadlineAt: room?.recruitDeadlineAt,
    itemRecruitDeadlineAt: item.recruitDeadlineAt,
    itemCreatedAt: item.createdAt,
  });
}

function isHundredEnded(item: HundredPublicRecruit, room: HundredRoomListMeta | undefined, now: number): boolean {
  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return true;
  const dl = hundredDeadlineMs(item, room);
  return dl !== null && now > dl;
}

function hundredSortRank(item: HundredPublicRecruit, room: HundredRoomListMeta | undefined, now: number): 1 | 2 | 3 {
  const st = room?.status ?? 'recruiting';
  const dl = hundredDeadlineMs(item, room);
  const expired = dl !== null && now > dl;
  if (!expired && st === 'recruiting') return 1;
  if (!expired && st === 'started') return 2;
  // 期限切れ / 終了 / 取消 / その他は最下部
  return 3;
}

const PublicScreen: React.FC<{
  publicScreen: string;
  setPublicScreen: React.Dispatch<
    React.SetStateAction<
      | 'list'
      | 'closed'
      | 'hundred-create'
      | 'hundred-detail'
      | 'hundred-wait'
      | 'hundred-board'
    >
  >;
  hundredRoomMetaByRoomId: Record<string, HundredRoomListMeta>;
  publicHundred: HundredPublicRecruit[];
  publicMessages: Message[];
  /** 一般ユーザー向け：自分の伝言（renraku_private where fromUserUid==me） */
  myPrivateMessages: Message[];
  selectedHundred: HundredPublicRecruit | null;
  setSelectedHundred: React.Dispatch<React.SetStateAction<HundredPublicRecruit | null>>;
  nickname: string;
  userEmoji: string;
  currentUid: string | undefined;
  isAdmin: boolean;
  /** 掲示板のいいね等（ブロック時は無効） */
  isBoardInteractionBlocked: boolean;
  handleDelete: (id: string, target: 'community' | 'recruit' | 'private') => void | Promise<void>;
  /** 同一投稿者 uid の投稿を public_messages / renraku_public / renraku_private で一括 blocked */
  handleBulkBlockAuthorPosts: (authorUid: string, authorName?: string) => void | Promise<void>;
  onTogglePostReaction: (postId: string) => void | Promise<void>;
  onToggleBoardPin: (postId: string, currentlyPinned: boolean) => void | Promise<void>;
  onJoinRoom?: (roomId: string) => void;
  onStartHundred: (roomId: string) => void;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  onCloseHundredRecruitment: () => void | Promise<void>;
  onHundredGenerationCancelled?: () => void;
  onNavigateToSelectWithRenrakucho: () => void;
}> = ({
  publicScreen,
  setPublicScreen,
  hundredRoomMetaByRoomId,
  publicHundred,
  publicMessages,
  myPrivateMessages,
  selectedHundred,
  setSelectedHundred,
  nickname,
  userEmoji,
  currentUid,
  isAdmin,
  isBoardInteractionBlocked,
  handleDelete,
  handleBulkBlockAuthorPosts,
  onTogglePostReaction,
  onToggleBoardPin,
  onJoinRoom,
  onStartHundred,
  streamMode = false,
  onCloseHundredRecruitment,
  onHundredGenerationCancelled,
  onNavigateToSelectWithRenrakucho,
}) => {
  const [now, setNow] = useState(() => Date.now());

  // 期限が来た瞬間に「締切」へ & 並び替えが走るようにする
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), streamMode ? 5000 : 1000);
    return () => window.clearInterval(t);
  }, [streamMode]);

  /**
   * hundred_public 一覧の「締切相当のさらに5分後」非表示（DB は残す）。
   * recruitDeadlineAt 欠損時は createdAt + 募集枠 で締切相当を出す（hundredDisplayDeadlineMs と整合）。
   */
  const hundredVisibleForList = useMemo(
    () => publicHundred.filter((h) => !shouldHideHundredPublicFromListItem(h, now)),
    [publicHundred, now]
  );

  /** hundred だけをソート。メッセージだけが変わったときに再ソートしないよう sortedPublicItems と分離。 */
  const sortedHundredForList = useMemo(() => {
    return hundredVisibleForList
      .slice()
      .sort((a, b) => {
        const ra = hundredSortRank(a, a.roomId ? hundredRoomMetaByRoomId[a.roomId] : undefined, now);
        const rb = hundredSortRank(b, b.roomId ? hundredRoomMetaByRoomId[b.roomId] : undefined, now);
        if (ra !== rb) return ra - rb;
        // 1位グループは新しい順（それ以外も新しい順でまとめて見やすく）
        return createdAtMs(b) - createdAtMs(a);
      });
  }, [hundredVisibleForList, hundredRoomMetaByRoomId, now]);

  const sortedPublicItems = useMemo(() => {
    const other = [...publicMessages].slice().sort((a: any, b: any) => {
      return createdAtMs(b) - createdAtMs(a);
    });

    // 全体の優先度: 募集中(期限内) → 進行中 → その他(メッセージ) → 期限切れ/終了
    const hundredTop = sortedHundredForList.filter((h) => {
      const room = h.roomId ? hundredRoomMetaByRoomId[h.roomId] : undefined;
      return hundredSortRank(h, room, now) !== 3;
    });
    const hundredBottom = sortedHundredForList.filter((h) => {
      const room = h.roomId ? hundredRoomMetaByRoomId[h.roomId] : undefined;
      return hundredSortRank(h, room, now) === 3;
    });

    return [...hundredTop, ...other, ...hundredBottom];
  }, [sortedHundredForList, publicMessages, hundredRoomMetaByRoomId, now]);

  const myPrivateVisible = useMemo(() => {
    if (isAdmin) return [];
    return [...myPrivateMessages].slice().sort((a: any, b: any) => createdAtMs(b) - createdAtMs(a));
  }, [isAdmin, myPrivateMessages]);

  const handleSelectHundred = useCallback(
    (item: HundredPublicRecruit) => {
      setSelectedHundred(item);
      // 募集カードタップ → 詳細をスキップして待機ロビーへ（ゲスト導線をシンプルに）
      setPublicScreen('hundred-wait');
    },
    [setSelectedHundred, setPublicScreen]
  );

  const hundredItemCacheRef = useRef<Record<string, HundredPublicRecruit>>({});
  const hundredSelectHandlerCacheRef = useRef<Record<string, () => void>>({});
  const getSelectHundredHandler = useCallback(
    (item: HundredPublicRecruit) => {
      const key = String(item.id);
      hundredItemCacheRef.current[key] = item;
      const cache = hundredSelectHandlerCacheRef.current;
      if (!cache[key]) {
        cache[key] = () => {
          const latest = hundredItemCacheRef.current[key];
          if (latest) handleSelectHundred(latest);
        };
      }
      return cache[key];
    },
    [handleSelectHundred]
  );

  const deleteHandlerCacheRef = useRef<Record<string, () => void>>({});
  const getDeleteHandler = useCallback(
    (id: string, target: 'community' | 'recruit' | 'private') => {
      const key = `${target}:${id}`;
      const cache = deleteHandlerCacheRef.current;
      if (!cache[key]) {
        cache[key] = () => void handleDelete(id, target);
      }
      return cache[key];
    },
    [handleDelete]
  );

  useEffect(() => {
    const keep = new Set<string>();
    const items = sortedPublicItems as any[];
    for (let i = 0; i < items.length; i++) {
      keep.add(String(items[i].id));
    }

    {
      const cache = deleteHandlerCacheRef.current;
      for (const it of items) {
        if (it.type === 'community') keep.add(`community:${String(it.id)}`);
        if (it.type === 'recruit') keep.add(`recruit:${String(it.id)}`);
        if (it.type === 'private') keep.add(`private:${String(it.id)}`);
      }
      for (const k of Object.keys(cache)) {
        if (!keep.has(k)) delete cache[k];
      }
    }

    {
      const cache = hundredItemCacheRef.current;
      for (const k of Object.keys(cache)) {
        if (!keep.has(k)) delete cache[k];
      }
    }
    {
      const cache = hundredSelectHandlerCacheRef.current;
      for (const k of Object.keys(cache)) {
        if (!keep.has(k)) delete cache[k];
      }
    }
  }, [sortedPublicItems]);

  const handleOpenHundredCreate = useCallback(() => {
    setPublicScreen('hundred-create');
  }, [setPublicScreen]);

  const publicCards = useMemo(() => {
    return sortedPublicItems.map((item: any) =>
      item.type === 'hundred' ? (
        <motion.div
          key={`hundred-${item.id}`}
          layout="position"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="motion-reduce:!transition-none"
        >
          <HundredPublicListCard
            item={item as HundredPublicRecruit}
            room={item.roomId ? hundredRoomMetaByRoomId[item.roomId] : undefined}
            onSelect={getSelectHundredHandler(item as HundredPublicRecruit)}
            currentUid={currentUid}
          />
        </motion.div>
      ) : item.type === 'recruit' ? (
        <RecruitMessage
          key={item.id}
          msg={item as Message}
          isAdmin={isAdmin}
          currentUid={currentUid}
          onDelete={getDeleteHandler(String(item.id), 'recruit')}
          onJoinRoom={onJoinRoom}
        />
      ) : item.type === 'community' ? (
        <PublicBoardMessageCard
          key={item.id}
          msg={item as Message}
          currentUid={currentUid}
          isAdmin={isAdmin}
          isInteractionBlocked={isBoardInteractionBlocked}
          onDelete={getDeleteHandler(String(item.id), 'community')}
          onToggleReaction={() => void onTogglePostReaction(String(item.id))}
          onTogglePin={() => void onToggleBoardPin(String(item.id), !!(item as Message).pinned)}
        />
      ) : item.type === 'private' ? (
        <PrivateTimelineCard
          key={`private-${item.id}`}
          msg={item as Message}
          currentUid={currentUid}
          isAdmin={isAdmin}
          onDelete={getDeleteHandler(String(item.id), 'private')}
        />
      ) : null
    );
  }, [
    sortedPublicItems,
    hundredRoomMetaByRoomId,
    getSelectHundredHandler,
    getDeleteHandler,
    onJoinRoom,
    isAdmin,
    currentUid,
    handleBulkBlockAuthorPosts,
    isBoardInteractionBlocked,
    onTogglePostReaction,
    onToggleBoardPin,
  ]);

  return (
    <motion.div
      key="public"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto w-full max-w-lg space-y-4 pb-2"
    >
      {publicScreen === 'closed' && (
        <HundredClosedNotice
          onBackToLobby={() => {
            setSelectedHundred(null);
            setPublicScreen('list');
          }}
        />
      )}

      {publicScreen === 'list' && (
        <>
          <SanjuuBrandHeading as="h1" />
          <RenrakuchoSanjuuPlaySection />

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="relative flex w-full min-h-[88px] items-stretch overflow-hidden rounded-xl border-2 border-[#5a3d28] text-xl font-black text-amber-950 shadow-sm transition-transform active:scale-[0.99]"
              onClick={handleOpenHundredCreate}
            >
              <span
                className="pointer-events-none absolute inset-0 z-0 bg-[#e3d5bc]"
                style={{ backgroundColor: '#e3d5bc' }}
                aria-hidden
              />
              <span className="relative z-10 flex w-full items-center justify-center gap-3 px-3 py-3 md:gap-4 md:px-4">
                <span className="text-5xl leading-none shrink-0 md:text-6xl" aria-hidden>
                  👨‍👩‍👧‍👦
                </span>
                <span className="min-w-0 text-left leading-tight">
                  探しものの問題を作り
                  <br />
                  掲示板にのせる
                </span>
              </span>
            </button>
          </div>

          <RenrakuchoBoardNotice />

          {!isAdmin && myPrivateVisible.length > 0 ? (
            <div className="space-y-2">
              <p className="mt-[0.3em] text-[15px] font-black uppercase tracking-widest text-amber-950 px-1 scroll-mt-4">
                📋らくだ珈琲🐫☕への伝言
              </p>
              <div className="space-y-2">
                {myPrivateVisible.map((m) => {
                  const replyMsg = String((m as any).replyMessage ?? '').trim();
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black text-slate-500">
                            {formatFirestoreTimeJa((m as any).createdAt)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDelete(String(m.id), 'private')}
                          className="p-2 text-slate-600 hover:text-rose-600 transition-colors rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shrink-0"
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-slate-800 break-words">
                        {String((m as any).message ?? '')}
                      </p>
                      {replyMsg ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          <div className="text-[10px] font-black text-amber-900">らくだ珈琲🐫☕からの返信</div>
                          <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-amber-950 break-words">
                            {replyMsg}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <p
            id="renraku-public-timeline"
            className="mt-[0.3em] text-[15px] font-black uppercase tracking-widest text-amber-950 px-1 scroll-mt-4"
          >
            📝タイムライン（掲示・募集・探しもの）
          </p>

          {sortedPublicItems.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#5a3d28] bg-[#e3d5bc] px-4 py-16 text-center">
              <p className="text-sm font-bold text-amber-950">まだ掲示板に投稿がありません</p>
              <p className="mt-3 text-[11px] leading-relaxed text-amber-950">
                画面下のフォームで
                <span className="font-bold text-amber-950">「掲示板にのせる（みんなが見る）」</span>
                を選んで送ると、
                <span className="font-bold text-amber-950">このタイムライン</span>
                に表示されます。
              </p>
            </div>
          ) : (
            <>
              {/*
                hundred のみ layout+exit: メッセージ行は motion にしない（静かな一覧のため）。
                key は id ベースで安定。popLayout で締切カード除去時に残りが滑らかに詰まる。
              */}
              <AnimatePresence mode="popLayout" initial={false}>
                {publicCards}
              </AnimatePresence>
            </>
          )}
        </>
      )}

      <HundredFlow
        publicScreen={publicScreen}
        selectedHundred={selectedHundred}
        setSelectedHundred={setSelectedHundred}
        nickname={nickname}
        userEmoji={userEmoji}
        currentUid={currentUid}
        isAdmin={isAdmin}
        setPublicScreen={setPublicScreen}
        onStartHundred={onStartHundred}
        streamMode={streamMode}
        onCloseHundredRecruitment={onCloseHundredRecruitment}
        onHundredGenerationCancelled={onHundredGenerationCancelled}
        hundredRoomMetaByRoomId={hundredRoomMetaByRoomId}
        nowMs={now}
      />

    </motion.div>
  );
};

export default PublicScreen;

