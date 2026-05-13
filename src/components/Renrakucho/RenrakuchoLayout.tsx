import React from 'react';
import RakudaFloatingBackdrop from '../RakudaFloatingBackdrop';
import type { ActiveUser } from './types';
import NotificationToast from './NotificationToast';
import ProfileSetupModal from './ProfileSetupModal';
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
  activeTab: 'main' | 'admin';
  setActiveTab: React.Dispatch<React.SetStateAction<'main' | 'admin'>>;
  isAdmin: boolean;
  unreadCount: number;
  activeUsers: ActiveUser[];
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
  children: React.ReactNode;
}> = ({
  onBack,
  themeVariant = 'default',
  headerTitle,
  suppressActiveUsersStrip = false,
  activeTab,
  setActiveTab,
  isAdmin,
  unreadCount,
  activeUsers,
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
  children,
}) => {
  return (
    <div
      className={
        themeVariant === 'hundred'
          ? 'fixed inset-0 z-[200] flex flex-col font-rounded text-slate-800 overflow-hidden bg-gradient-to-b from-rose-200 via-red-100 to-rose-300'
          : 'fixed inset-0 z-[200] flex flex-col font-rounded text-slate-800 overflow-hidden bg-gradient-to-b from-amber-200 via-[#ebe4d6] to-amber-300'
      }
    >
      <RakudaFloatingBackdrop variant={themeVariant === 'hundred' ? 'minna' : 'renraku'} />
      <Header onBack={onBack} variant={themeVariant} title={headerTitle} />

      <TabBar
        themeVariant={themeVariant}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        unreadCount={unreadCount}
      />

      <MainContainer
        activeUsers={activeUsers}
        variant={themeVariant}
        suppressActiveUsersStrip={suppressActiveUsersStrip}
      >
        {children}
      </MainContainer>

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
      />
    </div>
  );
};

export default RenrakuchoLayout;
