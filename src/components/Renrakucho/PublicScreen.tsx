import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RAKUDA_HUNDRED_CREATE_FRAGMENT,
  firestoreLikeToMillis,
  formatFirestoreTimeJa,
  hundredDisplayDeadlineMs,
  resolveRenrakuPrivateReplyText,
  shouldHideHundredPublicFromListItem,
  type RenrakuPrivateReplyPayload,
} from '../../lib/rakudaHubShell';
import { saveHundredRestoreSession } from '../../lib/rakudaHundredRestore';
import type { HundredPublicRecruit, HundredRoomListMeta, Message } from './types';
import RecruitMessage from './RecruitMessage';
import HundredPublicListCard from './hundred/HundredPublicListCard';
import HundredFlow from './HundredFlow';
import HundredClosedNotice from './hundred/HundredClosedNotice';
import HundredCreatePanel from './hundred/HundredCreatePanel';
import RenrakuchoBoardNotice from './RenrakuchoBoardNotice';
import RenrakuchoSanjuuPlaySection from './RenrakuchoSanjuuPlaySection';
import PublicBoardMessageCard from './PublicBoardMessageCard';
import PrivateTimelineCard from './PrivateTimelineCard';
import RenrakuMessageBody from './RenrakuMessageBody';
import RenrakuCopyTextButton from './RenrakuCopyTextButton';
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
    React.SetStateAction<'list' | 'closed' | 'hundred-detail' | 'hundred-wait' | 'hundred-board'>
  >;
  hundredRoomMetaByRoomId: Record<string, HundredRoomListMeta>;
  publicHundred: HundredPublicRecruit[];
  publicMessages: Message[];
  /** 自分の伝言（renraku_private where fromUserUid==me） */
  myPrivateMessages: Message[];
  /** 伝言への返信（private_reply/sender） */
  privateReplyByMessageId: Record<string, RenrakuPrivateReplyPayload>;
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
  /** `/keijiban` から入ったとき 30 募集ブロックを出さない */
  hideSanjuuRecruitmentSection?: boolean;
  /** `/hundred` では【30SANJUU】以下（掲示板タイムライン等）を出さない */
  hideBulletinBelowCreate?: boolean;
  /** false の間は「投稿なし」プレースホルダを出さない（初回取得前のチラつき防止） */
  publicTimelineHydrated?: boolean;
  ensureAuth: () => Promise<void>;
}> = ({
  publicScreen,
  setPublicScreen,
  hundredRoomMetaByRoomId,
  publicHundred,
  publicMessages,
  myPrivateMessages,
  privateReplyByMessageId,
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
  hideSanjuuRecruitmentSection = false,
  hideBulletinBelowCreate = false,
  publicTimelineHydrated = false,
  ensureAuth,
}) => {
  const [now, setNow] = useState(() => Date.now());

  /** `/hundred#rk-hundred-create` — 作成フォームのみ（SANJUU 以下を出さない） */
  const atHundredCreateFocus =
    publicScreen === 'list' &&
    typeof window !== 'undefined' &&
    window.location.hash === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`;

  const hideBelowCreatePanel = atHundredCreateFocus || hideBulletinBelowCreate;

  // 期限が来た瞬間に「締切」へ & 並び替えが走るようにする
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), streamMode ? 5000 : 1000);
    return () => window.clearInterval(t);
  }, [streamMode]);

  /** `/hundred#rk-hundred-create` から開いたとき、作成フォームへスクロール */
  useLayoutEffect(() => {
    if (publicScreen !== 'list') return;
    if (typeof window === 'undefined') return;
    const want = `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`;
    if (window.location.hash !== want) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(RAKUDA_HUNDRED_CREATE_FRAGMENT)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [publicScreen]);

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
    return [...myPrivateMessages].slice().sort((a: any, b: any) => createdAtMs(b) - createdAtMs(a));
  }, [myPrivateMessages]);

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

  const publicCards = useMemo(() => {
    return sortedPublicItems.map((item: any) => {
      const kind = item.type === 'hundred' || item.targetWord != null ? 'hundred' : item.type;
      return kind === 'hundred' ? (
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
          isInteractionBlocked={isBoardInteractionBlocked}
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
      ) : null;
    });
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
    <>
      {publicScreen === 'closed' && (
        <HundredClosedNotice
          onBackToLobby={() => {
            setSelectedHundred(null);
            setPublicScreen('list');
          }}
        />
      )}

      {publicScreen === 'list' && (
        <motion.div
          key="public-list"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`mx-auto w-full max-w-lg pb-2 ${hideBelowCreatePanel ? 'px-3 py-6' : 'space-y-4'}`}
        >
          {!hideSanjuuRecruitmentSection ? (
            <section
              id={RAKUDA_HUNDRED_CREATE_FRAGMENT}
              className={
                hideBelowCreatePanel
                  ? 'scroll-mt-4'
                  : 'scroll-mt-4 rounded-2xl border-[3px] border-rk-amber-500 bg-rk-amber-50/40 p-2 shadow-md'
              }
              aria-label="ひと言探し 問題を作る"
            >
              <HundredCreatePanel
                nickname={nickname}
                userEmoji={userEmoji}
                currentUid={currentUid}
                isBoardInteractionBlocked={isBoardInteractionBlocked}
                ensureAuth={ensureAuth}
                onCreatedRecruit={(recruit) => {
                  setSelectedHundred(recruit);
                  setPublicScreen('hundred-wait');
                  saveHundredRestoreSession({ publicScreen: 'hundred-wait', selectedHundred: recruit });
                  try {
                    const u = new URL(window.location.href);
                    u.hash = '';
                    window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`);
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </section>
          ) : null}

          {!hideBelowCreatePanel && !hideSanjuuRecruitmentSection ? (
            <>
              <SanjuuBrandHeading as="h1" />
              <RenrakuchoSanjuuPlaySection />
            </>
          ) : null}

          {!hideBelowCreatePanel ? <RenrakuchoBoardNotice /> : null}

          {!hideBelowCreatePanel && myPrivateVisible.length > 0 ? (
            <div className="space-y-2">
              <p className="mt-[0.3em] text-[15px] font-black uppercase tracking-widest text-rk-amber-950 px-1 scroll-mt-4">
                📋 あなたが送った伝言
              </p>
              <p className="px-1 text-[10px] font-bold leading-relaxed text-rk-amber-900/90">
                らくだへの伝言と、返信（あなただけに表示）です。
              </p>
              <div className="space-y-2">
                {myPrivateVisible.map((m) => {
                  const replyMsg = resolveRenrakuPrivateReplyText(m, privateReplyByMessageId[m.id]);
                  const senderEmoji = String((m as any).fromUserEmoji ?? '').trim();
                  const senderName = String((m as any).fromUser ?? 'ななしさん').trim() || 'ななしさん';
                  return (
                    <div key={m.id} className="rounded-xl border border-rk-slate-200 bg-rk-white px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black text-rk-slate-500">
                            {formatFirestoreTimeJa((m as any).createdAt)}
                          </div>
                          <div className="mt-1 text-[10px] font-black text-rk-slate-600">
                            <span className="text-rk-slate-500">差出人</span>{' '}
                            <span className="text-rk-slate-900" title={senderName}>
                              {senderEmoji ? <span className="mr-0.5">{senderEmoji}</span> : null}
                              {senderName}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDelete(String(m.id), 'private')}
                          className="p-2 text-rk-slate-600 hover:text-rk-rose-600 transition-colors rounded-xl border border-rk-slate-200 bg-rk-white hover:bg-rk-slate-50 shrink-0"
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <RenrakuMessageBody
                        text={String((m as any).message ?? '')}
                        className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-rk-slate-800 break-words"
                      />
                      <RenrakuCopyTextButton
                        text={String((m as any).message ?? '')}
                        variant="link"
                        className="mt-1"
                      />
                      {replyMsg ? (
                        <div className="mt-2 rounded-xl border border-rk-amber-200 bg-rk-amber-50 px-3 py-2">
                          <div className="text-[10px] font-black text-rk-amber-900">らくだ珈琲🐫☕からの返信</div>
                          <p className="mt-0.5 text-[9px] font-bold text-rk-amber-800/90">※あなただけが見られます</p>
                          <RenrakuMessageBody
                            text={replyMsg}
                            className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-rk-amber-950 break-words"
                          />
                          <RenrakuCopyTextButton text={replyMsg} variant="link" className="mt-1" />
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] font-bold text-rk-slate-500 leading-relaxed">
                          返信はこのアカウントで見られます。表示まで数秒かかることがあります。
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!hideBelowCreatePanel ? (
            !publicTimelineHydrated ? (
              <p className="mt-3 px-1 text-center text-[11px] font-bold text-rk-slate-500">掲示板を読み込み中…</p>
            ) : (
              <>
                <p
                  id="renraku-public-timeline"
                  className="mt-[0.3em] text-[15px] font-black uppercase tracking-widest text-rk-amber-950 px-1 scroll-mt-4"
                >
                  📝タイムライン（掲示・募集・探しもの）
                </p>
                {sortedPublicItems.length > 0 ? (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {publicCards}
                  </AnimatePresence>
                ) : (
                  <p className="px-1 py-6 text-center text-xs font-bold text-rk-slate-500 leading-relaxed">
                    まだ投稿はありません。下のフォームから「掲示板にのせる」で最初の投稿をどうぞ。
                  </p>
                )}
              </>
            )
          ) : null}
        </motion.div>
      )}

      <HundredFlow
        publicScreen={publicScreen}
        selectedHundred={selectedHundred}
        nickname={nickname}
        userEmoji={userEmoji}
        currentUid={currentUid}
        setPublicScreen={setPublicScreen}
        onStartHundred={onStartHundred}
        streamMode={streamMode}
        onCloseHundredRecruitment={onCloseHundredRecruitment}
        onHundredGenerationCancelled={onHundredGenerationCancelled}
        hundredRoomMetaByRoomId={hundredRoomMetaByRoomId}
        nowMs={now}
      />
    </>
  );
};

export default PublicScreen;

