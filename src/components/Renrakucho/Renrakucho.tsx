import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import {
  cleanupStalePublicMessages,
  ensureRenrakuAdminFirestoreAuth,
  fetchRenrakuPrivateForAdmin,
  firestoreLikeToMillis,
  getAuthLoginDisplay,
  isGoogleSignedInUser,
  isRenrakuAdmin,
  isRenrakuEntryVisible,
  normalizeHundredGameTimeLimitSec,
  pickEffectiveAuthUser,
  renrakuAdminBlockedFields,
  renrakuAdminSoftDeleteFields,
  renrakuPrivateReplyRef,
  RENRAKU_PRIVATE_INBOX_RAKUDA,
  RENRAKU_STATUS_ACTIVE,
  RENRAKU_VALIDATION_ERROR_MESSAGE,
  sortRenrakuPrivateMessagesNewestFirst,
  validateRenrakuPost,
  type RenrakuPrivateReplyPayload,
  RAKUDA_HUNDRED_CREATE_FRAGMENT,
  sanjuuRecruitBoardUrlWithRakudaProfile,
} from '../../lib/rakudaHubShell';
import { applyHostCancelledHundredGeneration, hundredPublicListingDocId } from '../../lib/hundredRecruitCancel';
import { clearHundredRestoreSession, saveHundredRestoreSession } from '../../lib/rakudaHundredRestore';
import {
  ActiveUser,
  BlockedUser,
  HundredPublicRecruit,
  type HundredRoomListMeta,
  Message,
  OperationType,
  FirestoreErrorInfo,
  type AdminPrivateInboxLoadState,
  type RenrakuchoPublicScreenState,
} from './types';
import PostScreen from './PostScreen';
import PublicScreen from './PublicScreen';
import AdminScreen from './AdminScreen';
import RenrakuchoLayout from './RenrakuchoLayout';
import { RK_RENRAKU_LAST_SEEN_MS_KEY } from '../../hooks/useRenrakuchoUnreadBadge';
import { useActiveUserPlayRecruitBadges } from '../../hooks/useActiveUserPlayRecruitBadges';
import {
  readRenrakuOnBreakLocal,
  setRenrakuPresenceBreak,
  writeRenrakuOnBreakLocal,
} from '../../lib/renrakuPresenceBreak';

/** `renraku_presence` の Heartbeat が 2 分のため、それより短い TTL だと一覧から一瞬消える。余裕を持って 5 分 */
const RENRRAKU_ACTIVE_MAX_AGE_MS = 5 * 60 * 1000;

const RENRAKU_RESUME_KEY = 'rk_renraku_resume';

const FIRESTORE_BATCH_LIMIT = 500;

async function adminBatchSetBlockedByAuthorUid(
  collectionPath: string,
  authorUid: string,
  fields: ReturnType<typeof renrakuAdminBlockedFields>
): Promise<number> {
  const qRef = query(collection(db, collectionPath), where('fromUserUid', '==', authorUid));
  const snap = await getDocs(qRef);
  const docs = snap.docs;
  let total = 0;
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const d of slice) {
      batch.update(d.ref, fields);
    }
    await batch.commit();
    total += slice.length;
  }
  return total;
}

const RESUMABLE_PUBLIC_SCREENS: readonly RenrakuchoPublicScreenState[] = [
  'list',
  'closed',
  'hundred-detail',
  'hundred-wait',
  'hundred-board',
];

interface RenrakuchoProps {
  onBack: () => void;
  nickname: string;
  userEmoji: string;
  setUserEmoji: (e: string) => void;
  setNickname: (n: string) => void;
  onJoinRoom?: (roomId: string) => void;
  onStartHundred: (roomId: string) => void;
  ensureAuth: () => Promise<void>;
  initialActiveTab?: 'post' | 'public' | 'admin';
  initialPublicScreen?: RenrakuchoPublicScreenState;
  /** ゲームへ進む直前に保存した募集の復元（待機・盤面へ戻す） */
  initialSelectedHundred?: HundredPublicRecruit | null;
  /** 連絡帳メインタブ内バナー（グローバルと共有。かんりタブでは使わない） */
  isAdVisible?: boolean;
  setIsAdVisible?: (visible: boolean) => void;
  viewerCount?: number;
  /** 配信/低負荷モード（YouTube Live 安定化用） */
  streamMode?: boolean;
  /** App シェルの Auth（Renrakucho 内 onAuthStateChanged より先に確定していることがある） */
  shellFirebaseUser?: User | null;
  /** 管理者が伝言を読めないときの Google 再ログイン */
  onRequestGoogleLogin?: () => void;
}


const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
};

