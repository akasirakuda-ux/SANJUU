
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { audioService } from '../services/audioService';
import { APP_VERSION } from '../constants';
import { LEGAL_TEXTS } from '../constants/legal';
import { btnGhost, cardClass } from '../ui/policy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBgmEnabled: boolean;
  onToggleBgm: () => void;
  language: 'ja';
}

type SettingsView = 'main' | 'terms' | 'privacy' | 'contact';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isBgmEnabled, onToggleBgm, language }) => {
  const [volume, setVolume] = useState(audioService.getVolume());
  const [view, setView] = useState<SettingsView>('main');
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  
  if (!isOpen) return null;

  const t = {
    header: 'せってい',
    music: '音楽',
    officialLabel: '公式BGM',
    bgmName: 'ことばのピコピコ行進曲 - Original Synth',
    volume: '音量',
    close: 'とじる',
    back: 'もどる',
    version: `v${APP_VERSION}`,
    adminKeyLabel: '管理者キーを入力',
    adminKeyPlaceholder: 'キーを入力...',
    legal: {
      terms: '利用規約',
      privacy: 'プライバシーポリシー',
      contact: 'お問い合わせ',
    }
  };

  const handleAdminSubmit = () => {
    if (adminKeyInput) {
      window.dispatchEvent(new CustomEvent('ACTIVATE_MODULE', { detail: { key: adminKeyInput, moduleId: 'admin' } }));
      setAdminKeyInput('');
      setShowAdminInput(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    audioService.setVolume(newVol);
  };

  const renderLegalView = (type: 'terms' | 'privacy' | 'contact') => {
    const legal = LEGAL_TEXTS[language][type];
    return (
      <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => setView('main')}
            className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-xl text-slate-500 hover:bg-slate-200 transition-all active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-medium text-slate-700">{legal.title}</h3>
        </div>
        <div className="flex-grow overflow-y-auto bg-slate-50 rounded-xl p-5 border-2 border-slate-100 max-h-[350px] custom-scrollbar">
          <div className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
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
    <div className="absolute inset-0 z-[300] flex items-center justify-center bg-slate-50/90 backdrop-blur-sm">
      <div className={`${cardClass} w-[85%] max-w-md h-[70%] absolute top-[15%] flex flex-col overflow-hidden`}>
        {view === 'main' ? (
          <>
            {/* Header */}
            <div className="relative flex items-center justify-center mb-6 flex-shrink-0">
              <h3 className="text-sm font-medium text-slate-700">{t.header}</h3>
              <button onClick={onClose} className={`absolute right-0 ${btnGhost}`}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-grow flex flex-col justify-between overflow-y-auto custom-scrollbar pr-1 gap-4">
              {/* Main Music Control Section */}
              <div className="px-4 py-5 rounded-xl border border-slate-100 bg-white/80 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isBgmEnabled ? 'bg-[#00c874]/20 text-[#00c874]' : 'bg-slate-200 text-slate-400'}`}>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          {isBgmEnabled ? <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/> : <path d="M4.27 3L3 4.27l9 9v.28c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.73L19.73 21 21 19.73 4.27 3zM14 7h4V3h-6v5.18l2 2z"/>}
                        </svg>
                      </div>
                      <span className="font-black text-slate-700 text-lg tracking-tight">{t.music}</span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isBgmEnabled}
                    onClick={onToggleBgm}
                    className={`relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00c874]/50 focus-visible:ring-offset-2 ${
                      isBgmEnabled ? 'bg-[#00c874]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-7 w-7 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-out ${
                        isBgmEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Song Info Badge */}
                <div className="bg-white px-6 py-4 rounded-xl border border-slate-200/50 shadow-sm flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em]">
                      {t.officialLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg className="w-3.5 h-3.5 text-[#00c874] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <span className="text-[11px] font-black text-slate-600 truncate">
                      {t.bgmName}
                    </span>
                  </div>
                </div>

                {/* Volume Control */}
                <div className={`space-y-3 transition-all duration-500 ${isBgmEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.volume}</span>
                    <span className="text-[10px] font-black text-[#00c874] tabular-nums">{Math.round(volume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume} 
                      onChange={handleVolumeChange}
                      className="w-full h-2.5 bg-slate-200 rounded-xl appearance-none cursor-pointer accent-[#00c874]"
                      style={{
                        WebkitAppearance: 'none',
                        background: `linear-gradient(to right, #00c874 0%, #00c874 ${volume * 100}%, #e2e8f0 ${volume * 100}%, #e2e8f0 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Legal Links Section */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button 
                  onClick={() => setView('terms')}
                  className="flex items-center justify-center px-8 py-4 bg-emerald-50 rounded-xl border-2 border-emerald-300 text-emerald-950 shadow-sm hover:bg-emerald-100 hover:border-emerald-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.terms}</span>
                </button>
                <button 
                  onClick={() => setView('privacy')}
                  className="flex items-center justify-center px-8 py-4 bg-emerald-50 rounded-xl border-2 border-emerald-300 text-emerald-950 shadow-sm hover:bg-emerald-100 hover:border-emerald-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.privacy}</span>
                </button>
                <button 
                  onClick={() => setView('contact')}
                  className="flex items-center justify-center px-8 py-4 bg-emerald-50 rounded-xl border-2 border-emerald-300 text-emerald-950 shadow-sm hover:bg-emerald-100 hover:border-emerald-400 active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-black tracking-tight">{t.legal.contact}</span>
                </button>
              </div>

              {/* Version Info & Admin Input */}
              <div className="flex flex-col items-center gap-2 py-2">
                {showAdminInput ? (
                  <div className="w-full flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={adminKeyInput}
                        onChange={(e) => setAdminKeyInput(e.target.value)}
                        placeholder={t.adminKeyPlaceholder}
                        className="flex-grow h-10 px-4 bg-slate-100 rounded-lg text-sm font-bold text-slate-700 border-2 border-slate-200 focus:border-[#00c874] outline-none transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdminSubmit()}
                        autoFocus
                      />
                      <button 
                        onClick={handleAdminSubmit}
                        className="h-10 px-4 bg-[#00c874] text-white rounded-lg font-black text-sm shadow-[0_3px_0_rgb(0,160,90)] active:translate-y-0.5 active:shadow-none transition-all"
                      >
                        OK
                      </button>
                    </div>
                    <button 
                      onClick={() => setShowAdminInput(false)}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-500 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      const count = (window as any)._verTapCount || 0;
                      (window as any)._verTapCount = count + 1;
                      if (count + 1 >= 5) {
                        setShowAdminInput(true);
                        (window as any)._verTapCount = 0;
                      }
                    }}
                    className="px-8 py-4 text-[10px] font-black text-slate-300 tracking-[0.3em] hover:text-slate-400 transition-colors"
                  >
                    {t.version}
                  </button>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-4 flex flex-col items-center gap-2 flex-shrink-0">
                <button 
                  onClick={onClose} 
                  className="w-full py-4 bg-[#00c874] text-white rounded-lg font-black text-xl shadow-[0_6px_0_rgb(0,160,90)] hover:brightness-105 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center px-8"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </>
        ) : (
          renderLegalView(view as 'terms' | 'privacy' | 'contact')
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
