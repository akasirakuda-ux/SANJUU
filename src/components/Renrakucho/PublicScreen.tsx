import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TILE_MATCH_HUNDRED_MODE, RAKUDA_TILE_MATCH_CREATE_FRAGMENT } from '../../lib/tileMatch/config';
import {
  RAKUDA_HUNDRED_CREATE_FRAGMENT,
  firestoreLikeToMillis,
  formatFirestoreTimeJa,
  hundredDisplayDeadlineMs,
  hundredRecruitHasOpenDeadline,
  isHundredOpenRecruitSessionEnded,
  isHundredBetweenRounds,
  isHundredRoomInPlayOrStarting,
  resolveRenrakuPrivateReplyText,
  shouldHideFromSanjuuRecruitBoard,
  type RenrakuPrivateReplyPayload,
} from '../../lib/rakudaHubShell';
import { loadHundredRestoreSession, saveHundredRestoreSession } from '../../lib/rakudaHundredRestore';
import {
  parseRenrakuBoardPostIdFromHash,
  renrakuBoardPostElementId,
} from '../../lib/renrakuReport';
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
import {
  isPublicMessageAnnouncement,
  RENRAKU_ANNOUNCEMENTS_TIMELINE_ELEMENT_ID,
  RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS,
  RENRAKU_BOARD_TIMELINE_TAB_CHAT,
  RENRAKU_CHAT_TIMELINE_ELEMENT_ID,
  type RenrakuBoardTimelineTab,
} from '../../lib/renrakuBoardPostKind';

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
  if (hundredRecruitHasOpenDeadline(item, room)) {
    return isHundredOpenRecruitSessionEnded(item, room, now);
  }
  if (st === 'playing' || st === 'started') return false;
  const dl = hundredDeadlineMs(item, room);
  return dl !== null && now > dl;
}

function hundredSortRank(item: HundredPublicRecruit, room: HundredRoomListMeta | undefined, now: number): 1 | 2 | 3 {
  if (item.roboPickupLounge) return 1;
  const st = room?.status ?? 'recruiting';
  if (st === 'finished' || st === 'cancelled') return 3;
  if (isHundredRoomInPlayOrStarting(room)) return 2;
  const dl = hundredDeadlineMs(item, room);
  const expired = dl !== null && now > dl;
  if (!expired && st === 'recruiting') return 1;
  // 期限切れ / その他は最下部
  return 3;
}