const Renrakucho: React.FC<RenrakuchoProps> = ({
  onBack,
  nickname,
  userEmoji,
  setUserEmoji,
  setNickname,
  onJoinRoom,
  onStartHundred,
  ensureAuth,
  initialActiveTab,
  initialPublicScreen,
  initialSelectedHundred,
  isAdVisible = true,
  setIsAdVisible,
  viewerCount,
  streamMode = false,
  shellFirebaseUser = null,
  onRequestGoogleLogin,
}) => {
  // 画面遷移 state
  const [activeTab, setActiveTab] = useState<'main' | 'admin'>(() =>
    initialActiveTab === 'admin' ? 'admin' : 'main'
  );
  const [publicScreen, setPublicScreen] = useState<RenrakuchoPublicScreenState>(initialPublicScreen ?? 'list');

  /** 掲示板一覧表示中だけタイムライン系を購読（待機/盤面では HundredWaitPanel 等に任せ Listen 負荷を抑える） */
  const subscribePublicTimeline = activeTab === 'main' && publicScreen === 'list';

  // 選択 state（画面遷移に紐づく）
  const [selectedHundred, setSelectedHundred] = useState<HundredPublicRecruit | null>(
    () => initialSelectedHundred ?? null
  );
  /** みんなであそぶ待機・盤面で問題生成中（下部「メッセージを送る」を隠す） */
  const [hundredProblemsGenerating, setHundredProblemsGenerating] = useState(false);

  // 投稿 state
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  /** 投稿成功直後の連打防止（5 秒） */
  const [sendCooldownUntilMs, setSendCooldownUntilMs] = useState(0);
  const RENRAKU_POST_COOLDOWN_MS = 5000;

  /** 掲示板（public_messages） */
  const [boardMessages, setBoardMessages] = useState<Message[]>([]);
  /** ルーム募集のみ（renraku_public の type===recruit） */
  const [recruitMessages, setRecruitMessages] = useState<Message[]>([]);
  const [publicHundred, setPublicHundred] = useState<HundredPublicRecruit[]>([]);
  const [hundredRoomMetaByRoomId, setHundredRoomMetaByRoomId] = useState<Record<string, HundredRoomListMeta>>({});
  /** らくだ先生宛（renraku_private）— 管理者タブ＆管理者タイムライン用 */
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  /** 自分の伝言（renraku_private where fromUserUid==me） */
  const [myPrivateMessages, setMyPrivateMessages] = useState<Message[]>([]);
  /** 伝言への返信本文（private_reply/sender — 差出人のみ read 可） */
  const [privateReplyByMessageId, setPrivateReplyByMessageId] = useState<
    Record<string, RenrakuPrivateReplyPayload>
  >({});
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [myOnBreak, setMyOnBreak] = useState(() => readRenrakuOnBreakLocal());
  const [breakToggleBusy, setBreakToggleBusy] = useState(false);
  const [breakPopupOpen, setBreakPopupOpen] = useState(false);
  /** タイムライン3系の初回取得完了（空配列のまま「投稿なし」を出さないため） */
  const [publicTimelineHydrated, setPublicTimelineHydrated] = useState(false);
  const timelineHydrationRef = useRef({ board: false, recruit: false, hundred: false });

  const markTimelineHydration = useCallback((key: 'board' | 'recruit' | 'hundred') => {
    timelineHydrationRef.current[key] = true;
    // 3系すべて待つと空白の見出しだけが一瞬出るため、1系でも返れば表示してよい
    setPublicTimelineHydrated(true);
  }, []);

  useEffect(() => {
    timelineHydrationRef.current = { board: false, recruit: false, hundred: false };
    setPublicTimelineHydrated(false);
  }, [streamMode]);

  /** Firestore が返らないときも掲示板 UI を出す（無限に空白のままにしない） */
  useEffect(() => {
    if (publicTimelineHydrated) return;
    const t = window.setTimeout(() => setPublicTimelineHydrated(true), 4500);
    return () => window.clearTimeout(t);
  }, [publicTimelineHydrated, streamMode]);

  const joinHundredPublicConsumedRef = useRef(false);
  useEffect(() => {
    if (joinHundredPublicConsumedRef.current) return;
    let joinId = '';
    try {
      joinId = (new URLSearchParams(window.location.search).get('joinHundredPublic') || '').trim();
    } catch {
      joinId = '';
    }
    if (!joinId) return;

    const stripJoinParam = () => {
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('joinHundredPublic');
        window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
      } catch {
        /* ignore */
      }
    };

    const applyJoin = (item: HundredPublicRecruit) => {
      if (joinHundredPublicConsumedRef.current) return;
      if (!item.roomId) {
        joinHundredPublicConsumedRef.current = true;
        stripJoinParam();
        window.dispatchEvent(
          new CustomEvent('SHOW_TOAST', { detail: 'この募集は参加できません（ルーム情報がありません）。' })
        );
        return;
      }
      joinHundredPublicConsumedRef.current = true;
      clearHundredRestoreSession();
      setActiveTab('main');
      setSelectedHundred(item);
      setPublicScreen('hundred-wait');
      stripJoinParam();
    };

    const cached = publicHundred.find((h) => h.id === joinId);
    if (cached) {
      applyJoin(cached);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'hundred_public', joinId));
        if (cancelled || joinHundredPublicConsumedRef.current) return;
        if (!snap.exists()) {
          joinHundredPublicConsumedRef.current = true;
          stripJoinParam();
          window.dispatchEvent(
            new CustomEvent('SHOW_TOAST', {
              detail: 'この募集は見つかりませんでした（終了した可能性があります）。',
            })
          );
          return;
        }
        const x = snap.data() as Record<string, unknown>;
        applyJoin({
          id: snap.id,
          type: 'hundred',
          targetWord: typeof x.targetWord === 'string' ? x.targetWord : '',
          boardSize: typeof x.boardSize === 'number' ? x.boardSize : Number(x.boardSize) || 0,
          boardCols: typeof x.boardCols === 'number' ? x.boardCols : undefined,
          boardRows: typeof x.boardRows === 'number' ? x.boardRows : undefined,
          createdAt: x.createdAt,
          roomId: typeof x.roomId === 'string' ? x.roomId : undefined,
          hostUid: typeof x.hostUid === 'string' ? x.hostUid : undefined,
          hostNickname: typeof x.hostNickname === 'string' ? x.hostNickname : undefined,
          hostEmoji: typeof x.hostEmoji === 'string' ? x.hostEmoji : undefined,
          recruitDeadlineAt: x.recruitDeadlineAt,
          gameTimeLimitSec: typeof x.gameTimeLimitSec === 'number' ? x.gameTimeLimitSec : undefined,
        });
      } catch (e) {
        console.warn('[Renrakucho] joinHundredPublic fetch failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicHundred]);

  // UI 表示 state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(!(nickname && userEmoji));
  const [tempName, setTempName] = useState(nickname || '');
  const [tempEmoji, setTempEmoji] = useState(userEmoji || '');
  const hasProfile = !!(nickname && nickname.trim() && userEmoji && userEmoji.trim());

  const [pathSync, setPathSync] = useState(0);
  useEffect(() => {
    const bump = () => setPathSync((n) => n + 1);
    window.addEventListener('popstate', bump);
    return () => window.removeEventListener('popstate', bump);
  }, []);

  /** `/keijiban` 直リンク時は見出しを「掲示板」にし、30 募集ブロックは出さない */
  const isKeijibanPath = useMemo(() => {
    void pathSync;
    try {
      const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      return path === '/keijiban' || path.endsWith('/keijiban');
    } catch {
      return false;
    }
  }, [pathSync]);

  /** `/hundred` 直リンク（３０の問題を作るハブ） */
  const isHundredHubPath = useMemo(() => {
    void pathSync;
    try {
      const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      return path === '/hundred' || path.endsWith('/hundred');
    } catch {
      return false;
    }
  }, [pathSync]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RENRAKU_RESUME_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { publicScreen?: string };
      const ps = data?.publicScreen;
      if (typeof ps === 'string' && (RESUMABLE_PUBLIC_SCREENS as readonly string[]).includes(ps)) {
        setPublicScreen(ps as RenrakuchoPublicScreenState);
      }
      sessionStorage.removeItem(RENRAKU_RESUME_KEY);
    } catch {
      sessionStorage.removeItem(RENRAKU_RESUME_KEY);
    }
  }, []);

  const [authUser, setAuthUser] = useState(() => auth.currentUser);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setAuthUser);
    return () => unsub();
  }, []);

  const effectiveAuthUser = useMemo(
    () => pickEffectiveAuthUser(authUser, shellFirebaseUser),
    [authUser, shellFirebaseUser]
  );
  /** 伝言は Google のみで送る → 返信はアカウント単位で追跡でき、端末違いの説明を利用者に求めない */
  const canSendPrivateDenwa = useMemo(() => isGoogleSignedInUser(effectiveAuthUser), [effectiveAuthUser]);
  const [adminPrivateLoadState, setAdminPrivateLoadState] = useState<AdminPrivateInboxLoadState>('idle');
  const [adminPrivateReloadTick, setAdminPrivateReloadTick] = useState(0);

  useEffect(() => {
    if (publicScreen !== 'hundred-wait' && publicScreen !== 'hundred-board') return;
    void import('../GameScreen');
  }, [publicScreen]);

  useEffect(() => {
    const roomId = selectedHundred?.roomId;
    const trackGen =
      (publicScreen === 'hundred-wait' || publicScreen === 'hundred-board') && !!roomId;
    if (!trackGen) {
      setHundredProblemsGenerating(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'hundred_rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setHundredProblemsGenerating(false);
          return;
        }
        const d = snap.data() as { problemsGenerating?: boolean } | undefined;
        setHundredProblemsGenerating(d?.problemsGenerating === true);
      },
      () => setHundredProblemsGenerating(false)
    );
    return () => unsub();
  }, [publicScreen, selectedHundred?.roomId]);

  const isAdmin = useMemo(() => isRenrakuAdmin(effectiveAuthUser), [effectiveAuthUser]);
  const needsGoogleLoginBar = useMemo(() => {
    const auth = getAuthLoginDisplay(effectiveAuthUser, true);
    return auth.tone !== 'google';
  }, [effectiveAuthUser]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!effectiveAuthUser?.uid) return;
    console.info(
      '[Renrakucho] Firebase Auth UID（src/constants/renrakuAdmin.ts の ADMIN_UIDS と firestore.rules の isRenrakuAdminUid に同じ値を設定）:',
      effectiveAuthUser.uid,
      effectiveAuthUser.email ?? '(emailなし)'
    );
  }, [effectiveAuthUser?.uid, effectiveAuthUser?.email]);

  /** 論理削除・ブロック済みの非公開伝言は一覧・未読に含めない */
  const visiblePrivateMessages = useMemo(
    () => privateMessages.filter(isRenrakuEntryVisible),
    [privateMessages]
  );

  /** 管理者が伝言一覧に載せたあと、同じ id を何度も自動既読にしない（手動「未読」後も再自動しない） */
  const adminPrivateAutoReadOnceRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isAdmin) return;
    const pending = visiblePrivateMessages.filter(
      (m) => isRenrakuEntryVisible(m) && !m.isRead && !adminPrivateAutoReadOnceRef.current.has(m.id)
    );
    if (pending.length === 0) return;
    let cancelled = false;
    const tid = window.setTimeout(() => {
      if (cancelled) return;
      void Promise.all(
        pending.map((m) =>
          updateDoc(doc(db, 'renraku_private', m.id), { isRead: true })
            .then(() => {
              adminPrivateAutoReadOnceRef.current.add(m.id);
            })
            .catch((e) => {
              console.warn('[Renrakucho] admin auto-read failed', m.id, e);
            })
        )
      );
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [isAdmin, visiblePrivateMessages]);

  /** タイムライン用: 掲示・募集に加え、管理者のみ非公開伝言をマージ（createdAt はミリ秒で統一してソート） */
  const publicMessages = useMemo(() => {
    const priv = isAdmin ? visiblePrivateMessages.map((m) => ({ ...m, type: 'private' as const })) : [];
    const merged = [...boardMessages, ...recruitMessages, ...priv];
    return merged.sort((a, b) => {
      const ta = firestoreLikeToMillis(a.createdAt);
      const tb = firestoreLikeToMillis(b.createdAt);
      const ma = ta != null && Number.isFinite(ta) ? ta : 0;
      const mb = tb != null && Number.isFinite(tb) ? tb : 0;
      return mb - ma;
    });
  }, [boardMessages, recruitMessages, visiblePrivateMessages, isAdmin]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const privN = isAdmin ? visiblePrivateMessages.length : 0;
    console.log('[Renrakucho] タイムライン統合', {
      public_messages: boardMessages.length,
      'renraku_public(募集)': recruitMessages.length,
      'renraku_private(表示のみ)': privN,
      マージ後総件数: publicMessages.length,
      isAdmin,
      privateMessagesState件数: privateMessages.length,
    });
  }, [
    boardMessages.length,
    recruitMessages.length,
    visiblePrivateMessages.length,
    privateMessages.length,
    publicMessages.length,
    isAdmin,
  ]);

  // 連絡帳を開いたら「最終閲覧」時刻を更新（ハブの未読バッジ用）
  useEffect(() => {
    try {
      localStorage.setItem(RK_RENRAKU_LAST_SEEN_MS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('rk-renraku-seen'));
  }, []);

  // 掲示板（public_messages）の 30 日超え投稿をバックグラウンドで整理（ピン留め除く）。削除はルール上管理者のみ。
  useEffect(() => {
    if (streamMode) return;
    if (!authUser) return;
    if (!isAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        await cleanupStalePublicMessages(db);
      } catch (e) {
        if (!cancelled) console.warn('[public_messages cleanup]', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isAdmin]);

  // Firestore 購読（Presence: Register user）
  useEffect(() => {
    if (!authUser || showProfileSetup) return;

    const presenceUid = authUser.uid;
    const presenceRef = doc(db, 'renraku_presence', presenceUid);
    const registerPresence = async () => {
      if (auth.currentUser?.uid !== presenceUid) return;
      try {
        await setDoc(presenceRef, {
          uid: presenceUid,
          name: nickname,
          emoji: userEmoji,
          lastActive: serverTimestamp(),
          onBreak: myOnBreak,
        });
      } catch (error) {
        console.error('Error registering presence:', error);
      }
    };

    registerPresence();

    // Heartbeat:
    // - normal: 2 min
    // - streamMode: less frequent to reduce load, but keep "今いる人" meaningful
    const intervalMs = streamMode ? 5 * 60 * 1000 : 2 * 60 * 1000;
    const interval = setInterval(registerPresence, intervalMs);

    return () => {
      clearInterval(interval);
      // ログアウト直後や UID 切替後は rules で delete 不可 — 5 分で一覧から自然消滅するので黙ってスキップ
      if (auth.currentUser?.uid !== presenceUid) return;
      void deleteDoc(presenceRef).catch((e: unknown) => {
        const code =
          typeof e === 'object' && e !== null && 'code' in e ? String((e as { code?: string }).code) : '';
        if (code === 'permission-denied') return;
        console.warn('Error removing presence:', e);
      });
    };
  }, [authUser, nickname, userEmoji, showProfileSetup, streamMode, myOnBreak]);

  const toggleMyBreak = useCallback(async () => {
    if (!authUser || showProfileSetup || breakToggleBusy) return;
    const next = !myOnBreak;
    setMyOnBreak(next);
    writeRenrakuOnBreakLocal(next);
    setBreakToggleBusy(true);
    try {
      await setRenrakuPresenceBreak(authUser.uid, next);
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', {
          detail: next
            ? '休憩中と掲示板に伝えました（らくだにいますが、いま画面は見ていません）'
            : '戻りました',
        }),
      );
    } catch (e) {
      setMyOnBreak(!next);
      writeRenrakuOnBreakLocal(!next);
      console.error('Error toggling break:', e);
      window.dispatchEvent(
        new CustomEvent('SHOW_TOAST', { detail: '休憩の切り替えに失敗しました' }),
      );
    } finally {
      setBreakToggleBusy(false);
    }
  }, [authUser, breakToggleBusy, myOnBreak, showProfileSetup]);

  // Firestore 購読（Presence: Listen to active users）
  useEffect(() => {
    if (!subscribePublicTimeline) return;
    const q = query(collection(db, 'renraku_presence'), orderBy('lastActive', 'desc'), limit(streamMode ? 18 : 80));

    const applyUsers = (list: ActiveUser[]) => {
      const now = Date.now();
      const users = list
        .filter((u) => {
          const ms = firestoreLikeToMillis(u.lastActive);
          if (ms == null || ms <= 0) return false;
          return now - ms < RENRRAKU_ACTIVE_MAX_AGE_MS;
        })
        .sort((a, b) => {
          const ta = firestoreLikeToMillis(a.lastActive) ?? 0;
          const tb = firestoreLikeToMillis(b.lastActive) ?? 0;
          return tb - ta;
        });
      setActiveUsers(users);
    };

    // Normal: realtime, StreamMode: polling (keep it lightweight).
    if (!streamMode) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          applyUsers(snapshot.docs.map((d) => d.data() as ActiveUser));
        },
        (error) => {
          console.error('Error fetching active users:', error);
        }
      );
      return () => unsubscribe();
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const snap = await getDocs(q);
        if (cancelled) return;
        applyUsers(snap.docs.map((d) => d.data() as ActiveUser));
      } catch (e) {
        if (!cancelled) console.warn('[Renrakucho] renraku_presence poll failed', e);
      }
    };
    void fetchOnce();
    const timer = window.setInterval(fetchOnce, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streamMode, subscribePublicTimeline]);

  // Firestore 購読（Check block status）
  useEffect(() => {
    if (!authUser) return;
    const blockRef = doc(db, 'blockedUsers', authUser.uid);
    const unsubscribe = onSnapshot(
      blockRef,
      (doc) => {
        setIsBlocked(doc.exists());
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'blockedUsers');
      }
    );
    return () => unsubscribe();
  }, [authUser?.uid]);

  // Firestore（コミュニティ掲示板 public_messages）
  // 配信モードでは負荷優先でリアルタイム購読を止め、低頻度の取得に切り替える。
  useEffect(() => {
    if (!subscribePublicTimeline) return;
    const q = query(collection(db, 'public_messages'), orderBy('createdAt', 'desc'), limit(streamMode ? 30 : 120));

    if (!streamMode) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data(), type: 'community' as const } as Message))
            .filter((m) => isRenrakuEntryVisible(m));
          setBoardMessages(msgs);
          markTimelineHydration('board');
        },
        (error) => {
          markTimelineHydration('board');
          handleFirestoreError(error, OperationType.LIST, 'public_messages');
        }
      );
      return () => unsubscribe();
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const snap = await getDocs(q);
        if (cancelled) return;
        const msgs = snap.docs
          .map((d) => ({ id: d.id, ...d.data(), type: 'community' as const } as Message))
          .filter((m) => isRenrakuEntryVisible(m));
        setBoardMessages(msgs);
        markTimelineHydration('board');
      } catch (e) {
        if (!cancelled) {
          markTimelineHydration('board');
          handleFirestoreError(e, OperationType.LIST, 'public_messages(poll)');
        }
      }
    };

    void fetchOnce();
    const timer = window.setInterval(fetchOnce, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streamMode, markTimelineHydration, subscribePublicTimeline]);

  // Firestore（ルーム募集のみ renraku_public）
  useEffect(() => {
    if (!subscribePublicTimeline) return;
    const q = query(collection(db, 'renraku_public'), orderBy('createdAt', 'desc'), limit(streamMode ? 30 : 120));

    if (!streamMode) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as Message))
            .filter((m) => m.type === 'recruit' && isRenrakuEntryVisible(m));
          setRecruitMessages(msgs);
          markTimelineHydration('recruit');
        },
        (error) => {
          markTimelineHydration('recruit');
          handleFirestoreError(error, OperationType.LIST, 'renraku_public');
        }
      );
      return () => unsubscribe();
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const snap = await getDocs(q);
        if (cancelled) return;
        const msgs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Message))
          .filter((m) => m.type === 'recruit' && isRenrakuEntryVisible(m));
        setRecruitMessages(msgs);
        markTimelineHydration('recruit');
      } catch (e) {
        if (!cancelled) {
          markTimelineHydration('recruit');
          handleFirestoreError(e, OperationType.LIST, 'renraku_public(poll)');
        }
      }
    };

    void fetchOnce();
    const timer = window.setInterval(fetchOnce, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streamMode, markTimelineHydration, subscribePublicTimeline]);

  // Firestore（Fetch Hundred Public Recruitments）
  useEffect(() => {
    if (!subscribePublicTimeline) return;
    const q = query(collection(db, 'hundred_public'), orderBy('createdAt', 'desc'), limit(streamMode ? 30 : 120));

    if (!streamMode) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map(
            (d) => ({ id: d.id, ...d.data(), type: 'hundred' as const } as HundredPublicRecruit)
          );
          setPublicHundred(list);
          markTimelineHydration('hundred');
        },
        (error) => {
          markTimelineHydration('hundred');
          handleFirestoreError(error, OperationType.LIST, 'hundred_public');
        }
      );
      return () => unsubscribe();
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const snap = await getDocs(q);
        if (cancelled) return;
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data(), type: 'hundred' as const } as HundredPublicRecruit)
        );
        setPublicHundred(list);
        markTimelineHydration('hundred');
      } catch (e) {
        if (!cancelled) {
          markTimelineHydration('hundred');
          handleFirestoreError(e, OperationType.LIST, 'hundred_public(poll)');
        }
      }
    };

    void fetchOnce();
    const timer = window.setInterval(fetchOnce, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streamMode, markTimelineHydration, subscribePublicTimeline]);

  // 一覧用: hundred_rooms の状態（配信モードではリアルタイム購読を抑制）
  useEffect(() => {
    if (!subscribePublicTimeline) return;
    if (!streamMode) {
      const unsub = onSnapshot(
        query(collection(db, 'hundred_rooms'), limit(60)),
        (snap) => {
          const next: Record<string, HundredRoomListMeta> = {};
          snap.forEach((d) => {
            const x = d.data() as Record<string, unknown>;
            next[d.id] = {
              status: typeof x.status === 'string' ? x.status : 'recruiting',
              playerCount: typeof x.playerCount === 'number' ? x.playerCount : undefined,
              recruitDeadlineAt: x.recruitDeadlineAt,
              hostNickname: typeof x.hostNickname === 'string' ? x.hostNickname : undefined,
              hostEmoji: typeof x.hostEmoji === 'string' ? x.hostEmoji : undefined,
              gameTimeLimitSec:
                typeof x.gameTimeLimitSec === 'number'
                  ? normalizeHundredGameTimeLimitSec(x.gameTimeLimitSec)
                  : undefined,
              endReason: typeof x.endReason === 'string' ? x.endReason : undefined,
            };
          });
          setHundredRoomMetaByRoomId(next);
        },
        (e) => console.error('hundred_rooms list meta', e)
      );
      return () => unsub();
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'hundred_rooms'), limit(60)));
        if (cancelled) return;
        const next: Record<string, HundredRoomListMeta> = {};
        snap.forEach((d) => {
          const x = d.data() as Record<string, unknown>;
          next[d.id] = {
            status: typeof x.status === 'string' ? x.status : 'recruiting',
            playerCount: typeof x.playerCount === 'number' ? x.playerCount : undefined,
            recruitDeadlineAt: x.recruitDeadlineAt,
            hostNickname: typeof x.hostNickname === 'string' ? x.hostNickname : undefined,
            hostEmoji: typeof x.hostEmoji === 'string' ? x.hostEmoji : undefined,
            gameTimeLimitSec:
              typeof x.gameTimeLimitSec === 'number'
                ? normalizeHundredGameTimeLimitSec(x.gameTimeLimitSec)
                : undefined,
            endReason: typeof x.endReason === 'string' ? x.endReason : undefined,
          };
        });
        setHundredRoomMetaByRoomId(next);
      } catch (e) {
        if (!cancelled) console.warn('hundred_rooms list meta (poll)', e);
      }
    };

    void fetchOnce();
    const timer = window.setInterval(fetchOnce, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streamMode, subscribePublicTimeline]);

  const reloadAdminPrivateInbox = useCallback(() => {
    setAdminPrivateReloadTick((n) => n + 1);
  }, []);

  // Firestore 購読（Fetch Private Messages: Admin only）
  useEffect(() => {
    if (!isAdmin || !effectiveAuthUser?.uid) {
      setPrivateMessages([]);
      setAdminPrivateLoadState('idle');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      setAdminPrivateLoadState('loading');
      const initial = await fetchRenrakuPrivateForAdmin(effectiveAuthUser);
      if (cancelled) return;

      if (initial.ok === true) {
        setPrivateMessages(initial.messages);
        setAdminPrivateLoadState('ok');
        console.log('[Renrakucho] renraku_private getDocs OK', {
          docCount: initial.messages.length,
          authUid: auth.currentUser?.uid ?? null,
        });
      } else {
        if (initial.code === 'permission-denied') {
          setAdminPrivateLoadState('denied');
          setNotification({
            type: 'error',
            text: '伝言を読めません。トップで Google にログインし直してから「かんり」タブを開いてください。',
          });
          window.setTimeout(() => setNotification(null), 6000);
          return;
        }
        if (initial.code === 'not-admin') {
          setAdminPrivateLoadState('idle');
          return;
        }
        setAdminPrivateLoadState('error');
        console.error('[Renrakucho] renraku_private getDocs FAILED', initial.error);
      }

      await ensureRenrakuAdminFirestoreAuth(effectiveAuthUser);
      if (cancelled) return;

      const q = query(collection(db, 'renraku_private'), limit(200));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs = sortRenrakuPrivateMessagesNewestFirst(
            snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message))
          );
          setPrivateMessages(msgs);
          setAdminPrivateLoadState('ok');
        },
        (error: unknown) => {
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String((error as { code?: string }).code)
              : '';
          console.error('[Renrakucho] renraku_private onSnapshot FAILED', code, error);
          if (code === 'permission-denied') {
            setAdminPrivateLoadState('denied');
            setNotification({
              type: 'error',
              text: '伝言を読めません。Googleでログインし直すか、管理者UIDの設定を確認してください。',
            });
            window.setTimeout(() => setNotification(null), 6000);
          } else {
            setAdminPrivateLoadState('error');
          }
          handleFirestoreError(error, OperationType.LIST, 'renraku_private');
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAdmin, effectiveAuthUser, adminPrivateReloadTick]);

  // Firestore 購読（Fetch My Private Messages: 自分の uid）
  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid) {
      setMyPrivateMessages([]);
      return;
    }
    // fromUserUid==me + orderBy(createdAt) は複合インデックスが必要になりがちなので、
    // where のみにしてクライアント側でソートする（表示用途・少量前提）。
    const q = query(collection(db, 'renraku_private'), where('fromUserUid', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as Message))
          .sort((a, b) => {
            const ta = firestoreLikeToMillis(a.createdAt) ?? 0;
            const tb = firestoreLikeToMillis(b.createdAt) ?? 0;
            return tb - ta;
          });
        setMyPrivateMessages(msgs);
      },
      (error: unknown) => {
        console.error('[Renrakucho] renraku_private(my) onSnapshot FAILED', error);
        handleFirestoreError(error, OperationType.LIST, 'renraku_private(my)');
      }
    );
    return () => unsubscribe();
  }, [authUser?.uid]);

  const privateMessageIdsForReply = useMemo(() => {
    const ids = new Set<string>();
    for (const m of myPrivateMessages) ids.add(m.id);
    if (isAdmin) {
      for (const m of visiblePrivateMessages) ids.add(m.id);
    }
    return Array.from(ids);
  }, [myPrivateMessages, visiblePrivateMessages, isAdmin]);

  // 返信本文（サブコレクション）— 差出人と管理者のみ read 可
  useEffect(() => {
    if (privateMessageIdsForReply.length === 0) {
      setPrivateReplyByMessageId({});
      return;
    }
    const unsubs = privateMessageIdsForReply.map((messageId) =>
      onSnapshot(
        renrakuPrivateReplyRef(messageId),
        (snap) => {
          setPrivateReplyByMessageId((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              next[messageId] = snap.data() as RenrakuPrivateReplyPayload;
            } else {
              delete next[messageId];
            }
            return next;
          });
        },
        (error) => {
          console.warn('[Renrakucho] private_reply subscribe', messageId, error);
        }
      )
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [privateMessageIdsForReply.join('|')]);

  // Firestore 購読（Fetch Blocked Users: Admin only）
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'blockedUsers'), orderBy('blockedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as BlockedUser));
        setBlockedUsers(users);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'blockedUsers');
      }
    );
    return () => unsubscribe();
  }, [isAdmin]);

  // Firestore 書き込み関数
  /** 投稿先は引数で固定（掲示板／らくだ先生宛） */
  const handleSend = async (explicitMode: 'public' | 'private') => {
    if (!message.trim()) return;
    if (isBlocked) {
      setNotification({ type: 'error', text: '投稿できません。' });
      return;
    }
    if (Date.now() < sendCooldownUntilMs) {
      setNotification({
        type: 'error',
        text: '連続投稿を防ぐため、あと少し待ってから再度お試しください。',
      });
      return;
    }
    if (!validateRenrakuPost(message, nickname, effectiveAuthUser)) {
      setNotification({ type: 'error', text: RENRAKU_VALIDATION_ERROR_MESSAGE });
      return;
    }

    try {
      await ensureAuth();
    } catch {
      setNotification({ type: 'error', text: '送信するにはログインが必要です。' });
      return;
    }

    const postingPrivate = explicitMode === 'private';
    if (postingPrivate && !isGoogleSignedInUser(auth.currentUser)) {
      setNotification({
        type: 'error',
        text: 'らくだへの伝言は Google でログインすると送れます。返信は同じ Google アカウントで、どの端末からでも見られます。',
      });
      window.setTimeout(() => setNotification(null), 6500);
      onRequestGoogleLogin?.();
      return;
    }

    /** ルール: public_messages は fromUserUid == request.auth.uid。undefined はフィールド欠落で拒否される */
    let uid = auth.currentUser?.uid ?? null;
    if (!uid) {
      try {
        const cred = await signInAnonymously(auth);
        uid = cred.user.uid;
      } catch (e) {
        console.error('[Renrakucho] signInAnonymously', e);
      }
    }
    if (!uid) {
      uid = auth.currentUser?.uid ?? null;
    }
    if (!uid) {
      setNotification({
        type: 'error',
        text: 'ログイン（匿名）に失敗しました。Firebase の「Authentication」で匿名ログインを有効にするか、通信を確認してください。',
      });
      return;
    }

    setIsSending(true);

    const collectionName = postingPrivate ? 'renraku_private' : 'public_messages';
    const postingToPublicBoard = collectionName === 'public_messages';

    console.log('[Renrakucho] handleSend: start', { collectionName, postingPrivate, uid });
    try {
      const data: Record<string, unknown> = {
        message: message.trim(),
        fromUser: nickname.trim() || 'ななしさん',
        fromUserUid: uid,
        createdAt: serverTimestamp(),
        status: RENRAKU_STATUS_ACTIVE,
      };
      data.fromUserEmoji = (userEmoji || '💬').trim() || '💬';
      if (postingPrivate) {
        data.isRead = false;
        data.toInbox = RENRAKU_PRIVATE_INBOX_RAKUDA;
      }

      console.log('[Renrakucho] handleSend: addDoc payload keys', Object.keys(data));
      const docRef = await addDoc(collection(db, collectionName), data);
      console.log('[Renrakucho] handleSend: success', { collectionName, docId: docRef.id });
      setMessage('');
      setSendCooldownUntilMs(Date.now() + RENRAKU_POST_COOLDOWN_MS);
      setNotification({
        type: 'success',
        text: postingPrivate ? 'らくだ珈琲に伝言を送りました' : 'メッセージを送りました',
      });
      setTimeout(() => setNotification(null), 3000);
      if (postingToPublicBoard) {
        window.requestAnimationFrame(() => {
          document.getElementById('renraku-public-timeline')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        });
      }
    } catch (error: unknown) {
      console.error('[Renrakucho] handleSend: FAILED', {
        collectionName,
        postingPrivate,
        uid,
        error,
        code: typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined,
        message: typeof error === 'object' && error !== null && 'message' in error ? (error as Error).message : undefined,
      });
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code) : '';
      const hint =
        code === 'permission-denied'
          ? '（権限がありません。匿名ログインと Firestore ルールを確認してください）'
          : '';
      setNotification({ type: 'error', text: `送信に失敗しました。${hint}` });
      handleFirestoreError(error, OperationType.WRITE, collectionName);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string, target: 'community' | 'recruit' | 'private') => {
    try {
      if (target === 'private' && !isAdmin) {
        await ensureAuth();
        await deleteDoc(doc(db, 'renraku_private', id));
        return;
      }
      if (!isAdmin) {
        // Allow users to delete their own community post (public_messages).
        if (target === 'community') {
          await ensureAuth();
          const uid = auth.currentUser?.uid ?? null;
          if (!uid) return;
          const ref = doc(db, 'public_messages', id);
          const snap = await getDoc(ref);
          if (!snap.exists()) return;
          const d = snap.data() as { fromUserUid?: unknown; pinned?: unknown } | undefined;
          if (d?.pinned === true) return;
          if (typeof d?.fromUserUid !== 'string' || d.fromUserUid !== uid) return;
          await deleteDoc(ref);
        }
        return;
      }
      const soft = renrakuAdminSoftDeleteFields();
      if (target === 'private') {
        await updateDoc(doc(db, 'renraku_private', id), soft);
        return;
      }
      if (target === 'recruit') {
        await updateDoc(doc(db, 'renraku_public', id), soft);
        return;
      }
      await updateDoc(doc(db, 'public_messages', id), soft);
    } catch (error) {
      console.error('Error deleting message:', error);
      const path =
        target === 'private' ? 'renraku_private' : target === 'recruit' ? 'renraku_public' : 'public_messages';
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleToggleBoardPin = async (postId: string, currentlyPinned: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'public_messages', postId), { pinned: !currentlyPinned });
    } catch (error) {
      console.error('toggle pin', error);
    }
  };

  const handleTogglePostReaction = async (postId: string) => {
    if (isBlocked || !authUser) return;
    try {
      await ensureAuth();
    } catch {
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const rRef = doc(db, 'public_messages', postId, 'reactions', uid);
    try {
      const snap = await getDoc(rRef);
      if (snap.exists()) {
        await deleteDoc(rRef);
      } else {
        await setDoc(rRef, { emoji: (userEmoji || '👍').trim().slice(0, 32) || '👍' });
      }
    } catch (error) {
      console.error('toggle reaction', error);
    }
  };

  const toggleRead = async (id: string, currentRead: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'renraku_private', id), { isRead: !currentRead });
    } catch (error) {
      console.error('Error toggling read status:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'renraku_private');
    }
  };

  const handleBlock = async (userId: string, userName: string) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, 'blockedUsers', userId), {
        userName,
        blockedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error blocking user:', error);
      handleFirestoreError(error, OperationType.WRITE, 'blockedUsers');
    }
  };

  /** 通報対応: 同一投稿者 uid の投稿を3コレクションで一括で status: blocked にする */
  const handleBulkBlockAuthorPosts = useCallback(
    async (authorUid: string, authorName?: string) => {
      if (!isAdmin || !authorUid) return;
      if (
        !window.confirm(
          'この投稿者の全投稿（公開掲示・募集・非公開）を「非表示（blocked）」にしますか？'
        )
      ) {
        return;
      }
      try {
        const fields = renrakuAdminBlockedFields();
        const n1 = await adminBatchSetBlockedByAuthorUid('public_messages', authorUid, fields);
        const n2 = await adminBatchSetBlockedByAuthorUid('renraku_public', authorUid, fields);
        const n3 = await adminBatchSetBlockedByAuthorUid('renraku_private', authorUid, fields);

        // Also register to the ban list so AdminScreen "出禁リスト" reflects this action.
        const name = String(authorName ?? '').trim() || '（名前不明）';
        await setDoc(
          doc(db, 'blockedUsers', authorUid),
          { userName: name, blockedAt: serverTimestamp() },
          { merge: true }
        );
        setNotification({
          type: 'success',
          text: `非表示にしました（合計 ${n1 + n2 + n3} 件）`,
        });
        setTimeout(() => setNotification(null), 3000);
      } catch (error) {
        console.error('handleBulkBlockAuthorPosts', error);
        setNotification({ type: 'error', text: '一括非表示に失敗しました。' });
        handleFirestoreError(error, OperationType.UPDATE, 'bulk-block-author');
      }
    },
    [isAdmin]
  );

  const handleUnblock = async (userId: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'blockedUsers', userId));
    } catch (error) {
      console.error('Error unblocking user:', error);
      handleFirestoreError(error, OperationType.DELETE, 'blockedUsers');
    }
  };

  const handleSendPrivateReply = useCallback(
    async (messageId: string, reply: string) => {
      if (!isAdmin) {
        setNotification({ type: 'error', text: '返信は管理者のみ送信できます。' });
        window.setTimeout(() => setNotification(null), 2500);
        return;
      }
      try {
        await ensureAuth();
      } catch {
        setNotification({ type: 'error', text: '返信するにはログインが必要です。' });
        window.setTimeout(() => setNotification(null), 2500);
        return;
      }
      const adminUser = auth.currentUser;
      if (adminUser) {
        await ensureRenrakuAdminFirestoreAuth(adminUser);
      }
      if (!auth.currentUser?.uid) {
        setNotification({ type: 'error', text: 'ログイン状態を確認できませんでした。' });
        window.setTimeout(() => setNotification(null), 2500);
        return;
      }
      const text = String(reply ?? '').trim();
      if (!text) return;

      const msgRef = doc(db, 'renraku_private', messageId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) {
        setNotification({ type: 'error', text: '伝言が見つかりませんでした。' });
        window.setTimeout(() => setNotification(null), 2500);
        return;
      }
      const toUserUid = String(msgSnap.data()?.fromUserUid ?? '').trim();
      if (!toUserUid) {
        setNotification({ type: 'error', text: '差出人を特定できませんでした。' });
        window.setTimeout(() => setNotification(null), 2500);
        return;
      }

      try {
        await setDoc(
          renrakuPrivateReplyRef(messageId),
          {
            text,
            toUserUid,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
        await updateDoc(msgRef, {
          hasReply: true,
          replyAt: serverTimestamp(),
          // 旧クライアント互換（新規も mirror。本文の正は private_reply）
          replyMessage: text,
        });
        setNotification({ type: 'success', text: '返信を送りました（差出人だけが閲覧できます）' });
        window.setTimeout(() => setNotification(null), 3000);
      } catch (error: unknown) {
        console.error('[Renrakucho] private reply failed', error);
        handleFirestoreError(error, OperationType.UPDATE, 'renraku_private/private_reply');
        throw error;
      }
    },
    [isAdmin, ensureAuth]
  );

  const unreadCount = privateMessages.filter((m) => isRenrakuEntryVisible(m) && !m.isRead).length;
  const didAutoOpenAdminTabRef = useRef(false);
  useEffect(() => {
    if (didAutoOpenAdminTabRef.current) return;
    if (!isAdmin || unreadCount <= 0) return;
    if (activeTab === 'admin') return;
    // 掲示板直リンク（/keijiban）ではメインのタイムラインを優先する
    if (isKeijibanPath) return;
    didAutoOpenAdminTabRef.current = true;
    setActiveTab('admin');
  }, [isAdmin, unreadCount, activeTab, isKeijibanPath]);

  const currentUid = authUser?.uid;

  /** みんなであそぶ: ホストが問題生成キャンセルで募集を閉じたとき（hundred_public 削除と同様に一覧へ） */
  const navigateToSanjuuRecruitBoard = useCallback(() => {
    clearHundredRestoreSession();
    setSelectedHundred(null);
    setPublicScreen('list');
    window.location.assign(
      sanjuuRecruitBoardUrlWithRakudaProfile({ emoji: userEmoji, nickname: nickname || '' })
    );
  }, [userEmoji, nickname]);

  const handleHundredGenerationCancelled = useCallback(() => {
    navigateToSanjuuRecruitBoard();
  }, [navigateToSanjuuRecruitBoard]);

  const startHundredPersistingRestore = useCallback(
    (roomDocId: string) => {
      if (selectedHundred?.roomId === roomDocId) {
        saveHundredRestoreSession({ publicScreen, selectedHundred });
      }
      onStartHundred(roomDocId);
    },
    [onStartHundred, publicScreen, selectedHundred]
  );

  const themeVariant = useMemo((): 'default' | 'hundred' => {
    if (activeTab !== 'main') return 'default';
    return ['hundred-detail', 'hundred-wait', 'hundred-board', 'closed'].includes(publicScreen)
      ? 'hundred'
      : 'default';
  }, [activeTab, publicScreen]);

  const atHundredCreateFocus =
    activeTab === 'main' &&
    publicScreen === 'list' &&
    typeof window !== 'undefined' &&
    window.location.hash === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`;

  const hidePostScreenFooter =
    atHundredCreateFocus ||
    isHundredHubPath ||
    (activeTab === 'main' && publicScreen === 'hundred-wait') ||
    hundredProblemsGenerating;

  const showActiveUsersStrip = !(activeTab === 'main' && publicScreen === 'hundred-wait');
  const playRecruitBadgesByUid = useActiveUserPlayRecruitBadges(showActiveUsersStrip, streamMode);

  return (
    <RenrakuchoLayout
      onBack={onBack}
      themeVariant={themeVariant}
      headerTitle={
        activeTab === 'main' && publicScreen === 'hundred-wait'
          ? '30待機室'
          : activeTab === 'main' &&
              publicScreen === 'list' &&
              typeof window !== 'undefined' &&
              window.location.hash === `#${RAKUDA_HUNDRED_CREATE_FRAGMENT}`
            ? '30の問題を作る'
            : isKeijibanPath
              ? '掲示板'
              : undefined
      }
      suppressActiveUsersStrip={activeTab === 'main' && publicScreen === 'hundred-wait'}
      playRecruitBadgesByUid={playRecruitBadgesByUid}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isAdmin={isAdmin}
      unreadCount={unreadCount}
      activeUsers={activeUsers}
      notification={notification}
      setNotification={setNotification}
      showProfileSetup={showProfileSetup}
      setShowProfileSetup={setShowProfileSetup}
      tempName={tempName}
      setTempName={setTempName}
      tempEmoji={tempEmoji}
      setTempEmoji={setTempEmoji}
      setNickname={setNickname}
      setUserEmoji={setUserEmoji}
      showGoogleLoginBar={needsGoogleLoginBar && !!onRequestGoogleLogin}
      onGoogleLogin={onRequestGoogleLogin}
      profileAuthUser={effectiveAuthUser}
      showBreakPopup={breakPopupOpen}
      onOpenBreakPopup={() => setBreakPopupOpen(true)}
      onCloseBreakPopup={() => setBreakPopupOpen(false)}
      canOpenBreakPopup={!!authUser && !showProfileSetup}
      currentUid={currentUid}
      nickname={nickname}
      userEmoji={userEmoji}
      myOnBreak={myOnBreak}
      onToggleBreak={() => {
        void toggleMyBreak();
      }}
      breakToggleDisabled={breakToggleBusy}
    >
      <AnimatePresence mode="wait">
        {activeTab === 'main' && (
          <div key="main" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* 上：掲示板タイムライン（スクロール） / 下：投稿フォーム（固定） */}
            <div
              className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-1 custom-scrollbar ${
                themeVariant === 'hundred' ? 'bg-rk-red-50' : 'bg-[var(--rk-hub-parchment-screen)]'
              }`}
            >
              <PublicScreen
                publicScreen={publicScreen}
                setPublicScreen={setPublicScreen}
                hundredRoomMetaByRoomId={hundredRoomMetaByRoomId}
                publicHundred={publicHundred}
                publicMessages={publicMessages}
                myPrivateMessages={myPrivateMessages.filter(isRenrakuEntryVisible)}
                privateReplyByMessageId={privateReplyByMessageId}
                selectedHundred={selectedHundred}
                setSelectedHundred={setSelectedHundred}
                nickname={nickname}
                userEmoji={userEmoji}
                currentUid={currentUid}
                isAdmin={isAdmin}
                isBoardInteractionBlocked={isBlocked}
                handleDelete={handleDelete}
                handleBulkBlockAuthorPosts={handleBulkBlockAuthorPosts}
                onTogglePostReaction={handleTogglePostReaction}
                onToggleBoardPin={handleToggleBoardPin}
                onJoinRoom={onJoinRoom}
                onStartHundred={startHundredPersistingRestore}
                streamMode={streamMode}
                onCloseHundredRecruitment={async () => {
                  const roomId = selectedHundred?.roomId;
                  if (!roomId) return;
                  const listingId = hundredPublicListingDocId(selectedHundred);
                  try {
                    await ensureAuth();
                    const uid = auth.currentUser?.uid;
                    if (!uid || uid !== selectedHundred.hostUid) return;
                    await applyHostCancelledHundredGeneration({
                      roomId,
                      hundredPublicDocId: listingId,
                      endReason: 'recruitment_closed',
                    });
                  } catch (e) {
                    console.error('[Renrakucho] onCloseHundredRecruitment', e);
                    return;
                  }
                  navigateToSanjuuRecruitBoard();
                }}
                onHundredGenerationCancelled={handleHundredGenerationCancelled}
                hideSanjuuRecruitmentSection={isKeijibanPath}
                hideBulletinBelowCreate={isHundredHubPath}
                publicTimelineHydrated={publicTimelineHydrated}
                ensureAuth={ensureAuth}
              />
            </div>
            {!hidePostScreenFooter ? (
            <div
              className={
                themeVariant === 'hundred'
                  ? 'shrink-0 border-t-2 border-rk-red-800 bg-rk-red-50 shadow-[var(--rk-shadow-footer-danger)] pt-1.5 pb-1'
                  : 'shrink-0 border-t-2 border-[var(--rk-hub-bark)] bg-[var(--rk-hub-parchment)] shadow-[var(--rk-shadow-footer-hub)] pt-1.5 pb-1'
              }
            >
              <PostScreen
                isBlocked={isBlocked}
                message={message}
                setMessage={setMessage}
                handleSend={(mode) => void handleSend(mode)}
                isSending={isSending}
                sendCooldownUntilMs={sendCooldownUntilMs}
                needsProfileSetup={!hasProfile}
                onOpenProfileSetup={() => setShowProfileSetup(true)}
                onRequestGoogleLogin={onRequestGoogleLogin}
                canSendPrivateDenwa={canSendPrivateDenwa}
              />
            </div>
            ) : null}
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div key="admin" className="min-h-0 flex-1 overflow-y-auto bg-[var(--rk-hub-parchment-screen)] custom-scrollbar px-1 pb-2">
          <AdminScreen
            privateMessages={visiblePrivateMessages}
            adminPrivateLoadState={adminPrivateLoadState}
            onReloadAdminInbox={reloadAdminPrivateInbox}
            onRequestGoogleLogin={onRequestGoogleLogin}
            boardMessages={boardMessages}
            recruitMessages={recruitMessages}
            blockedUsers={blockedUsers}
            toggleRead={toggleRead}
            handleDelete={handleDelete}
            handleBlock={handleBlock}
            handleBulkBlockAuthorPosts={handleBulkBlockAuthorPosts}
            handleUnblock={handleUnblock}
            privateReplyByMessageId={privateReplyByMessageId}
            onSendPrivateReply={(messageId, text) => void handleSendPrivateReply(messageId, text)}
          />
          </div>
        )}
      </AnimatePresence>
    </RenrakuchoLayout>
  );
};

export default Renrakucho;
