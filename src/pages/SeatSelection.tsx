import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutGrid, Moon, Grid3x3, BookOpen } from 'lucide-react';
import KotobaLogo from '../components/KotobaLogo';
import { RAKUDA_PROFILE_SETTINGS_ANCHOR_ID } from '../components/AppHeader';
import ModeEntryLayout from '../components/ModeEntryLayout';
import RakudaFloatingBackdrop from '../components/RakudaFloatingBackdrop';
import RakudaTopStatusBadge from '../components/RakudaTopStatusBadge';
import RakudaHubPresenceRow from '../components/RakudaHubPresenceRow';
import { hubVisitorTotalForDisplay } from '../lib/hubVisitorStats';

import { btnGhost, hubMenuBtn, hubMenuBtnHalfWFill } from '../ui/policy';
import { REVERSI_RECRUIT_BADGE_CLASS, REVERSI_RECRUIT_HOST_BADGE_CLASS } from '../lib/reversiConfig';
import {
  GOMOKU_RECRUIT_BADGE_CLASS,
  GOMOKU_RECRUIT_HOST_BADGE_CLASS,
} from '../lib/gomokuConfig';
import type { UserAccount } from '../types';
import {
  getRakudaDisplayNameValidationError,
  hasCompleteRakudaHandoffProfile,
  rkCssColor,
  sanjuuRecruitBoardUrlWithRakudaProfile,
} from '../lib/rakudaHubShell';
import { RK_GATE_NICK_DISPLAY_CLASS } from '../lib/rakudaGate';
import { vibrate } from '../lib/utils';
import { OUEN_NOTE_TITLE, OUEN_NOTE_MIN_STAMPS, OUEN_NOTE_HUB_LIVE, OUEN_NOTE_HUB_TESTING } from '../lib/ouenNoteConfig';
import OuenNotePrepPopup from '../components/OuenNote/OuenNotePrepPopup';
import { trackRakudaHubMenu } from '../lib/rakudaGaEvents';

interface SeatSelectionProps {
  onSelectWindow: () => void;
  onOpenKeijiban: () => void;
  onOpenRenrakuchoAdmin: () => void;
  onSelectQuietRoom: () => void;
  onOpenStampCard: () => void;
  onOpenSlidePuzzle: () => void;
  onOpenSudoku: () => void;
  onOpenOthello: () => void;
  onOpenGomoku: () => void;
  onOpenRelayStory: () => void;
  onOpenOuenNote: () => void | Promise<void>;
  onOpenSettings: () => void;
  isOnline: boolean;
  hasActiveRecruitments?: boolean;
  /** hundred_public に最終閲覧より新しい募集がある */
  hundredRecruitHasNew?: boolean;
  /** 参加可能なリバーシオンライン募集がある */
  reversiRecruitHasOpen?: boolean;
  /** 自分のリバーシ募集が待機中 */
  reversiRecruitHostWaiting?: boolean;
  /** 参加可能な五目並べオンライン募集がある */
  gomokuRecruitHasOpen?: boolean;
  /** 自分の五目並べ募集が待機中 */
  gomokuRecruitHostWaiting?: boolean;
  /** 連絡帳に未読（最終閲覧より新しい投稿） */
  renrakuchoHasUnread?: boolean;
  /** ノートに未読（新しい相談・コメント） */
  ouenNoteHasUnread?: boolean;
  viewerCount?: number;
  hubPresencePeers?: readonly import('../hooks/usePresence').HubPresencePeer[];
  hubVisitorTotal?: number;
  nickname: string;
  setNickname: (name: string) => void;
  userEmoji: string;
  setUserEmoji: (emoji: string) => void;
  accounts: UserAccount[];
  activeUserId: string;
  switchAccount: (userId: string) => void;
  createAccount: () => string;
  /** 公式名ニックは連絡帳管理者のみ許可（匿名は不可のまま） */
  firebaseUser?: User | null;
  isAuthReady?: boolean;
  onGoogleLogin?: () => void;
  onGoogleLoginPopup?: () => void | Promise<void>;
  greenGateActive?: boolean;
  shussekiRegular?: boolean;
}