const PublicScreen: React.FC<{
  publicScreen: string;
  setPublicScreen: React.Dispatch<
    React.SetStateAction<'list' | 'closed' | 'hundred-detail' | 'hundred-wait' | 'hundred-board'>
  >;
  hundredRoomMetaByRoomId: Record<string, HundredRoomListMeta>;
  /** getDoc 済みで `hundred_rooms` が無い roomId（掲示だけ残った終了募集） */
  hundredMissingRoomIds?: Set<string>;
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
  onJoinBoardGameRecruit?: (kind: 'reversi' | 'gomoku', roomCode: string) => void;
  onStartHundred: (roomId: string) => void;
  onJoinHundredRecruit?: (recruit: HundredPublicRecruit) => void;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  onCloseHundredRecruitment: () => void | Promise<void>;
  onHundredGenerationCancelled?: () => void;
  /** `/keijiban` から入ったとき 30 募集ブロックを出さない */
  hideSanjuuRecruitmentSection?: boolean;
  /** `/hundred#rk-*-create` 直リンク時のみタイムライン等を隠す（募集一覧は `/hundred` でも表示） */
  hideBulletinBelowCreate?: boolean;
  /** false の間は「投稿なし」プレースホルダを出さない（初回取得前のチラつき防止） */
  publicTimelineHydrated?: boolean;
  /** 掲示板タブ: 連絡事項 / みんなの会話 */
  boardTimelineTab: RenrakuBoardTimelineTab;
  setBoardTimelineTab: React.Dispatch<React.SetStateAction<RenrakuBoardTimelineTab>>;
  ensureAuth: () => Promise<void>;
  onIssueYellowCard?: (userId: string, userName: string) => void | Promise<void>;
  onIssueRedCard?: (userId: string, userName: string) => void | Promise<void>;
  /** 募集作成直後に一覧 state へ即反映（Firestore 購読待ちの空白を防ぐ） */
  upsertPublicHundred?: (recruit: HundredPublicRecruit) => void;
}> = ({
  publicScreen,
  setPublicScreen,
  hundredRoomMetaByRoomId,
  hundredMissingRoomIds,
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
  onJoinBoardGameRecruit,
  onStartHundred,
  onJoinHundredRecruit,
  streamMode = false,
  onCloseHundredRecruitment,
  onHundredGenerationCancelled,
  hideSanjuuRecruitmentSection = false,
  hideBulletinBelowCreate = false,
  publicTimelineHydrated = false,
  boardTimelineTab,
  setBoardTimelineTab,
  ensureAuth,
  onIssueYellowCard,
  onIssueRedCard,
  upsertPublicHundred,
}) => {
  const [now, setNow] = useState(() => Date.now());

  /** `/hundred#rk-hundred-create` — ひと言探しの作成フォームのみ */
  const atPickupCreateFocus =
    publicScreen === 'list' &&
    typeof window !== 'undefined' &&
    window.location.hash === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`;

  const hideBelowCreatePanel = atPickupCreateFocus || hideBulletinBelowCreate;

  // 期限が来た瞬間に「締切」へ & 並び替えが走るようにする
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), streamMode ? 5000 : 1000);
    return () => window.clearInterval(t);
  }, [streamMode]);

  /** 作成フォーム直リンク時にスクロール */
  useLayoutEffect(() => {
    if (publicScreen !== 'list') return;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === `#${RAKUDA_TILE_MATCH_CREATE_FRAGMENT}` || hash.endsWith(`#${RAKUDA_TILE_MATCH_CREATE_FRAGMENT}`)) {
      try {
        const u = new URL(window.location.href);
        u.hash = '';
        window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`);
      } catch {
        /* ignore */
      }
      return;
    }
    const anchorId =
      hash === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}` || hash.endsWith(`#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`)
        ? RAKUDA_HUNDRED_CREATE_FRAGMENT
        : null;
    if (!anchorId) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [publicScreen]);

  /**
   * 掲示板の hundred_public 一覧: 取消・終了・満員・締切は三十募集板と同じく即非表示。
   * （中止後も「募集中」のまま残る不具合対策 — room メタを見る）
   */
  const hundredVisibleForList = useMemo(
    () =>
      publicHundred.filter((h) => {
        if (h.hundredMode === TILE_MATCH_HUNDRED_MODE) return false;
        const room = h.roomId ? hundredRoomMetaByRoomId[h.roomId] : undefined;
        const roomDocMissing = !!(h.roomId && hundredMissingRoomIds?.has(h.roomId));
        return !shouldHideFromSanjuuRecruitBoard(h, room, now, { roomDocMissing });
      }),
    [publicHundred, hundredRoomMetaByRoomId, hundredMissingRoomIds, now]
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
    const isAnnouncementsTab = boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS;

    const matchesTab = (item: { type?: string; postKind?: unknown }) => {
      if (isAnnouncementsTab) {
        return item.type === 'community' && isPublicMessageAnnouncement(item);
      }
      if (item.type === 'private') return isAdmin;
      if (item.type === 'recruit') return true;
      if (item.type === 'community') {
        return !isPublicMessageAnnouncement(item);
      }
      return true;
    };

    const other = [...publicMessages]
      .filter(matchesTab)
      .slice()
      .sort((a: any, b: any) => {
        if (isAnnouncementsTab) {
          const pinA = a.pinned === true ? 1 : 0;
          const pinB = b.pinned === true ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
        }
        return createdAtMs(b) - createdAtMs(a);
      });

    if (isAnnouncementsTab) {
      return other;
    }

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
  }, [sortedHundredForList, publicMessages, hundredRoomMetaByRoomId, now, boardTimelineTab, isAdmin]);

  const scrollToBoardPostFromHash = useCallback(() => {
    if (publicScreen !== 'list') return false;
    const postId = parseRenrakuBoardPostIdFromHash();
    if (!postId) return false;
    const el = document.getElementById(renrakuBoardPostElementId(postId));
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }, [publicScreen]);

  /** 通報確認など `#rk-board-post-{id}` 直リンクで該当投稿へスクロール */
  useLayoutEffect(() => {
    if (publicScreen !== 'list' || !publicTimelineHydrated) return;
    if (!parseRenrakuBoardPostIdFromHash()) return;
    const raf = window.requestAnimationFrame(() => {
      scrollToBoardPostFromHash();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [publicScreen, publicTimelineHydrated, sortedPublicItems.length, scrollToBoardPostFromHash]);

  useEffect(() => {
    const onHashChange = () => {
      scrollToBoardPostFromHash();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [scrollToBoardPostFromHash]);

  const myPrivateVisible = useMemo(() => {
    return [...myPrivateMessages].slice().sort((a: any, b: any) => createdAtMs(b) - createdAtMs(a));
  }, [myPrivateMessages]);

  const hundredRejoinRestore = useMemo(() => {
    if (publicScreen !== 'list') return null;
    const restored = loadHundredRestoreSession();
    if (restored?.publicScreen !== 'hundred-wait' || !restored.selectedHundred?.roomId) return null;
    const item = restored.selectedHundred;
    const room = item.roomId ? hundredRoomMetaByRoomId[item.roomId] : undefined;
    const roomDocMissing = !!(item.roomId && hundredMissingRoomIds?.has(item.roomId));
    if (roomDocMissing) return null;
    const st = room?.status ?? 'recruiting';
    if (st === 'finished' || st === 'cancelled') return null;
    if (isHundredOpenRecruitSessionEnded(item, room, now)) return null;
    if (isHundredBetweenRounds(room) || isHundredRoomInPlayOrStarting(room)) return item;
    return null;
  }, [publicScreen, hundredRoomMetaByRoomId, hundredMissingRoomIds, now]);

  const hundredRejoinBetweenRounds = useMemo(
    () =>
      hundredRejoinRestore?.roomId
        ? isHundredBetweenRounds(hundredRoomMetaByRoomId[hundredRejoinRestore.roomId])
        : false,
    [hundredRejoinRestore, hundredRoomMetaByRoomId],
  );

  const handleSelectHundred = useCallback(
    (item: HundredPublicRecruit) => {
      setSelectedHundred(item);
      if (onJoinHundredRecruit) {
        onJoinHundredRecruit(item);
        return;
      }
      setPublicScreen('hundred-wait');
      saveHundredRestoreSession({ publicScreen: 'hundred-wait', selectedHundred: item });
    },
    [onJoinHundredRecruit, setSelectedHundred, setPublicScreen],
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
            isAdmin={isAdmin}
            onIssueYellowCard={onIssueYellowCard}
            onIssueRedCard={onIssueRedCard}
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
          onJoinBoardGameRecruit={onJoinBoardGameRecruit}
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
    onJoinBoardGameRecruit,
    isAdmin,
    currentUid,
    handleBulkBlockAuthorPosts,
    isBoardInteractionBlocked,
    onTogglePostReaction,
    onToggleBoardPin,
    onIssueYellowCard,
    onIssueRedCard,
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
          {!hideSanjuuRecruitmentSection && (!hideBelowCreatePanel || atPickupCreateFocus) ? (
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
                variant="pickup"
                nickname={nickname}
                userEmoji={userEmoji}
                currentUid={currentUid}
                isBoardInteractionBlocked={isBoardInteractionBlocked}
                ensureAuth={ensureAuth}
                onCreatedRecruit={(recruit) => {
                  upsertPublicHundred?.(recruit);
                  setSelectedHundred(recruit);
                  if (onJoinHundredRecruit) {
                    onJoinHundredRecruit(recruit);
                  } else {
                    setPublicScreen('hundred-wait');
                    saveHundredRestoreSession({ publicScreen: 'hundred-wait', selectedHundred: recruit });
                  }
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

          {hundredRejoinRestore ? (
            <div className="rounded-xl border-2 border-rk-hundred-recruit bg-rk-amber-50/90 px-3 py-3">
              <p className="text-xs font-bold text-rk-slate-700 leading-snug">
                {hundredRejoinBetweenRounds
                  ? '前のお題はおわりました。次のお題を待てます（出入り自由）'
                  : '進行中のひと言探しがあります（出入り自由・途中参加OK）'}
              </p>
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-rk-hundred-recruit px-3 py-2.5 text-sm font-black text-rk-white"
                onClick={() => handleSelectHundred(hundredRejoinRestore)}
              >
                「{hundredRejoinRestore.targetWord || 'お題'}」の募集に戻る
              </button>
            </div>
          ) : null}

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
                <div
                  className="mt-[0.3em] flex gap-1 p-1 rounded-xl border-2 border-[var(--rk-hub-bark)] bg-rk-white shadow-sm"
                  role="tablist"
                  aria-label="掲示板の表示切り替え"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS}
                    aria-controls={RENRAKU_ANNOUNCEMENTS_TIMELINE_ELEMENT_ID}
                    onClick={() => setBoardTimelineTab(RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS)}
                    className={`flex-1 min-h-[44px] rounded-lg px-2 text-xs font-black transition-colors ${
                      boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS
                        ? 'bg-rk-sky-100 text-rk-sky-950 border border-rk-sky-300 shadow-sm'
                        : 'bg-transparent text-rk-slate-600 hover:bg-rk-slate-50'
                    }`}
                  >
                    📢 連絡事項
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_CHAT}
                    aria-controls={RENRAKU_CHAT_TIMELINE_ELEMENT_ID}
                    onClick={() => setBoardTimelineTab(RENRAKU_BOARD_TIMELINE_TAB_CHAT)}
                    className={`flex-1 min-h-[44px] rounded-lg px-2 text-xs font-black transition-colors ${
                      boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_CHAT
                        ? 'bg-rk-amber-100 text-rk-amber-950 border border-rk-amber-300 shadow-sm'
                        : 'bg-transparent text-rk-slate-600 hover:bg-rk-slate-50'
                    }`}
                  >
                    💬 みんなの会話
                  </button>
                </div>

                <p
                  id={
                    boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS
                      ? RENRAKU_ANNOUNCEMENTS_TIMELINE_ELEMENT_ID
                      : RENRAKU_CHAT_TIMELINE_ELEMENT_ID
                  }
                  className="mt-2 text-[15px] font-black uppercase tracking-widest text-rk-amber-950 px-1 scroll-mt-4"
                >
                  {boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS
                    ? '📢 らくだ珈琲からの連絡'
                    : '📝 タイムライン（掲示・募集・探しもの）'}
                </p>
                {sortedPublicItems.length > 0 ? (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {publicCards}
                  </AnimatePresence>
                ) : (
                  <p className="px-1 py-6 text-center text-xs font-bold text-rk-slate-500 leading-relaxed">
                    {boardTimelineTab === RENRAKU_BOARD_TIMELINE_TAB_ANNOUNCEMENTS
                      ? '連絡事項はまだありません。'
                      : 'まだ投稿はありません。下のフォームから「掲示板にのせる」で最初の投稿をどうぞ。'}
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
        onJoinHundredRecruit={onJoinHundredRecruit}
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

