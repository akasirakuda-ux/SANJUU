'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, type QueryDocumentSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getSanjuuAuth, getSanjuuFirestore } from '../lib/sanjuuFirebase';
import { isRenrakuAdmin } from '../lib/rakudaRenrakuAdminClient';
import { issueRedCardFromSanjuu, issueYellowCardFromSanjuu } from '../lib/userModerationClient';
import {
  formatFirestoreTimeJa,
  formatHundredBoardLabel,
  isHundredBetweenRounds,
  normalizeHundredGameTimeLimitSec,
  resolveHundredRecruitRoundStartedAt,
  resolveHundredRecruitTargetWord,
  shouldHideFromSanjuuRecruitBoard,
  type FirestoreTimeInput,
  type HundredRoomListMeta,
} from '../lib/hundredPublicListHelpers';
import {
  readRakudaQueryProfile,
  rakudaHundredCreateUrl,
  rakudaTileMatchCreateUrl,
  rakudaTileMatchSoloPlayUrl,
  rakudaTopMenuUrl,
} from '../lib/rakudaQueryProfile';
import { mergePinnedRoboPickupLoungePublicRecruits } from '../lib/hundredPublicRoboPins';
import RK19QuietRoomBackButton from './RK19QuietRoomBackButton';
import styles from './SanjuuHundredRecruitBoard.module.css';

const RAKUDA_ORIGIN = () =>
  (process.env.NEXT_PUBLIC_RAKUDA_ORIGIN || 'https://rakuda.coffee').replace(/\/+$/, '');

const TILE_MATCH_HUNDRED_MODE = 'tile_match';
const TILE_MATCH_EMOJI = '🃏';

const TILE_MATCH_DIFFICULTY_LABELS_JA: Record<string, string> = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
};

const TILE_MATCH_DIFFICULTY_TILE_COUNTS: Record<string, number> = {
  easy: 48,
  normal: 96,
  hard: 144,
};

export type HundredPublicRecruitRow = {
  id: string;
  type: 'hundred';
  targetWord: string;
  hundredMode?: string;
  tileMatchDifficulty?: string;
  boardSize: number;
  boardCols?: number;
  boardRows?: number;
  createdAt: FirestoreTimeInput;
  roomId?: string;
  hostUid?: string;
  hostNickname?: string;
  hostEmoji?: string;
  recruitDeadlineAt?: FirestoreTimeInput;
  gameTimeLimitSec?: number;
  hintsEnabled?: boolean;
  pickupCharset?: 'hiragana' | 'digit' | 'latin';
  roboPickupLounge?: boolean;
};

export type SanjuuRecruitBoardVariant = 'pickup' | 'tile_match';

function isTileMatchRecruit(item: HundredPublicRecruitRow): boolean {
  return item.hundredMode === TILE_MATCH_HUNDRED_MODE;
}

function statusLabel(item: HundredPublicRecruitRow, room: HundredRoomListMeta | undefined): string {
  if (item.roboPickupLounge === true) return '常設';
  const st = room?.status ?? 'recruiting';
  if (st === 'finished') return '終了';
  if (st === 'cancelled') return '取消';
  if (st === 'playing' || st === 'started') return '途中参加OK';
  if (isHundredBetweenRounds(room)) return '次のお題待ち';
  if (typeof room?.playerCount === 'number' && room.playerCount >= 20) return '満員';
  return '募集';
}

const RECRUIT_BOARD_POLL_MS = 15_000;

function parsePublicRowFromData(id: string, x: Record<string, unknown>): HundredPublicRecruitRow {
  return {
    id,
    type: 'hundred',
    targetWord: typeof x.targetWord === 'string' ? x.targetWord : '',
    hundredMode: typeof x.hundredMode === 'string' ? x.hundredMode : undefined,
    tileMatchDifficulty:
      typeof x.tileMatchDifficulty === 'string' ? x.tileMatchDifficulty : undefined,
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
    hintsEnabled: x.hintsEnabled === false ? false : undefined,
    pickupCharset:
      x.pickupCharset === 'digit' || x.pickupCharset === 'latin' || x.pickupCharset === 'hiragana'
        ? x.pickupCharset
        : undefined,
    roboPickupLounge: x.roboPickupLounge === true ? true : undefined,
  };
}

function parsePublicRow(d: QueryDocumentSnapshot): HundredPublicRecruitRow {
  return parsePublicRowFromData(d.id, d.data() as Record<string, unknown>);
}

