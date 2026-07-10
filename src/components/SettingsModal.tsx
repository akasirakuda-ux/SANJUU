
import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { audioService } from '../services/audioService';
import { LEGAL_TEXTS } from '../constants/legal';
import { PARENT_REASSURANCE } from '../constants/parentReassurance';
import { btnGhost, cardClass } from '../ui/policy';
import type { RakudaGateId } from '../lib/rakudaGate';
import { gateLabelJa } from '../lib/rakudaGate';
import { isGoogleSignedInUser } from '../lib/rakudaHubShell';
import { isRenrakuAdmin } from '../lib/renrakuAdmin';
import {
  GREEN_GATE_CANCEL_NOTE_JA,
  GREEN_GATE_CANCEL_STEPS_JA,
  GREEN_GATE_ENTRANCE_CLOSED_BODY,
  GREEN_GATE_PITCH_BODY,
  GREEN_GATE_PITCH_BODY_DEV,
  GREEN_GATE_PITCH_BODY_PENDING,
  GREEN_GATE_PRICE_LABEL,
  isGreenGateEntranceClosed,
} from '../lib/greenGateStripeConfig';
import { RAKUDA_SUPPORT_GATE_LABEL, RAKUDA_SUPPORT_GATE_SETTINGS_TITLE } from '../constants/rakudaSupportGateLabels';
import { trackRakudaHubMenu } from '../lib/rakudaGaEvents';
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBgmEnabled: boolean;
  onToggleBgm: () => void;
  /** 盤面の座標表示（A,B,C… / 1,2,3…） */
  coordOverlayEnabled?: boolean;
  onToggleCoordOverlay?: () => void;
  language: 'ja';
  rakudaGate?: RakudaGateId | null;
  onGreenGateCheckout?: () => void | Promise<void>;
  greenCheckoutBusy?: boolean;
  onGreenGateDevBypass?: () => void;
  firebaseUser?: User | null;
  isAuthReady?: boolean;
  onGoogleLogout?: () => void | Promise<void>;
  onGoogleLoginPopup?: () => void | Promise<void>;
  onGoogleLoginRedirect?: () => void | Promise<void>;
  /** 緑ゲート有効期限（Stripe / 配布コード） */
  greenGateUntilMs?: number | null;
  /** 月額 Stripe の解約・カード変更ポータルへ誘導できる */
  greenGateHasStripeBilling?: boolean;
  stripeGreenEnabled?: boolean;
  onGreenGateManageBilling?: () => void | Promise<void>;
  greenGatePortalBusy?: boolean;
}

