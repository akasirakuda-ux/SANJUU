
import React, { useState } from 'react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ja';
}

const InstructionModal: React.FC<InstructionModalProps> = ({ isOpen, onClose, language }) => {
  const [showSpecs, setShowSpecs] = useState(false);

  if (!isOpen) return null;

  const t = {
    title: 'あそびかた',
    step1Title: '1. ことばを探す',
    step1Desc: '下のリストにある言葉を、上の表から探します。',
    step2Title: '2. なぞってつなぐ',
    step2Desc: '指でタテ・ヨコ・ナナメになぞります。逆さまもOK！',
    step3Title: '3. ポイントをゲット',
    step3Desc: 'ポイントを貯めてランキングをあげるのも楽しいね',
    watchLive: '実演アーカイブを見る',
    liveDesc: 'YouTubeで開発者が実演中！',
    specsTitle: '推奨動作環境',
    specsToggle: '動作環境を確認する',
    specsIntro: '快適に動作するために、以下の環境でのプレイを推奨しています。',
    mobileTitle: 'スマホ・タブレット',
    mobileDesc: 'iOS 16.4+ / Android 10+ \nメモリ 3GB以上推奨',
    specsNote: '※画面が真っ白になる場合は、ブラウザやOSを最新にアップデートしてみてください。',
    close: 'わかった！',
  };

  const youtubeLink = "https://www.youtube.com/@koutaro_mizuta/live";

  return (
    <div className="absolute inset-0 z-[600] flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-[80%] h-[80%] absolute top-[10%] rounded-xl p-6 md:p-8 shadow-[0_6px_0_#cbd5e1] animate-scale-in border-4 border-white flex flex-col overflow-hidden">
        
        <div className="text-center mb-6 flex-shrink-0">
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">{t.title}</h3>
          <div className="w-16 h-1 bg-[#00c874] mx-auto mt-2 rounded-lg opacity-30"></div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-[#00c874] flex items-center justify-center text-2xl font-black flex-shrink-0">🔍</div>
              <div>
                <h4 className="font-black text-slate-800 text-lg leading-tight mb-1">{t.step1Title}</h4>
                <p className="text-sm text-slate-500 font-bold leading-relaxed">{t.step1Desc}</p>
              </div>
            </div>

            {/* Step 2 with Animation */}
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center text-2xl font-black flex-shrink-0">👆</div>
              <div className="flex-grow">
                <h4 className="font-black text-slate-800 text-lg leading-tight mb-1">{t.step2Title}</h4>
                <p className="text-sm text-slate-500 font-bold leading-relaxed mb-4">{t.step2Desc}</p>
                
                <div className="relative bg-slate-100 rounded-xl p-4 border-2 border-slate-200 overflow-hidden h-32 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-2 opacity-30 pointer-events-none">
                    {['あ','い','う','え','お','か','き','く','け'].map((c, i) => (
                      <div key={i} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg font-black text-slate-400">{c}</div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[160px] h-[40px] bg-[#00c874]/40 rounded-xl rotate-45"></div>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
                    <div className="absolute top-4 left-4 text-4xl animate-finger-swipe">☝️</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-lg bg-yellow-50 text-yellow-500 flex items-center justify-center text-2xl font-black flex-shrink-0">🐫</div>
              <div>
                <h4 className="font-black text-slate-800 text-lg leading-tight mb-1">{t.step3Title}</h4>
                <p className="text-sm text-slate-500 font-bold leading-relaxed">{t.step3Desc}</p>
              </div>
            </div>

            {/* YouTube Archive Link */}
            <a 
              href={youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-red-50 rounded-lg border-2 border-red-100 flex items-center gap-4 group hover:bg-red-100 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/>
                </svg>
              </div>
              <div>
                <h5 className="font-black text-red-700 text-sm leading-none mb-1">{t.watchLive}</h5>
                <p className="text-[9px] font-bold text-red-500 opacity-80 uppercase tracking-widest">{t.liveDesc}</p>
              </div>
            </a>
          </div>

          {/* System Specs Section */}
          <div className="border-t border-slate-100 pt-6 flex-shrink-0">
            <button 
              onClick={() => setShowSpecs(!showSpecs)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors font-black text-xs uppercase tracking-widest mb-2"
            >
              <svg className={`w-4 h-4 transition-transform ${showSpecs ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
              {t.specsToggle}
            </button>
            
            {showSpecs && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] font-bold text-slate-500 mb-4 leading-relaxed">{t.specsIntro}</p>
                <div className="mb-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.mobileTitle}</span>
                    <p className="text-[10px] font-bold text-slate-700 whitespace-pre-line">{t.mobileDesc}</p>
                  </div>
                </div>
                <p className="text-[9px] font-black text-[#00c874] leading-tight">{t.specsNote}</p>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-4 bg-[#00c874] text-white rounded-lg font-black text-xl shadow-[0_6px_0_rgb(0,160,90)] active:translate-y-1 active:shadow-none transition-all flex-shrink-0"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};

export default InstructionModal;