function parseRoomMeta(x: Record<string, unknown>): HundredRoomListMeta {
  return {
    status: typeof x.status === 'string' ? x.status : 'recruiting',
    playerCount: typeof x.playerCount === 'number' ? x.playerCount : undefined,
    recruitDeadlineAt: x.recruitDeadlineAt,
    hostNickname: typeof x.hostNickname === 'string' ? x.hostNickname : undefined,
    hostEmoji: typeof x.hostEmoji === 'string' ? x.hostEmoji : undefined,
    gameTimeLimitSec:
      typeof x.gameTimeLimitSec === 'number' ? normalizeHundredGameTimeLimitSec(x.gameTimeLimitSec) : undefined,
    hundredMode: typeof x.hundredMode === 'string' ? x.hundredMode : undefined,
    tileMatchDifficulty:
      typeof x.tileMatchDifficulty === 'string' ? x.tileMatchDifficulty : undefined,
    targetWord: typeof x.targetWord === 'string' ? x.targetWord : undefined,
    pickupCharset: typeof x.pickupCharset === 'string' ? x.pickupCharset : undefined,
    boardSize: typeof x.boardSize === 'number' ? x.boardSize : undefined,
    boardCols: typeof x.boardCols === 'number' ? x.boardCols : undefined,
    boardRows: typeof x.boardRows === 'number' ? x.boardRows : undefined,
    roboPickupLounge: x.roboPickupLounge === true ? true : undefined,
    startedAt: x.startedAt as FirestoreTimeInput,
    foundWords: x.foundWords,
    words: x.words,
    placedWords: x.placedWords,
    problemsGenerating: x.problemsGenerating === true ? true : undefined,
    problemsReady: x.problemsReady === true ? true : undefined,
    gridRowsPresent: Array.isArray(x.gridRows) && x.gridRows.length > 0 ? true : undefined,
    endReason: typeof x.endReason === 'string' ? x.endReason : undefined,
    endedAt: x.endedAt as FirestoreTimeInput,
  };
}

function difficultyLabel(difficulty: string | undefined): string {
  if (!difficulty) return '—';
  const label = TILE_MATCH_DIFFICULTY_LABELS_JA[difficulty];
  const tiles = TILE_MATCH_DIFFICULTY_TILE_COUNTS[difficulty];
  if (label && tiles) return `${label}（${tiles}枚）`;
  return label || difficulty;
}

const BOARD_COPY: Record<
  SanjuuRecruitBoardVariant,
  { title: string; createLink: string; soloLink?: string; empty: string }
> = {
  pickup: {
    title: 'ひと言探し',
    createLink: 'ひと言探し　問題を作る',
    empty: '現在、募集中の問題はありません。',
  },
  tile_match: {
    title: 'ペア探し',
    soloLink: 'ペア探し　ひとりで遊ぶ',
    createLink: 'ペア探し　問題を作る',
    empty: '現在、募集中の部屋はありません。',
  },
};