type SettingsView = 'main' | 'terms' | 'privacy' | 'contact' | 'tokushoho';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isBgmEnabled,
  onToggleBgm,
  coordOverlayEnabled = false,
  onToggleCoordOverlay,
  language,
  rakudaGate = null,
  onGreenGateCheckout,
  greenCheckoutBusy = false,
  onGreenGateDevBypass,
  firebaseUser = null,
  isAuthReady = true,
  onGoogleLogout,
  onGoogleLoginPopup,
  onGoogleLoginRedirect,
  greenGateUntilMs = null,
  greenGateHasStripeBilling = false,
  stripeGreenEnabled = false,
  onGreenGateManageBilling,
  greenGatePortalBusy = false,
}) => {
  const [volume, setVolume] = useState(audioService.getVolume());
  const [view, setView] = useState<SettingsView>('main');
  const [logoutBusy, setLogoutBusy] = useState(false);

  const showGoogleLogout =
    isAuthReady && isGoogleSignedInUser(firebaseUser) && !!onGoogleLogout;
  const googleSignedIn = isAuthReady && isGoogleSignedInUser(firebaseUser);
  const googleEmail = (firebaseUser?.email ?? '').trim();
  const isAdminUser = googleSignedIn && isRenrakuAdmin(firebaseUser);

  const greenGateActive =
    rakudaGate === 'green' ||
    (greenGateUntilMs != null && Number.isFinite(greenGateUntilMs) && Date.now() < greenGateUntilMs);
  const greenUntilLabel =
    greenGateUntilMs != null && Number.isFinite(greenGateUntilMs)
      ? new Date(greenGateUntilMs).toLocaleDateString('ja-JP')
      : null;
  /** 配布コードのみ（月額 Stripe なし） */
  const isPassOnlyGreen =
    googleSignedIn &&
    greenGateActive &&
    !greenGateHasStripeBilling &&
    greenUntilLabel != null;
  /** 月額契約者向け — 緑表示中でなくても常に出す（ログアウト・青ゲート選択中も） */
  const showMonthlyCancelGuide =
    stripeGreenEnabled && !!onGreenGateManageBilling && !isPassOnlyGreen;
  const showStripePortalButton =
    showMonthlyCancelGuide && googleSignedIn && greenGateHasStripeBilling;
  const showStripeLoginFirst =
    showMonthlyCancelGuide &&
    !googleSignedIn &&
    (!!onGoogleLoginPopup || !!onGoogleLoginRedirect);
  const showPassOnlyGreenNote = isPassOnlyGreen;
  const showStripeAccountMismatch =
    showMonthlyCancelGuide && googleSignedIn && !greenGateHasStripeBilling && !isAdminUser;
  const showAdminBillingNote =
    showMonthlyCancelGuide && googleSignedIn && !greenGateHasStripeBilling && isAdminUser;
  const greenEntranceClosed = isGreenGateEntranceClosed();
  const showSupportCheckout =
    !greenGateActive &&
    !greenEntranceClosed &&
    (stripeGreenEnabled || (import.meta.env.DEV && !!onGreenGateDevBypass));
  const showSupportClosed = !greenGateActive && greenEntranceClosed;
  const supportPitchBody = stripeGreenEnabled
    ? GREEN_GATE_PITCH_BODY
    : import.meta.env.DEV
      ? GREEN_GATE_PITCH_BODY_DEV
      : GREEN_GATE_PITCH_BODY_PENDING;
  
  if (!isOpen) return null;

  const t = {
    header: 'せってい',
    music: '音楽',
    coordTitle: '座標表示',
    coordHint: '盤面に A,B,C… と 1,2,3… を表示します（ことば探し・リバーシのみ）',
    officialLabel: '公式BGM',
    bgmName: 'ことばのピコピコ行進曲 - Original Synth',
    volume: '音量',
    close: 'とじる',
    back: 'もどる',
    legal: {
      guide: '遊び方ガイド',
      terms: '利用規約',
      privacy: 'プライバシーポリシー',
      contact: 'お問い合わせ',
      tokushoho: '特定商取引法に基づく表記',
    },
    gateCurrent: rakudaGate ? gateLabelJa(rakudaGate) : RAKUDA_SUPPORT_GATE_LABEL,
    greenBillingTitle: `${RAKUDA_SUPPORT_GATE_LABEL}（${GREEN_GATE_PRICE_LABEL}）の解約`,
    greenBillingIntro: '利用者の方は、次の順番で解約できます（運営への連絡は不要です）。',
    greenBillingIntroAdmin:
      `利用者向けの案内です。解約ボタンの確認は、${RAKUDA_SUPPORT_GATE_LABEL}を申し込んだ Google アカウントでログインしてください。`,
    greenBillingUntil: greenUntilLabel ? `広告なしの有効期限: ${greenUntilLabel} まで` : '',
    greenBillingNote: GREEN_GATE_CANCEL_NOTE_JA,
    greenBillingButton: '解約・カード変更（Stripe）',
    greenBillingStep3Lead: '↓ ③ のボタンはここです（申込と同じ Google でログインすると緑色で出ます）',
    greenBillingStep3Hidden: 'いまは出ていません',
    greenBillingLoginFirst:
      `② のログインには、${RAKUDA_SUPPORT_GATE_LABEL}を申し込んだときと同じ Google アカウントが必要です。`,
    greenBillingReady: (email: string) => `ログイン中: ${email} — ③ のボタンから解約できます`,
    greenBillingLoginButton: 'Google でログイン（ポップアップ）',
    greenBillingLoginRedirectButton: 'うまくいかないとき（ページ移動でログイン）',
    greenBillingMismatch: (email: string) =>
      `ログイン中: ${email} — こちらのアカウントでは${RAKUDA_SUPPORT_GATE_LABEL}の解約ボタンは出ません。`,
    greenBillingMismatchHint:
      `${RAKUDA_SUPPORT_GATE_LABEL}を申し込んだときと同じ Google アカウントでログインし直してください。`,
    greenBillingAdminNote: (email: string) =>
      `管理者としてログイン中: ${email} — 運営用アカウントに${RAKUDA_SUPPORT_GATE_LABEL}の登録はありません（正常です）。`,
    greenBillingAdminHint:
      `解約ボタンの動作確認は、Stripe で${GREEN_GATE_PRICE_LABEL}を払った Google アカウントでログインしてください。`,
    greenBillingLogoutSwitch: '別の Google アカウントに切り替える（ログアウト）',
    greenPassNoteTitle: `配布コードの${RAKUDA_SUPPORT_GATE_LABEL}`,
    greenPassNoteBody: greenUntilLabel
      ? `解約の手続きは不要です。${greenUntilLabel} まで広告なしでお使いいただけます。`
      : '解約の手続きは不要です。',
    supportActiveTitle: `${RAKUDA_SUPPORT_GATE_LABEL} 有効中`,
    supportActiveBody: greenUntilLabel
      ? `${greenUntilLabel} まで広告なしでお使いいただけます。`
      : '広告なしでお使いいただけます。',
    supportCheckoutButton: greenCheckoutBusy ? '準備中…' : '応援する（決済へ）',
    supportDevButton: '応援する（テスト）',
    logoutTitle: PARENT_REASSURANCE.logoutTitle,
    logoutHint: PARENT_REASSURANCE.logoutHint,
    logoutButton: PARENT_REASSURANCE.logoutButton,
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    audioService.setVolume(newVol);
  };

  const handleLogout = async (keepOpen = false) => {
    if (!onGoogleLogout || logoutBusy) return;
    setLogoutBusy(true);
    try {
      await onGoogleLogout();
      if (!keepOpen) onClose();
    } finally {
      setLogoutBusy(false);
    }
  };

  const renderLegalView = (type: 'terms' | 'privacy' | 'contact' | 'tokushoho') => {
    const legal = LEGAL_TEXTS[language][type];
    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => setView('main')}
            className="w-12 h-12 flex items-center justify-center bg-rk-slate-100 rounded-xl text-rk-slate-500 hover:bg-rk-slate-200 transition-all active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-medium text-rk-slate-700">{legal.title}</h3>
        </div>
        <div className="flex-grow overflow-y-auto bg-rk-slate-50 rounded-xl p-5 border-2 border-rk-slate-100 max-h-[min(52dvh,480px)] custom-scrollbar">
          <div className="text-xs font-bold text-rk-slate-600 leading-relaxed whitespace-pre-wrap">
            {legal.content}
          </div>
        </div>
        <button 
          onClick={() => setView('main')} 
          className={`${btnGhost} w-full mt-3`}
        >
          {t.back}
        </button>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-[300] flex items-center justify-center px-2.5 py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-rk-slate-50/90 backdrop-blur-sm">
      <div
        className={`${cardClass} w-full max-w-[min(100%,36rem)] h-[min(88dvh,calc(100%-1.5rem))] flex flex-col overflow-hidden !p-4 sm:!p-5`}
      >
        {view === 'main' ? (
          <>
            {/* Header */}
            <div className="relative flex items-center justify-center mb-6 flex-shrink-0">
              <h3 className="text-sm font-medium text-rk-slate-700">{t.header}</h3>
              <button onClick={onClose} className={`absolute right-0 ${btnGhost}`}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow flex flex-col justify-between overflow-y-auto custom-scrollbar pr-1 gap-4">
              {/* Main Music Control Section */}
              <div className="px-4 py-5 rounded-xl border border-rk-slate-100 bg-rk-white/80 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isBgmEnabled ? 'bg-rk-primary/20 text-rk-primary' : 'bg-rk-slate-200 text-rk-slate-400'}`}>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          {isBgmEnabled ? <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/> : <path d="M4.27 3L3 4.27l9 9v.28c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.73L19.73 21 21 19.73 4.27 3zM14 7h4V3h-6v5.18l2 2z"/>}
                        </svg>
                      </div>
                      <span className="font-black text-rk-slate-700 text-lg tracking-tight">{t.music}</span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isBgmEnabled}
                    onClick={onToggleBgm}
                    className={`relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rk-primary/50 focus-visible:ring-offset-2 ${
                      isBgmEnabled ? 'bg-rk-primary' : 'bg-rk-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 rounded-full bg-rk-white shadow-md ring-0 transition-transform duration-200 ease-out ${
                        isBgmEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Song Info Badge */}
                <div className="bg-rk-white px-6 py-4 rounded-xl border border-rk-slate-200/50 shadow-sm flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm bg-rk-success-400" />
                    <span className="text-[9px] font-black text-rk-success-600 uppercase tracking-[0.2em]">
                      {t.officialLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg className="w-3.5 h-3.5 text-rk-primary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <span className="text-[11px] font-black text-rk-slate-600 truncate">
                      {t.bgmName}
                    </span>
                  </div>
                </div>

                {/* Volume Control */}
                <div className={`space-y-3 transition-all duration-500 ${isBgmEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-rk-slate-400 uppercase tracking-widest">{t.volume}</span>
                    <span className="text-[10px] font-black text-rk-primary tabular-nums">{Math.round(volume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume} 
                      onChange={handleVolumeChange}
                      className="w-full h-2.5 bg-rk-slate-200 rounded-xl appearance-none cursor-pointer accent-rk-primary"
                      style={{
                        WebkitAppearance: 'none',
                        background: `linear-gradient(to right, var(--rk-accent-primary) 0%, var(--rk-accent-primary) ${volume * 100}%, var(--rk-slate-200) ${volume * 100}%, var(--rk-slate-200) 100%)`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 py-4 rounded-xl border border-rk-slate-100 bg-rk-white/80 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-rk-slate-700 text-lg tracking-tight">{t.coordTitle}</p>
                    <p className="text-[10px] font-bold text-rk-slate-600 leading-relaxed">{t.coordHint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={coordOverlayEnabled}
                    onClick={() => onToggleCoordOverlay?.()}
                    disabled={!onToggleCoordOverlay}
                    className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rk-primary/50 focus-visible:ring-offset-2 disabled:opacity-40 ${
                      coordOverlayEnabled ? 'bg-rk-sky-600' : 'bg-rk-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 rounded-full bg-rk-white shadow-md ring-0 transition-transform duration-200 ease-out ${
                        coordOverlayEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {showMonthlyCancelGuide ? (
                <div className="px-4 py-4 rounded-xl border-2 border-rk-success-400 bg-rk-success-50/95 space-y-3">
                  <div className="text-[10px] font-black text-rk-success-900/80 uppercase tracking-widest">
                    {t.greenBillingTitle}
                  </div>
                  <p className="text-[11px] font-bold text-rk-slate-700 leading-relaxed">
                    {isAdminUser ? t.greenBillingIntroAdmin : t.greenBillingIntro}
                  </p>
                  <ol className="space-y-2 pl-1">
                    {GREEN_GATE_CANCEL_STEPS_JA.map((step, i) => (
                      <li
                        key={step}
                        className="flex gap-2 text-[11px] font-bold text-rk-slate-700 leading-relaxed"
                      >
                        <span className="shrink-0 w-5 h-5 rounded-full bg-rk-success-600 text-rk-white text-[10px] font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-[10px] font-bold text-rk-slate-600 leading-relaxed">{t.greenBillingNote}</p>
                  {t.greenBillingUntil ? (
                    <p className="text-[11px] font-bold text-rk-success-900">{t.greenBillingUntil}</p>
                  ) : null}
                  <div className="space-y-2">
                    {!showStripePortalButton ? (
                      <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">{t.greenBillingStep3Lead}</p>
                    ) : null}
                    {showStripePortalButton ? (
                      <>
                        {googleSignedIn && googleEmail ? (
                          <p
                            className="text-[11px] font-bold text-rk-success-900 leading-relaxed break-all"
                            title={googleEmail}
                          >
                            {t.greenBillingReady(googleEmail)}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void onGreenGateManageBilling?.()}
                          disabled={greenGatePortalBusy}
                          className="w-full py-3 rounded-xl border-2 border-rk-success-600 bg-rk-success-600 text-rk-white font-black text-sm shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
                        >
                          {greenGatePortalBusy ? 'Stripe を開いています…' : t.greenBillingButton}
                        </button>
                      </>
                    ) : (
                      <div
                        className="w-full py-3 rounded-xl border-2 border-dashed border-rk-slate-300 bg-rk-white/90 text-rk-slate-500 font-black text-sm text-center"
                        aria-hidden
                      >
                        {t.greenBillingButton}（{t.greenBillingStep3Hidden}）
                      </div>
                    )}
                  </div>
                  {showStripeLoginFirst ? (
                    <>
                      <p className="text-[11px] font-bold text-rk-sky-800 leading-relaxed">{t.greenBillingLoginFirst}</p>
                      {onGoogleLoginPopup ? (
                        <button
                          type="button"
                          onClick={() => void onGoogleLoginPopup()}
                          className="w-full py-3 rounded-xl border-2 border-rk-sky-500 bg-rk-sky-600 text-rk-white font-black text-sm shadow-sm active:scale-[0.99] transition-transform"
                        >
                          {t.greenBillingLoginButton}
                        </button>
                      ) : null}
                      {onGoogleLoginRedirect ? (
                        <button
                          type="button"
                          onClick={() => void onGoogleLoginRedirect()}
                          className="w-full py-2.5 rounded-xl border-2 border-rk-sky-300 bg-rk-white text-rk-sky-900 font-black text-xs shadow-sm active:scale-[0.99] transition-transform"
                        >
                          {t.greenBillingLoginRedirectButton}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {showAdminBillingNote ? (
                    <div className="space-y-2 rounded-xl border border-rk-sky-200 bg-rk-sky-50/90 px-3 py-3">
                      <p
                        className="text-[11px] font-bold text-rk-sky-900 leading-relaxed break-all"
                        title={googleEmail || undefined}
                      >
                        {t.greenBillingAdminNote(googleEmail || '（メール未取得）')}
                      </p>
                      <p className="text-[11px] font-bold text-rk-sky-800 leading-relaxed">{t.greenBillingAdminHint}</p>
                      {onGoogleLogout ? (
                        <button
                          type="button"
                          onClick={() => void handleLogout(true)}
                          disabled={logoutBusy}
                          className="w-full py-2.5 rounded-xl border-2 border-rk-sky-300 bg-rk-white text-rk-sky-900 font-black text-xs shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
                        >
                          {logoutBusy ? 'ログアウト中…' : t.greenBillingLogoutSwitch}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {showStripeAccountMismatch ? (
                    <div className="space-y-2 rounded-xl border border-rk-amber-200 bg-rk-amber-50/90 px-3 py-3">
                      <p
                        className="text-[11px] font-bold text-rk-amber-950 leading-relaxed break-all"
                        title={googleEmail || undefined}
                      >
                        {t.greenBillingMismatch(googleEmail || '（メール未取得）')}
                      </p>
                      <p className="text-[11px] font-bold text-rk-amber-900 leading-relaxed">{t.greenBillingMismatchHint}</p>
                      {onGoogleLogout ? (
                        <button
                          type="button"
                          onClick={() => void handleLogout(true)}
                          disabled={logoutBusy}
                          className="w-full py-2.5 rounded-xl border-2 border-rk-amber-300 bg-rk-white text-rk-amber-950 font-black text-xs shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
                        >
                          {logoutBusy ? 'ログアウト中…' : t.greenBillingLogoutSwitch}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showPassOnlyGreenNote ? (
                <div className="px-4 py-4 rounded-xl border border-rk-success-200 bg-rk-white/90 space-y-1">
                  <div className="text-[10px] font-black text-rk-success-900/80 uppercase tracking-widest">
                    {t.greenPassNoteTitle}
                  </div>
                  <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">{t.greenPassNoteBody}</p>
                </div>
              ) : null}

              {greenGateActive && !showMonthlyCancelGuide && !showPassOnlyGreenNote ? (
                <div className="px-4 py-4 rounded-xl border border-rk-success-200 bg-rk-success-50/90 space-y-1">
                  <div className="text-[10px] font-black text-rk-success-900/80 uppercase tracking-widest">
                    {t.supportActiveTitle}
                  </div>
                  <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">{t.supportActiveBody}</p>
                </div>
              ) : null}

              {showSupportClosed ? (
                <div className="px-4 py-4 rounded-xl border border-rk-slate-300 bg-rk-slate-50/90 space-y-2">
                  <div className="text-[10px] font-black text-rk-slate-700 uppercase tracking-widest">
                    {RAKUDA_SUPPORT_GATE_SETTINGS_TITLE}
                  </div>
                  <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed whitespace-pre-wrap">
                    {GREEN_GATE_ENTRANCE_CLOSED_BODY}
                  </p>
                </div>
              ) : null}

              {showSupportCheckout ? (
                <div className="px-4 py-4 rounded-xl border border-rk-success-300 bg-rk-success-50/90 space-y-3">
                  <div className="text-[10px] font-black text-rk-success-900/80 uppercase tracking-widest">
                    {RAKUDA_SUPPORT_GATE_SETTINGS_TITLE}
                  </div>
                  <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed whitespace-pre-wrap">
                    {supportPitchBody}
                  </p>
                  {stripeGreenEnabled && onGreenGateCheckout ? (
                    <button
                      type="button"
                      onClick={() => void onGreenGateCheckout()}
                      disabled={greenCheckoutBusy}
                      className="w-full py-3 rounded-xl border-2 border-rk-success-600 bg-rk-success-600 text-rk-white font-black text-sm shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
                    >
                      {t.supportCheckoutButton}
                    </button>
                  ) : null}
                  {import.meta.env.DEV && onGreenGateDevBypass ? (
                    <button
                      type="button"
                      onClick={onGreenGateDevBypass}
                      className="w-full py-2.5 rounded-xl border-2 border-rk-success-400 bg-rk-white text-rk-success-900 font-black text-xs shadow-sm active:scale-[0.99] transition-transform"
                    >
                      {t.supportDevButton}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {showGoogleLogout ? (
                <div className="px-4 py-4 rounded-xl border border-rk-sky-200 bg-rk-sky-50/80 space-y-3">
                  <div className="text-[10px] font-black text-rk-sky-900/70 uppercase tracking-widest">
                    {t.logoutTitle}
                  </div>
                  {googleEmail ? (
                    <p className="text-xs font-bold text-rk-slate-700 truncate" title={googleEmail}>
                      {googleEmail}
                    </p>
                  ) : null}
                  <p className="text-[11px] font-bold text-rk-slate-600 leading-relaxed">{t.logoutHint}</p>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={logoutBusy}
                    className="w-full py-3 rounded-xl border-2 border-rk-sky-400 bg-rk-white text-rk-sky-950 font-black text-sm shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
                  >
                    {logoutBusy ? 'ログアウト中…' : t.logoutButton}
                  </button>
                </div>
              ) : null}

              {/* Legal Links Section */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <a
                  href="/guide/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackRakudaHubMenu('guide')}
                  className="flex items-center justify-center px-8 py-4 bg-rk-sky-50 rounded-xl border-2 border-rk-sky-300 text-rk-sky-950 shadow-sm hover:bg-rk-sky-100 hover:border-rk-sky-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.guide}</span>
                </a>
                <button 
                  onClick={() => setView('terms')}
                  className="flex items-center justify-center px-8 py-4 bg-rk-success-50 rounded-xl border-2 border-rk-success-300 text-rk-success-950 shadow-sm hover:bg-rk-success-100 hover:border-rk-success-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.terms}</span>
                </button>
                <button 
                  onClick={() => setView('privacy')}
                  className="flex items-center justify-center px-8 py-4 bg-rk-success-50 rounded-xl border-2 border-rk-success-300 text-rk-success-950 shadow-sm hover:bg-rk-success-100 hover:border-rk-success-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.privacy}</span>
                </button>
                <button 
                  onClick={() => setView('contact')}
                  className="flex items-center justify-center px-8 py-4 bg-rk-success-50 rounded-xl border-2 border-rk-success-300 text-rk-success-950 shadow-sm hover:bg-rk-success-100 hover:border-rk-success-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.contact}</span>
                </button>
                <button 
                  onClick={() => setView('tokushoho')}
                  className="flex items-center justify-center px-8 py-4 bg-rk-success-50 rounded-xl border-2 border-rk-success-300 text-rk-success-950 shadow-sm hover:bg-rk-success-100 hover:border-rk-success-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.tokushoho}</span>
                </button>
              </div>

              {/* Close Button */}
              <div className="pt-2 flex flex-col items-center gap-2 flex-shrink-0">
                <button 
                  onClick={onClose} 
                  className="w-full py-4 bg-rk-primary text-rk-white rounded-lg font-black text-xl shadow-[0_6px_0_var(--rk-accent-primary-shadow)] hover:brightness-105 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center px-8"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </>
        ) : (
          renderLegalView(view as 'terms' | 'privacy' | 'contact' | 'tokushoho')
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
