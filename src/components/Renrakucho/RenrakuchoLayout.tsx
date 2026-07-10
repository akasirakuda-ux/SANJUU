import React from 'react';
import type { User } from 'firebase/auth';
import type { PlayRecruitBadgesByUid } from '../../hooks/useActiveUserPlayRecruitBadges';
import RakudaFloatingBackdrop from '../RakudaFloatingBackdrop';
import type { ActiveUser } from './types';
import NotificationToast from './NotificationToast';
import ProfileSetupModal from './ProfileSetupModal';
import RenrakuchoBreakPopup from './layout/RenrakuchoBreakPopup';
import Header from './layout/Header';
import TabBar from './layout/TabBar';
import MainContainer from './layout/MainContainer';

const RenrakuchoLayout: React.FC<{
  onBack: () => void;
  /** 連絡帳デフォルトは琥珀系、みんなであそぶフロー中は情熱の赤 */
  themeVariant?: 'default' | 'hundred';
  /** 上部見出し（未指定なら Header 既定の「みんなであそぶ（掲示板）」） */
  headerTitle?: string;
  /** みんなで待機ロビーなど、上部の「連絡帳をひらいている人」帯を隠す */
  suppressActiveUsersStrip?: boolean;
  /** `/keijiban` 見出し直下に参加者絵文字を出す */
  showHeaderActiveUserEmojis?: boolean;
  activeTab: 'main' | 'admin';
  setActiveTab: React.Dispatch<React.SetStateAction<'main' | 'admin'>>;
  isAdmin: boolean;
  unreadCount: number;
  activeUsers: ActiveUser[];
  playRecruitBadgesByUid?: PlayRecruitBadgesByUid;
  notification: { type: 'success' | 'error'; text: string } | null;
  setNotification: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
  showProfileSetup: boolean;
  setShowProfileSetup: React.Dispatch<React.SetStateAction<boolean>>;
  tempName: string;
  setTempName: React.Dispatch<React.SetStateAction<string>>;
  tempEmoji: string;
  setTempEmoji: React.Dispatch<React.SetStateAction<string>>;
  setNickname: (n: string) => void;
  setUserEmoji: (e: string) => void;
  showGoogleLoginBar?: boolean;
  onGoogleLogin?: () => void;
  /** 掲示板プロフィール登録時のなりすまし判定用（管理者のみ公式名OK） */
  profileAuthUser?: User | null;
  showBreakPopup?: boolean;
  onOpenBreakPopup?: () => void;
  onCloseBreakPopup?: () => void;
  canOpenBreakPopup?: boolean;
  currentUid?: string | null;
  myGreenUntilMs?: number | null;
  myShussekiRegular?: boolean;
  nickname?: string;
  userEmoji?: string;
  myOnBreak?: boolean;
  onToggleBreak?: () => void;
  breakToggleDisabled?: boolean;
  myPlayInvite?: boolean;
  onTogglePlayInvite?: () => void;
  playInviteToggleDisabled?: boolean;
  children: React.ReactNode;
}> = ({
  onBack,
  themeVariant = 'default',
  headerTitle,
  suppressActiveUsersStrip = false,
  showHeaderActiveUserEmojis = false,
  activeTab,
  setActiveTab,
  isAdmin,
  unreadCount,
  activeUsers,
  playRecruitBadgesByUid,
  notification,
  setNotification,
  showProfileSetup,
  setShowProfileSetup,
  tempName,
  setTempName,
  tempEmoji,
  setTempEmoji,
  setNickname,
  setUserEmoji,
  showGoogleLoginBar = false,
  onGoogleLogin,
  profileAuthUser,
  showBreakPopup = false,
  onOpenBreakPopup,
  onCloseBreakPopup,
  canOpenBreakPopup = false,
  currentUid,
  myGreenUntilMs = null,
  myShussekiRegular = false,
  nickname = '',
  userEmoji = '👤',
  myOnBreak = false,
  onToggleBreak,
  breakToggleDisabled = false,
  myPlayInvite = false,
  onTogglePlayInvite,
  playInviteToggleDisabled = false,
  children,
}) => {
  const handleSelfEmojiClick = canOpenBreakPopup ? onOpenBreakPopup : undefined;

  return (
    <div
      className={
        themeVariant === 'hundred'
          ? 'fixed inset-0 z-[200] flex flex-col font-rounded text-rk-slate-800 overflow-hidden bg-gradient-to-b from-rk-rose-200 via-rk-red-100 to-rk-rose-300'
          : 'fixed inset-0 z-[200] flex flex-col font-rounded text-rk-slate-800 overflow-hidden bg-gradient-to-b from-rk-amber-200 via-[var(--rk-hub-shell-mid)] to-rk-amber-300'
      }
    >
      {themeVariant !== 'hundred' ? (
        <RakudaFloatingBackdrop variant="renraku" />
      ) : null}
      <div
        className={`relative z-[2] isolate flex min-h-0 flex-1 flex-col overflow-hidden ${
          themeVariant === 'hundred'
            ? 'bg-rk-red-50'
            : 'bg-[var(--rk-hub-parchment-screen)]'
        }`}
      >
        <Header
          onBack={onBack}
          variant={themeVariant}
          title={headerTitle}
          activeUsers={activeUsers}
          showActiveUserEmojis={showHeaderActiveUserEmojis}
          playRecruitBadgesByUid={playRecruitBadgesByUid}
          currentUid={currentUid}
          myGreenUntilMs={myGreenUntilMs}
          myShussekiRegular={myShussekiRegular}
          onSelfEmojiClick={handleSelfEmojiClick}
        />

        {showGoogleLoginBar && onGoogleLogin ? (
          <div className="relative z-30 shrink-0 border-b-2 border-rk-sky-400 bg-rk-sky-50 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-[11px] font-bold text-rk-sky-950 leading-relaxed flex-1">
              <span className="font-black">Google でログイン</span>
              すると、記録の同期、しゅっせき簿、（管理者の）伝言の確認ができます。ゲストのままでは伝言を受け取れません。
            </p>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('SHOW_TOAST', { detail: 'Googleアカウントを選んでログインしてください' })
                );
                onGoogleLogin();
              }}
              className="shrink-0 rounded-xl border-2 border-rk-sky-600 bg-rk-sky-600 px-4 py-2 text-xs font-black text-rk-white active:scale-[0.98]"
            >
              Google でログイン
            </button>
          </div>
        ) : null}

        <TabBar
          themeVariant={themeVariant}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
        />

        <MainContainer
          activeUsers={activeUsers}
          playRecruitBadgesByUid={playRecruitBadgesByUid}
          variant={themeVariant}
          suppressActiveUsersStrip={suppressActiveUsersStrip}
          currentUid={currentUid}
          myGreenUntilMs={myGreenUntilMs}
          myShussekiRegular={myShussekiRegular}
          onSelfEmojiClick={handleSelfEmojiClick}
        >
          {children}
        </MainContainer>
      </div>

      <NotificationToast notification={notification} />

      <ProfileSetupModal
        showProfileSetup={showProfileSetup}
        setShowProfileSetup={setShowProfileSetup}
        tempName={tempName}
        setTempName={setTempName}
        tempEmoji={tempEmoji}
        setTempEmoji={setTempEmoji}
        setNotification={setNotification}
        setNickname={setNickname}
        setUserEmoji={setUserEmoji}
        authUser={profileAuthUser}
      />

      {canOpenBreakPopup && onToggleBreak && onTogglePlayInvite && onCloseBreakPopup ? (
        <RenrakuchoBreakPopup
          open={showBreakPopup}
          onClose={onCloseBreakPopup}
          myOnBreak={myOnBreak}
          onToggleBreak={onToggleBreak}
          myPlayInvite={myPlayInvite}
          onTogglePlayInvite={onTogglePlayInvite}
          disabled={breakToggleDisabled}
          playInviteDisabled={playInviteToggleDisabled}
          userEmoji={userEmoji}
          userName={nickname}
        />
      ) : null}
    </div>
  );
};

export default RenrakuchoLayout;