export default function SanjuuHundredRecruitBoard({
  variant = 'pickup',
}: {
  variant?: SanjuuRecruitBoardVariant;
}) {
  const copy = BOARD_COPY[variant];
  const [now, setNow] = useState(() => Date.now());
  const [createProblemHref, setCreateProblemHref] = useState(() =>
    variant === 'tile_match'
      ? `${RAKUDA_ORIGIN()}/hundred#rk-tile-match-create`
      : `${RAKUDA_ORIGIN()}/hundred#rk-hundred-create`
  );
  const [soloPlayHref, setSoloPlayHref] = useState(() => `${RAKUDA_ORIGIN()}/?play=tile-match`);
  const [rakudaTopHref, setRakudaTopHref] = useState(() => `${RAKUDA_ORIGIN()}/`);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [publicHundred, setPublicHundred] = useState<HundredPublicRecruitRow[]>([]);
  const [roomMetaById, setRoomMetaById] = useState<Record<string, HundredRoomListMeta>>({});
  const [missingRoomIds, setMissingRoomIds] = useState<Set<string>>(() => new Set());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [moderationBusyUid, setModerationBusyUid] = useState<string | null>(null);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);

  const isAdmin = isRenrakuAdmin(authUser);

  useEffect(() => {
    const auth = getSanjuuAuth();
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!moderationNotice) return;
    const t = window.setTimeout(() => setModerationNotice(null), 2500);
    return () => window.clearTimeout(t);
  }, [moderationNotice]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const origin = RAKUDA_ORIGIN();
    setCreateProblemHref(
      variant === 'tile_match' ? rakudaTileMatchCreateUrl(origin) : rakudaHundredCreateUrl(origin)
    );
    if (variant === 'tile_match') {
      setSoloPlayHref(rakudaTileMatchSoloPlayUrl(origin));
    }
    setRakudaTopHref(rakudaTopMenuUrl(origin));
  }, [variant]);

  useEffect(() => {
    const db = getSanjuuFirestore();
    let cancelled = false;

    const refresh = async () => {
      try {
        const pubSnap = await getDocs(
          query(collection(db, 'hundred_public'), orderBy('createdAt', 'desc'), limit(120))
        );
        if (cancelled) return;

        const list = pubSnap.docs.map(parsePublicRow);
        const merged = await mergePinnedRoboPickupLoungePublicRecruits(db, list, parsePublicRowFromData);
        if (cancelled) return;

        const roomIds = [...new Set(merged.map((h) => h.roomId).filter((id): id is string => !!id))];
        const nextMeta: Record<string, HundredRoomListMeta> = {};
        const nextMissing = new Set<string>();
        await Promise.all(
          roomIds.map(async (roomId) => {
            try {
              const roomSnap = await getDoc(doc(db, 'hundred_rooms', roomId));
              if (!roomSnap.exists()) {
                nextMissing.add(roomId);
                return;
              }
              nextMeta[roomId] = parseRoomMeta(roomSnap.data() as Record<string, unknown>);
            } catch {
              nextMissing.add(roomId);
            }
          })
        );
        if (cancelled) return;
        // 部屋メタと同時に載せる（終わった募集が一瞬出るチラつき防止）
        setPublicHundred(merged);
        setRoomMetaById(nextMeta);
        setMissingRoomIds(nextMissing);

        // 終わった／お題間の掲示を DB からも消す（ホスト or 新ルールで削除可）
        void Promise.all(
          merged.map(async (item) => {
            const id = String(item.id ?? '').trim();
            if (!id || item.roboPickupLounge) return;
            const roomId = (item.roomId || '').trim();
            if (!roomId) return;
            const room = nextMeta[roomId];
            const roomDocMissing = nextMissing.has(roomId);
            if (!shouldHideFromSanjuuRecruitBoard(item, room, Date.now(), { roomDocMissing })) return;
            try {
              await deleteDoc(doc(db, 'hundred_public', id));
            } catch {
              /* ignore */
            }
          }),
        );
      } catch {
        /* ignore batch errors; keep last good snapshot */
      } finally {
        if (!cancelled) setFirestoreReady(true);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), RECRUIT_BOARD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const visibleItems = useMemo(() => {
    return publicHundred.filter((h) => {
      const isTile = isTileMatchRecruit(h);
      if (variant === 'tile_match' ? !isTile : isTile) return false;
      const room = h.roomId ? roomMetaById[h.roomId] : undefined;
      const roomDocMissing = !!(h.roomId && missingRoomIds.has(h.roomId));
      return !shouldHideFromSanjuuRecruitBoard(h, room, now, { roomDocMissing });
    });
  }, [publicHundred, roomMetaById, missingRoomIds, now, variant]);

  const openJoin = useCallback((publicId: string) => {
    const keijiban = `${RAKUDA_ORIGIN()}/keijiban`;
    const u = new URL(keijiban);
    u.searchParams.set('joinHundredPublic', publicId);
    const { urlEmoji, urlNick } = readRakudaQueryProfile();
    if (urlEmoji && urlNick) {
      u.searchParams.set('rkEmoji', urlEmoji);
      u.searchParams.set('rkNick', urlNick);
    }
    window.location.assign(u.toString());
  }, []);

  const hostDisplay = (item: HundredPublicRecruitRow) => {
    const room = item.roomId ? roomMetaById[item.roomId] : undefined;
    const nick = (room?.hostNickname || item.hostNickname || '').trim() || '—';
    const emoji = (room?.hostEmoji || item.hostEmoji || '').trim();
    return `${emoji}${nick}`.trim() || nick;
  };

  const runModeration = useCallback(
    async (kind: 'yellow' | 'red', hostUid: string | undefined, hostName: string) => {
      if (!isAdmin || !hostUid) return;
      setModerationBusyUid(hostUid);
      try {
        if (kind === 'yellow') {
          await issueYellowCardFromSanjuu(hostUid, hostName);
          setModerationNotice('イエローカードを付けました');
        } else {
          await issueRedCardFromSanjuu(hostUid, hostName);
          setModerationNotice('レッドカードを付けました');
        }
      } catch (e) {
        console.error('[SanjuuHundredRecruitBoard] moderation', e);
        setModerationNotice('カードの付与に失敗しました');
      } finally {
        setModerationBusyUid(null);
      }
    },
    [isAdmin]
  );

  const resolveDifficulty = (item: HundredPublicRecruitRow) => {
    const room = item.roomId ? roomMetaById[item.roomId] : undefined;
    return item.tileMatchDifficulty || room?.tileMatchDifficulty;
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <RK19QuietRoomBackButton href={rakudaTopHref} title="らくだ珈琲のトップへもどる" />
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>{copy.title}</h1>
          </div>
          <div className={styles.headerSpacer} aria-hidden />
        </div>
      </header>

      {moderationNotice ? <p className={styles.moderationNotice}>{moderationNotice}</p> : null}
      {!authReady ? null : isAdmin ? (
        <p className={styles.adminHint}>管理者 — 募集カードからイエロー／レッドカードを付けられます</p>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className={styles.emptyMessage}>{firestoreReady ? copy.empty : '読み込み中…'}</p>
      ) : (
        <ul className={styles.list}>
          {visibleItems.map((item) => {
            const room = item.roomId ? roomMetaById[item.roomId] : undefined;
            const st = statusLabel(item, room);
            const tile = variant === 'tile_match';
            const hostName = hostDisplay(item);
            const hostUid = item.hostUid?.trim();
            const displayTargetWord = resolveHundredRecruitTargetWord(item, room);
            const isRoboLounge = item.roboPickupLounge === true || item.roomId === 'robo-pickup-lounge' || item.roomId === 'robo-pickup-lounge-emoji';
            const moderationBusy = !!hostUid && moderationBusyUid === hostUid;
            return (
              <li key={item.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <div className={styles.cardBadge}>{st}</div>
                  <div className={styles.cardDate}>
                    <span className={styles.labelMuted}>{isRoboLounge ? 'お題開始' : '日時'}</span>{' '}
                    {formatFirestoreTimeJa(resolveHundredRecruitRoundStartedAt(item, room), {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className={styles.cardMeta}>
                    <div>
                      <span className={styles.labelMuted}>表示名</span> {hostName}
                    </div>
                    {tile ? (
                      <div>
                        <span className={styles.labelMuted}>難易度</span>{' '}
                        {TILE_MATCH_EMOJI} {difficultyLabel(resolveDifficulty(item))}
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className={styles.labelMuted}>ことば</span>{' '}
                          <span
                            style={{
                              display: 'inline-block',
                              marginRight: 4,
                              padding: '0 4px',
                              borderRadius: 4,
                              border: '1px solid #fcd34d',
                              background: '#fffbeb',
                              fontSize: '0.65rem',
                              fontWeight: 900,
                            }}
                          >
                            {item.pickupCharset === 'digit'
                              ? '123'
                              : item.pickupCharset === 'latin'
                                ? 'ABC'
                                : 'あ'}
                          </span>{' '}
                          {displayTargetWord}
                        </div>
                        <div>
                          <span className={styles.labelMuted}>盤</span> {formatHundredBoardLabel(item)}
                        </div>
                        <div>
                          <span className={styles.labelMuted}>ヒント</span>{' '}
                          {item.hintsEnabled === false ? 'なし' : 'あり'}
                        </div>
                      </>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <span className={styles.labelMuted}>状態</span>{' '}
                      <span style={{ fontWeight: 900 }}>{st}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  {isAdmin && hostUid ? (
                    <div className={styles.moderationActions}>
                      <button
                        type="button"
                        disabled={moderationBusy}
                        className={styles.yellowButton}
                        onClick={() => void runModeration('yellow', hostUid, hostName)}
                      >
                        🟨 イエロー
                      </button>
                      <button
                        type="button"
                        disabled={moderationBusy}
                        className={styles.redButton}
                        onClick={() => void runModeration('red', hostUid, hostName)}
                      >
                        🟥 レッド
                      </button>
                    </div>
                  ) : null}
                  <button type="button" onClick={() => openJoin(item.id)} className={styles.joinButton}>
                    参加
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.createWrap}>
        {copy.soloLink ? (
          <a href={soloPlayHref} className={styles.soloLink}>
            {copy.soloLink}
          </a>
        ) : null}
        <a href={createProblemHref} className={styles.createLink}>
          {copy.createLink}
        </a>
      </div>
    </main>
  );
}