const hubBtn = hubMenuBtn.replace('font-medium', 'font-black');
const hubBtnHalf = hubMenuBtnHalfWFill.replace('font-medium', 'font-black');

const SeatSelection: React.FC<SeatSelectionProps> = ({
  onSelectWindow,
  onOpenKeijiban,
  onOpenRenrakuchoAdmin: _onOpenRenrakuchoAdmin,
  onSelectQuietRoom,
  onOpenStampCard,
  onOpenSlidePuzzle,
  onOpenSudoku,
  onOpenOthello,
  onOpenGomoku,
  onOpenRelayStory,
  onOpenOuenNote,
  onOpenSettings,
  isOnline,
  hasActiveRecruitments = false,
  hundredRecruitHasNew = false,
  reversiRecruitHasOpen = false,
  reversiRecruitHostWaiting = false,
  gomokuRecruitHasOpen = false,
  gomokuRecruitHostWaiting = false,
  renrakuchoHasUnread = false,
  ouenNoteHasUnread = false,
  viewerCount,
  hubPresencePeers = [],
  hubVisitorTotal,
  nickname,
  setNickname,
  userEmoji,
  setUserEmoji,
  accounts,
  activeUserId,
  switchAccount,
  createAccount,
  firebaseUser,
  isAuthReady = true,
  onGoogleLogin,
  onGoogleLoginPopup,
  greenGateActive = false,
  shussekiRegular = false,
}) => {
  const [showRegisteredMessage, setShowRegisteredMessage] = useState(false);
  const [showOuenNotePrepPopup, setShowOuenNotePrepPopup] = useState(false);
  const handleRegister = () => {
    setShowRegisteredMessage(true);
    setTimeout(() => setShowRegisteredMessage(false), 3000);
  };

  const hubViewerCount = viewerCount;

  const hubTotalDisplay = useMemo(() => {
    const n = typeof hubVisitorTotal === 'number' ? hubVisitorTotal : 0;
    return hubVisitorTotalForDisplay(n);
  }, [hubVisitorTotal]);

  const hasProfile = useMemo(
    () => hasCompleteRakudaHandoffProfile({ emoji: userEmoji, nickname }),
    [nickname, userEmoji]
  );

  const requireProfile = (action: () => void) => {
    if (hasProfile) {
      action();
      return;
    }
    window.dispatchEvent(
      new CustomEvent('SHOW_TOAST', {
        detail: '「絵文字・ニックネーム」を入力してから遊んでください',
      })
    );
    setShowRegisteredMessage(true);
    setTimeout(() => setShowRegisteredMessage(false), 2500);
  };

  const settingsButton = (
    <button
      type="button"
      onClick={() => {
        trackRakudaHubMenu('settings');
        onOpenSettings();
      }}
      className={`w-10 h-10 flex items-center justify-center leading-none ${btnGhost}`}
      aria-label="設定"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.50-.38-1.03-.70-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    </button>
  );

  const profileBlock = (
    <div
      id={RAKUDA_PROFILE_SETTINGS_ANCHOR_ID}
      className="w-full space-y-2 rounded-xl border-2 border-rk-amber-400/75 bg-rk-amber-50/98 shadow-md p-2.5 sm:p-3 pb-3 scroll-mt-[calc(env(safe-area-inset-top)+5.5rem)]"
    >
      <p className="text-[10px] font-medium text-rk-slate-600 text-left pl-0.5">絵文字・ニックネーム</p>
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <input
          type="text"
          value={userEmoji}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              setUserEmoji('');
              return;
            }
            const chars = Array.from(val);
            setUserEmoji(chars[chars.length - 1] ?? '');
          }}
          placeholder="👤"
          className="w-10 h-10 shrink-0 bg-rk-slate-50 rounded-xl text-base text-center border border-rk-slate-200 text-rk-slate-700 focus:outline-none focus:ring-2 focus:ring-rk-amber-300/50"
        />
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="なまえ..."
          className={`min-w-0 flex-1 h-10 bg-rk-slate-50 border border-rk-slate-200 rounded-xl px-2.5 text-sm font-medium placeholder:text-rk-slate-500 focus:outline-none focus:ring-2 focus:ring-rk-amber-300/50 ${RK_GATE_NICK_DISPLAY_CLASS}`}
        />
        <button
          type="button"
          onClick={() => {
            if (!hasProfile) {
              window.dispatchEvent(
                new CustomEvent('SHOW_TOAST', {
                  detail: '絵文字とニックネームを入れてね',
                })
              );
              setShowRegisteredMessage(true);
              setTimeout(() => setShowRegisteredMessage(false), 2500);
              return;
            }
            const displayNameError = getRakudaDisplayNameValidationError(nickname, userEmoji, firebaseUser);
            if (displayNameError) {
              window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: displayNameError }));
              vibrate(20);
              return;
            }
            handleRegister();
          }}
          className="h-10 min-w-[2.75rem] px-1.5 sm:px-2 shrink-0 flex items-center justify-center rounded-xl bg-rk-indigo-200 text-rk-slate-700 text-xs sm:text-sm font-medium active:scale-95 transition-transform"
        >
          登録
        </button>
      </div>
      <AnimatePresence>
        {showRegisteredMessage && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[10px] font-medium text-rk-slate-700 text-center bg-rk-amber-50 border border-rk-amber-200 p-2 rounded-xl"
          >
            {hasProfile ? '登録しました' : '絵文字・ニックネームを入力してください'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
    <div className="absolute inset-0 z-40 p-3 md:p-4 rk-seat-selection-outer">
      <div className="relative h-full w-full rounded-xl shadow-md border border-rk-amber-300/80 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none bg-gradient-to-b from-rk-amber-100 via-rk-amber-50 to-rk-orange-100 z-0"
          aria-hidden
        />
        <RakudaFloatingBackdrop variant="hub" className="!absolute !inset-0 !z-[1]" />
        <div className="relative z-[2] h-full min-h-0">
          <ModeEntryLayout
            layoutVariant="hubScroll"
            hubScrollContentTopClass="pt-12 sm:pt-14"
            title="らくだ珈琲"
            subtitle="永遠の素人。ゆるゆると遊んでいってね"
            titleStrokeColor={rkCssColor('--rk-amber-900', 'rgb(120 53 15)')}
            subtitleClassName="text-rk-amber-950/90"
            backgroundClassName=""
            rakudaBackdropVariant={undefined}
            topLeft={settingsButton}
            topRight={
              <RakudaTopStatusBadge
                userEmoji={userEmoji}
                nickname={nickname}
                isOnline={isOnline}
                firebaseUser={firebaseUser}
                isAuthReady={isAuthReady}
                onGoogleLogin={onGoogleLogin}
                onGoogleLoginPopup={onGoogleLoginPopup}
                greenGateActive={greenGateActive}
                shussekiRegular={shussekiRegular}
              />
            }
            children={
              <>
                <RakudaHubPresenceRow
                  hubPresencePeers={hubPresencePeers}
                  viewerCount={hubViewerCount}
                  hubVisitorTotal={hubTotalDisplay}
                />
                {profileBlock}
              </>
            }
            mainColumn={
              <nav
                className="grid grid-cols-2 gap-3 w-full max-w-md mx-auto pb-3 overflow-visible"
                aria-label="メインメニュー（ことば探し、ひと言探し、掲示板ほか）"
              >
                {/* ことば探し */}
                <button
                  type="button"
                  className={`${hubBtnHalf} bg-[var(--rk-hub-rose-panel)] border-[var(--rk-hub-bark)] text-[var(--rk-hub-bark-deep)] shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('kotoba');
                    // Playing should always be possible even before profile setup.
                    if (!hasProfile) {
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: 'プロフィールはあとでOK。まずは遊べます',
                        })
                      );
                    }
                    onSelectWindow();
                  }}
                >
                  <KotobaLogo size={22} />
                  <span>ことば探し</span>
                </button>

                {/* ひと言探し → SANJUU 募集掲示板 */}
                <button
                  type="button"
                  aria-label="ひと言探し"
                  className={`${hubBtnHalf} bg-gradient-to-r from-rk-sky-200 to-rk-cyan-200 border-rk-sky-700/45 text-rk-sky-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('hundred_recruit');
                    vibrate(10);
                    if (!hasProfile) {
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: '見ることはできます。表示名をひと言探しに渡すには「絵文字・ニックネーム」を両方入れてください',
                        })
                      );
                    }
                    window.location.assign(
                      sanjuuRecruitBoardUrlWithRakudaProfile({ emoji: userEmoji, nickname }),
                    );
                  }}
                >
                  {hundredRecruitHasNew ? (
                    <span className="pointer-events-none absolute -top-1.5 left-2 z-[90] bg-rk-rose-200 text-[9px] px-1.5 py-0.5 rounded-lg border border-rk-rose-300 shadow-sm">
                      新着
                    </span>
                  ) : hasActiveRecruitments ? (
                    <span className="pointer-events-none absolute -top-1.5 left-2 z-[90] bg-rk-amber-100 text-[9px] px-1.5 py-0.5 rounded-lg border border-rk-amber-300 shadow-sm">
                      募集
                    </span>
                  ) : null}
                  <span className="text-lg leading-none shrink-0" aria-hidden>
                    🔍
                  </span>
                  <span className="text-[15px] xs:text-base leading-tight text-rk-sky-950 font-black">ひと言探し</span>
                  {hundredRecruitHasNew ? (
                    <span className="text-[10px] text-rk-red-600">新着あり</span>
                  ) : hasActiveRecruitments ? (
                    <span className="text-[10px] text-rk-sky-800/90">募集あり</span>
                  ) : null}
                </button>

                {/* 掲示板（1行・従来サイズ） */}
                <button
                  type="button"
                  aria-label="掲示板"
                  className={`${hubBtn} col-span-2 bg-gradient-to-r from-rk-violet-200 to-rk-indigo-200 border-rk-indigo-700/40 text-rk-indigo-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('keijiban');
                    vibrate(10);
                    if (!hasProfile) {
                      window.dispatchEvent(
                        new CustomEvent('SHOW_TOAST', {
                          detail: '掲示板を見ることはできます。投稿する前に「絵文字・ニックネーム」を入れてください',
                        })
                      );
                    }
                    onOpenKeijiban();
                  }}
                >
                  <span className="text-lg leading-none">📋</span>
                  <span className="text-center leading-tight flex flex-col gap-0.5">
                    <span>掲示板</span>
                    {renrakuchoHasUnread ? (
                      <span className="text-[10px] text-rk-indigo-800/90">未読あり</span>
                    ) : null}
                  </span>
                </button>

                {/* ちょっと誰かに聞いて欲しい人のためのノート */}
                <button
                  type="button"
                  aria-label={OUEN_NOTE_TITLE}
                  className={`${hubBtn} col-span-2 relative bg-gradient-to-r from-rk-teal-100 via-rk-teal-50 to-rk-sky-50 border-rk-teal-600/35 text-rk-teal-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('note');
                    vibrate(10);
                    if (!OUEN_NOTE_HUB_LIVE) {
                      setShowOuenNotePrepPopup(true);
                      return;
                    }
                    if (OUEN_NOTE_HUB_TESTING) {
                      setShowOuenNotePrepPopup(true);
                      return;
                    }
                    void onOpenOuenNote();
                  }}
                >
                  {!OUEN_NOTE_HUB_LIVE ? (
                    <span className="absolute top-1.5 right-2 z-10 px-2 py-0.5 rounded-md border-2 border-rk-red-600 bg-rk-red-600 text-rk-white text-[10px] font-black shadow-sm pointer-events-none">
                      準備中
                    </span>
                  ) : OUEN_NOTE_HUB_TESTING ? (
                    <span className="absolute top-1.5 right-2 z-10 px-2 py-0.5 rounded-md border-2 border-rk-amber-600 bg-rk-amber-500 text-rk-white text-[10px] font-black shadow-sm pointer-events-none">
                      テスト中
                    </span>
                  ) : null}
                  <span className="text-lg leading-none shrink-0" aria-hidden>
                    📝
                  </span>
                  <span className="text-center leading-tight flex flex-col gap-0.5">
                    <span className="text-[13px] xs:text-sm font-black">{OUEN_NOTE_TITLE}</span>
                    <span className="text-[10px] font-bold text-rk-teal-900/75">しゅっせき{OUEN_NOTE_MIN_STAMPS}日以上・らくだの空気が分かる方へ</span>
                    {ouenNoteHasUnread ? (
                      <span className="text-[10px] text-rk-teal-900/90">未読あり</span>
                    ) : null}
                  </span>
                </button>

                {/* 連続小説 */}
                <button
                  type="button"
                  aria-label="連続小説"
                  className={`${hubBtn} col-span-2 bg-gradient-to-r from-rk-amber-100 via-rk-orange-50 to-rk-amber-200 border-rk-amber-700/35 text-rk-amber-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('relay_story');
                    vibrate(10);
                    onOpenRelayStory();
                  }}
                >
                  <span className="text-lg leading-none shrink-0" aria-hidden>
                    📖
                  </span>
                  <span className="text-center leading-tight flex flex-col gap-0.5">
                    <span className="font-black">連続小説</span>
                    <span className="text-[10px] font-bold text-rk-amber-900/80">起・承・転・結</span>
                  </span>
                </button>

                {/* リバーシ */}
                <button
                  type="button"
                  aria-label="リバーシ"
                  className={`${hubBtnHalf} bg-gradient-to-br from-rk-success-700 via-rk-success-800 to-rk-success-950 border-rk-success-900/45 text-rk-slate-50 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('reversi');
                    requireProfile(onOpenOthello);
                  }}
                >
                  <span className="inline-flex gap-0.5 shrink-0" aria-hidden>
                    <span className="size-3 rounded-full bg-rk-slate-900 border border-rk-slate-700" />
                    <span className="size-3 rounded-full bg-rk-white border border-rk-slate-300" />
                  </span>
                  <span>リバーシ</span>
                  {reversiRecruitHostWaiting ? (
                    <span
                      className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-[90] ${REVERSI_RECRUIT_HOST_BADGE_CLASS.replace('font-black', 'font-normal')}`}
                    >
                      募集中
                    </span>
                  ) : reversiRecruitHasOpen ? (
                    <span
                      className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-[90] ${REVERSI_RECRUIT_BADGE_CLASS.replace('font-black', 'font-normal')}`}
                    >
                      募集あり
                    </span>
                  ) : null}
                </button>

                {/* 五目並べ */}
                <button
                  type="button"
                  aria-label="五目並べ"
                  className={`${hubBtnHalf} bg-gradient-to-br from-rk-amber-200 via-rk-amber-100 to-rk-amber-300 border-rk-amber-800/35 text-rk-amber-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('gomoku');
                    requireProfile(onOpenGomoku);
                  }}
                >
                  {gomokuRecruitHostWaiting ? (
                    <span
                      className={`pointer-events-none absolute -top-2 right-2 z-[90] ${GOMOKU_RECRUIT_HOST_BADGE_CLASS.replace('font-black', 'font-normal')}`}
                    >
                      募集中
                    </span>
                  ) : gomokuRecruitHasOpen ? (
                    <span
                      className={`pointer-events-none absolute -top-2 right-2 z-[90] ${GOMOKU_RECRUIT_BADGE_CLASS.replace('font-black', 'font-normal')}`}
                    >
                      募集あり
                    </span>
                  ) : null}
                  <span className="inline-flex gap-0.5 shrink-0" aria-hidden>
                    <span className="size-3 rounded-full bg-rk-slate-900 border border-rk-slate-700" />
                    <span className="size-2.5 rounded-full bg-rk-white border border-rk-slate-300 mt-0.5" />
                  </span>
                  <span className="text-center leading-tight flex flex-col gap-0.5">
                    <span>五目並べ</span>
                    <span className="text-[10px] font-bold text-rk-amber-900/80">13 / 15</span>
                  </span>
                </button>

                {/* 9×9数字パズル */}
                <button
                  type="button"
                  aria-label="9×9数字パズル"
                  className={`${hubBtnHalf} bg-gradient-to-br from-rk-indigo-200 via-rk-sky-100 to-rk-indigo-200 border-rk-indigo-700/40 text-rk-indigo-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('sudoku');
                    requireProfile(onOpenSudoku);
                  }}
                >
                  <Grid3x3 className="w-5 h-5 shrink-0 opacity-90" aria-hidden />
                  <span className="text-center leading-tight flex flex-col gap-0.5">
                    <span>9×9数字</span>
                    <span className="text-[10px] font-bold text-rk-indigo-800/85">1〜9を並べる</span>
                  </span>
                </button>

                {/* スライドパズル */}
                <button
                  type="button"
                  className={`${hubBtnHalf} bg-gradient-to-br from-rk-violet-200 via-rk-indigo-200 to-rk-violet-300 border-rk-violet-700/45 text-rk-violet-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('slide_puzzle');
                    requireProfile(onOpenSlidePuzzle);
                  }}
                >
                  <LayoutGrid className="w-5 h-5 shrink-0 opacity-90" />
                  <span>スライドパズル</span>
                </button>

                {/* しずかの間（らくだNote） */}
                <button
                  type="button"
                  aria-label="しずかの間（らくだNote）"
                  className={`${hubBtnHalf} bg-gradient-to-r from-rk-slate-900 via-rest-bg/20 to-rk-blue-950 border-rest-accent/50 text-rk-sky-50 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('quiet_room');
                    requireProfile(onSelectQuietRoom);
                  }}
                >
                  <Moon className="w-5 h-5 shrink-0 opacity-90" />
                  <span className="text-center leading-tight text-[13px] xs:text-sm font-black">
                    しずかの間（らくだNote）
                  </span>
                </button>

                {/* しゅっせき簿（1行・従来サイズ） */}
                <button
                  type="button"
                  className={`${hubBtn} col-span-2 bg-gradient-to-r from-rk-success-300 to-rk-success-300 border-rk-success-600/55 text-rk-success-950 shadow-md`}
                  onClick={() => {
                    trackRakudaHubMenu('stamp_card');
                    requireProfile(onOpenStampCard);
                  }}
                >
                  <span className="text-lg leading-none">💮</span>
                  <span>しゅっせき簿</span>
                </button>

                {/* 遊び方ガイド（静的ページ・別タブ） */}
                <a
                  href="/guide/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackRakudaHubMenu('guide')}
                  className={`${hubBtn} col-span-2 bg-gradient-to-r from-rk-sky-50 to-rk-cyan-50 border-rk-sky-400/70 text-rk-sky-950 shadow-sm`}
                >
                  <BookOpen className="w-5 h-5 shrink-0 opacity-90" aria-hidden />
                  <span>遊び方ガイド</span>
                </a>
              </nav>
            }
            footer={
              <div className="flex flex-col items-center gap-1 text-[10px] text-rk-amber-950/80 font-medium">
                <span>&copy; 2026 らくだ珈琲</span>
              </div>
            }
          />
        </div>
      </div>
    </div>
    <OuenNotePrepPopup
      open={showOuenNotePrepPopup}
      onDismiss={() => setShowOuenNotePrepPopup(false)}
      onProceed={
        OUEN_NOTE_HUB_LIVE && OUEN_NOTE_HUB_TESTING
          ? () => {
              setShowOuenNotePrepPopup(false);
              void onOpenOuenNote();
            }
          : undefined
      }
    />
    </>
  );
};

export default SeatSelection;
