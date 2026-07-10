
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, CheckCircle, Trash2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WordCategory } from '../types';
import { convertToHiragana, convertToKatakana, getCategoryDisplayTitle, getPublicUrl, HIRAGANA, isWordCategoryPaused } from '../constants';
import { getRakudaDisplayNameValidationError } from '../lib/rakudaDisplayNamePolicy';
import { buildRoomJoinShareUrl } from './AppUIHelpers';
import { RENRAKU_STATUS_ACTIVE, rkResolvedAccentPrimary } from '../lib/rakudaHubShell';
import RakudaFloatingBackdrop from './RakudaFloatingBackdrop';
import { RK19QuietRoomBackButton } from '../ui/baselineParts';
import { isTabletTouchLayout } from '../lib/tabletPhoneCanvas';

interface SelectScreenProps {
  difficulty: number;
  onSetDifficulty: (d: number) => void;
  onSelectProblem: (category: WordCategory, isKatakana: boolean) => void;
  categories: WordCategory[];
  addOns?: import('../types').AddOnModule[];
  onBack: () => void;
  /** ハブ「らくだ珈琲」（座席選択）へ */
  onBackToTitle?: () => void | Promise<void>;
  /** 店の説明を閉じる・募集を閉じる等、全面広告の「自然な区切り」 */
  onInterstitialNaturalBreak?: () => Promise<void>;
  language: 'ja';
  seed?: string;
  onClearSeed?: () => void;
  isMultiplay?: boolean;
  isSyncMode?: boolean;
  onSetSyncMode?: (sync: boolean) => void;
  nickname?: string;
  onHostStartGame?: (settings: any) => void;
  isHost?: boolean;
  roomId?: string | null;
  shareRoomId?: string | null;
  onInitRoom?: (seed: string, category?: WordCategory | null, isKatakana?: boolean, searchWord?: string) => void;
  isReady?: boolean;
  onToggleReady?: () => void;
  roomPlayers?: any[];
  roomStatus?: 'waiting' | 'start' | 'playing' | 'finished';
  roomHostId?: string | null;
  recruitMessageId?: string | null;
  setRecruitMessageId?: (id: string | null) => void;
  recruitedAt?: string | null;
  setRecruitedAt?: (at: string | null) => void;
  onCancelRecruit?: () => Promise<void>;
  userEmoji?: string;
}

const SelectScreen: React.FC<SelectScreenProps> = ({
  difficulty, onSetDifficulty, onSelectProblem,
  categories, addOns = [], onBack, onBackToTitle, onInterstitialNaturalBreak, language,
  seed = '', onClearSeed, isMultiplay = false, 
  isSyncMode = false, onSetSyncMode,
  nickname = '',
  onHostStartGame,
  isHost = false,
  roomId = null,
  shareRoomId = null,
  onInitRoom,
  isReady = false,
  onToggleReady,
  roomPlayers = [],
  roomStatus = 'waiting',
  roomHostId = null,
  recruitMessageId = null,
  setRecruitMessageId,
  recruitedAt = null,
  setRecruitedAt,
  onCancelRecruit,
  userEmoji = '🐫',
}) => {
  const [selectedDesc, setSelectedDesc] = useState<WordCategory | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<WordCategory | null>(null);
  const [pausedTarget, setPausedTarget] = useState<WordCategory | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [lastSeed, setLastSeed] = useState(seed);
  const [pendingCategory, setPendingCategory] = useState<WordCategory | null>(null);
  const [isKatakana, setIsKatakana] = useState(false);
  const DEFAULT_TARGET_WORD = 'らくだ';
  const [multiplayModeSelected, setMultiplayModeSelected] = useState(false);
  const [syncCountdown, setSyncCountdown] = useState(0);
  const syncCountdownIntervalRef = useRef<number | null>(null);
  const [tabletLayout, setTabletLayout] = useState(
    () => typeof window !== 'undefined' && isTabletTouchLayout(),
  );

  useEffect(() => {
    const syncTablet = () => setTabletLayout(isTabletTouchLayout());
    syncTablet();
    window.addEventListener('resize', syncTablet);
    window.visualViewport?.addEventListener('resize', syncTablet);
    return () => {
      window.removeEventListener('resize', syncTablet);
      window.visualViewport?.removeEventListener('resize', syncTablet);
    };
  }, []);

  useEffect(() => {
    if (isMultiplay && !isSyncMode && onSetSyncMode) {
      onSetSyncMode(true);
    }
  }, [isMultiplay, isSyncMode, onSetSyncMode]);

  useEffect(() => {
    if (syncCountdownIntervalRef.current !== null) {
      clearInterval(syncCountdownIntervalRef.current);
      syncCountdownIntervalRef.current = null;
    }
    if (roomStatus === 'start') {
      setSyncCountdown(5);
      const interval = window.setInterval(() => {
        setSyncCountdown(prev => {
          if (prev <= 0.1) {
            if (syncCountdownIntervalRef.current !== null) {
              clearInterval(syncCountdownIntervalRef.current);
              syncCountdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
      syncCountdownIntervalRef.current = interval;
      return () => {
        if (syncCountdownIntervalRef.current !== null) {
          clearInterval(syncCountdownIntervalRef.current);
          syncCountdownIntervalRef.current = null;
        }
      };
    } else {
      setSyncCountdown(0);
    }
  }, [roomStatus]);

  useEffect(() => {
    // Recruitment state is now managed by parent
  }, [roomId]);

  const isProCode = seed.length === 4 && [...seed].every(c => HIRAGANA.includes(c));

  const getShareUrl = (cat: string, diff: number, s: string, mode: 'normal' | 'search' = 'normal', word: string = '', isK: boolean = false) => {
    // Use the public URL instead of the dev URL for sharing
    const baseUrl = `${getPublicUrl()}${window.location.pathname}${window.location.pathname.endsWith('/') ? '' : '/'}`;
    const params = new URLSearchParams();
    params.set('c', cat);
    params.set('d', diff.toString());
    params.set('s', s);
    params.set('sync', isSyncMode ? '1' : '0');
    if (mode === 'search') {
      params.set('m', 'search');
      params.set('w', word);
    }
    if (isK) params.set('k', '1');
    return `${baseUrl}?${params.toString()}`;
  };

  const numericSeed = isProCode ? (HIRAGANA.indexOf(seed[2]) * 46 + HIRAGANA.indexOf(seed[3])).toString() : seed;
  
  // Simplified and robust URL generation using getPublicUrl to handle dev/pre/custom domains
  const shareUrl = buildRoomJoinShareUrl(shareRoomId, roomId);

  const handleRecruit = async () => {
    if (!nickname) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: 'なまえを入力してね！' }));
      return;
    }
    if (!roomId) return;

    const displayNameError = getRakudaDisplayNameValidationError(nickname, '', auth.currentUser);
    if (displayNameError) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: displayNameError }));
      return;
    }

    const catTitle = pendingCategory ? getCategoryDisplayTitle(pendingCategory.title || pendingCategory.category, language) : '（未選択）';
    const diffText = `${difficulty}×${difficulty}`;
    
    const message = `【募集】ことば探しで一緒に遊びませんか？\nカテゴリ：${catTitle}\nサイズ：${diffText}\nゲーム中も参加できます`;

    try {
      const docRef = await addDoc(collection(db, 'renraku_public'), {
        message,
        fromUser: nickname,
        fromUserUid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        status: RENRAKU_STATUS_ACTIVE,
        type: 'recruit',
        roomInfo: {
          category: catTitle,
          difficulty: diffText,
          targetWord: '',
          url: shareUrl
        }
      });
      setRecruitMessageId?.(docRef.id);
      setRecruitedAt?.(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
      
      // Also store in room doc for auto-deletion by host
      if (roomId) {
        await setDoc(doc(db, 'rooms', roomId), { recruitMessageId: docRef.id }, { merge: true });
      }
      
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '掲示板に募集を出しました！' }));
    } catch (error) {
      console.error('Recruit error:', error);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: '募集に失敗しました。' }));
    }
  };

  const handleCancelRecruit = async () => {
    const hadActiveRecruit = !!recruitedAt;
    if (onCancelRecruit) {
      await onCancelRecruit();
    } else if (recruitMessageId) {
      // Fallback for non-multiplay or if prop missing
      try {
        await deleteDoc(doc(db, 'renraku_public', recruitMessageId));
        setRecruitMessageId?.(null);
        setRecruitedAt?.(null);
      } catch (e) {}
    }
    if (hadActiveRecruit && onInterstitialNaturalBreak && !isMultiplay) {
      await onInterstitialNaturalBreak();
    }
  };

  const closeShopDetailAndMaybeAd = async () => {
    setSelectedDesc(null);
    if (onInterstitialNaturalBreak) await onInterstitialNaturalBreak();
  };

  // Show modal when a new seed is generated in multiplay mode, or if we are in a room
  useEffect(() => {
    if (isMultiplay && roomId) {
      setShowCodeModal(true);
    }
  }, [isMultiplay, roomId]);

  useEffect(() => {
    if (isMultiplay && seed && seed !== lastSeed) {
      setLastSeed(seed);
    }
  }, [isMultiplay, seed, lastSeed]);

  const isYojijukugoCategory = (cat: WordCategory): boolean => {
    const title = String(cat.title || '');
    const id = String(cat.category || '');
    // 「四字熟語」系カテゴリをすべて問題一覧から除外する
    if (title.includes('四字熟語')) return true;
    if (id === 'yojijukugo' || id.includes('yojijukugo')) return true;
    if (id === 'yojijukugo_group') return true;
    // 現在のマスタでは idioms_* が四字熟語カテゴリ
    if (id.startsWith('idioms_')) return true;
    return false;
  };

  const stripYojijukugo = (cat: WordCategory): WordCategory | null => {
    if (isYojijukugoCategory(cat)) return null;
    if (!cat.subCategories?.length) return cat;
    const sub = cat.subCategories
      .map(stripYojijukugo)
      .filter((x): x is WordCategory => x !== null);
    return { ...cat, subCategories: sub };
  };

  // Combine built-in categories with add-on categories
  const allCategories = categories
    .map(stripYojijukugo)
    .filter((x): x is WordCategory => x !== null);
  
  // Check if a category is already unlocked via add-ons
  const isUnlocked = (cat: WordCategory) => {
    if (!cat.isPremium) return true;
    return addOns.some(addOn => addOn.categories.some(c => c.category === cat.category));
  };

  useEffect(() => {
    const updateWidth = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth;
      if (isTabletTouchLayout()) {
        setBoardWidth(Math.min(Math.max(0, vw - 40), 720));
        return;
      }
      const isMobile = vw < 768;
      const availableWidth = isMobile ? vw - 32 : vw - 64;
      setBoardWidth(Math.min(availableWidth, 800));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    window.visualViewport?.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      window.visualViewport?.removeEventListener('resize', updateWidth);
    };
  }, []);

  const t = {
    header: '問題一覧',
    difficulty: 'サイズ',
    answerCount: '用意した答え',
    allAnswers: '全てのこたえ',
    understand: 'わかった！',
    noDesc: '説明はありません。',
    diffLabel3: 'やさしい',
    diffLabel6: 'ふつう',
    diffLabel9: 'ムズイ',
    diffLabel11: '最強',
    premium: '追加オプション',
    paused: '休止中',
    pausedBody: 'こたえを見直し中です。しばらくお待ちください。',
    unlock: 'ロックを解除する',
    buy: '購入ページへ',
    inputKey: '有効化キーを入力',
  };

  const getDifficultyInfo = (val: number) => {
    let label = t.diffLabel3;
    let color = 'var(--rk-amber-500)';
    if (val > 5 && val <= 8) {
      label = t.diffLabel6;
      color = rkResolvedAccentPrimary();
    } else if (val >= 9 && val < 11) {
      label = t.diffLabel9;
      color = 'var(--rk-red-500)';
    } else if (val >= 11) {
      label = t.diffLabel11;
      color = 'var(--rk-violet-600)';
    }
    return { label, color };
  };

  return (
    <div 
      className="relative h-full w-full animate-in fade-in duration-500 overflow-hidden bg-gradient-to-b from-rk-rose-200/95 via-rk-pink-100 to-rk-rose-300/85"
      style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}
    >
      <RakudaFloatingBackdrop variant="kotoba" />
      {/* Mode selection for multiplay removed - defaulting to Solve Together */}

      <style>{`
        input[type=range].difficulty-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 36px;
          height: 36px;
          background: var(--rk-amber-600);
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          cursor: pointer;
          border: none;
        }
        input[type=range].difficulty-slider::-moz-range-thumb {
          width: 36px;
          height: 36px;
          background: var(--rk-amber-600);
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          cursor: pointer;
          border: none;
        }
      `}</style>

      {/* 1. Header Area (0-10% height) */}
      <div className="absolute top-0 left-0 w-full h-[10%] z-20">
        {/* RK-19: トップ（座席選択）へ */}
        <div className="absolute top-0 left-0 h-full flex items-center justify-center pl-2 md:pl-3">
          <RK19QuietRoomBackButton
            onClick={() => {
              if (typeof onBackToTitle === 'function') {
                void Promise.resolve(onBackToTitle());
              } else {
                onBack();
              }
            }}
          />
        </div>

        {/* Header Text: Center of (0,0)-(100,10) */}
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3 md:gap-4">
              <h2 className="text-xl md:text-2xl font-black text-rk-slate-800 tracking-tight leading-none whitespace-nowrap">
                {t.header}
              </h2>
              <div className="pointer-events-auto flex bg-rk-slate-100 p-1 rounded-xl border border-rk-slate-200">
                <button 
                  onClick={() => setIsKatakana(false)}
                  className={`px-3 py-1 text-lg md:text-xl font-black rounded-lg transition-all ${!isKatakana ? 'bg-rk-white text-rk-primary shadow-sm' : 'text-rk-slate-400'}`}
                >
                  あ
                </button>
                <button 
                  onClick={() => setIsKatakana(true)}
                  className={`px-3 py-1 text-lg md:text-xl font-black rounded-lg transition-all ${isKatakana ? 'bg-rk-white text-rk-primary shadow-sm' : 'text-rk-slate-400'}`}
                >
                  ア
                </button>
              </div>
            </div>
            {isMultiplay && (
              <div className="flex flex-col items-start">
                <span className="text-[10px] md:text-[11px] font-black text-rk-amber-500 bg-rk-amber-50 px-2 py-0.5 rounded-lg mt-1 animate-pulse">
                  🤝 QRコード作成モード
                </span>
                {seed && (
                  <button 
                    onClick={onClearSeed}
                    className="text-[10px] font-bold text-rk-slate-400 underline mt-1 hover:text-rk-slate-600"
                  >
                    合言葉を解除して通常モードへ
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 2. Difficulty Area: Centered between 10% and 20% lines (at 15%), 8% height */}
      <div 
        className="absolute top-[15%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
        style={{ width: boardWidth || 'auto', height: '10vh', minHeight: '72px', maxWidth: '100%' }}
      >
        <div className="bg-[var(--rk-hub-rose-panel)] backdrop-blur-md px-4 py-2 md:px-8 h-full rounded-2xl border-2 border-[var(--rk-hub-bark)] shadow-sm flex items-center gap-4 md:gap-8 w-full">
          <div className="flex flex-col flex-shrink-0 min-w-0">
            <span className="text-[18px] md:text-[20px] font-black text-[var(--rk-hub-bark-deep)] uppercase tracking-widest leading-tight mb-1">
              {t.difficulty}
              {seed && (
                <span className="ml-2 normal-case text-[10px] md:text-xs font-black text-[var(--rk-hub-bark-deep)] opacity-80 tracking-normal">
                  (合言葉を解除して変更)
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-[20px] font-black leading-none whitespace-nowrap"
                style={{ color: getDifficultyInfo(difficulty).color }}
              >
                {difficulty}×{difficulty}
              </span>
            </div>
          </div>
          
          <div className="flex-grow flex items-center gap-2">
            <input 
              type="range" 
              min="3" 
              max="11" 
              step="1" 
              value={difficulty} 
              onChange={(e) => {
                const d = parseInt(e.target.value);
                onSetDifficulty(d);
                if (seed) onClearSeed?.();
              }}
              className="flex-grow h-2 md:h-3 bg-rk-slate-200 rounded-lg appearance-none cursor-pointer difficulty-slider"
              style={{
                WebkitAppearance: 'none',
                background: `linear-gradient(to right, ${getDifficultyInfo(difficulty).color} 0%, ${getDifficultyInfo(difficulty).color} calc(${(difficulty - 3) / (11 - 3) * 100}% + ${(0.5 - (difficulty - 3) / (11 - 3)) * 36}px), var(--rk-slate-200) calc(${(difficulty - 3) / (11 - 3) * 100}% + ${(0.5 - (difficulty - 3) / (11 - 3)) * 36}px), var(--rk-slate-200) 100%)`
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. List Area: サイズ枠との隙間は top / pt-* で調整 */}
      <div className="absolute top-[23.5%] left-0 w-full bottom-[calc(var(--rk-bottom-banner,0px)+env(safe-area-inset-bottom))] overflow-y-auto custom-scrollbar pl-4 pr-5 pb-6 pt-4 md:pt-7">
        <div className={`flex flex-col items-center w-full gap-2 md:gap-3 ${(seed && !isProCode) || (isProCode && !isMultiplay) ? 'opacity-50 pointer-events-none' : ''}`}>

          {allCategories.map((category, index) => {
            const isExpanded = expandedCategoryId === category.category;
            const hasSub = category.subCategories && category.subCategories.length > 0;
            const locked = !isUnlocked(category);
            const paused = isWordCategoryPaused(category.category);
            const categoryTitleRaw = getCategoryDisplayTitle(category.title || category.category, language);
            const categoryTitle =
              !category.isKanji && isKatakana ? convertToKatakana(categoryTitleRaw) : categoryTitleRaw;
            const categoryTitleMultiline = categoryTitle.includes('\n');

            return (
              <div 
                key={category.category + index} 
                className="flex-shrink-0 w-full"
                style={{ width: boardWidth || '100%' }}
              >
                <div className="flex flex-col w-full gap-2 md:gap-3">
                  <div className={`relative ${tabletLayout ? 'min-h-[92px]' : 'h-[8vh] md:h-[10vh]'}`}>
                    <button 
                      onClick={() => {
                        if (paused) {
                          setPausedTarget(category);
                          return;
                        }
                        if (locked) {
                          setUnlockTarget(category);
                          return;
                        }
                        if (hasSub) {
                          setExpandedCategoryId(isExpanded ? null : category.category);
                        } else {
                          if (isMultiplay && !seed) {
                            setPendingCategory(category);
                            // Generate a seed and show modal instead of starting immediately
                            const newSeed = Math.floor(Math.random() * 1000000).toString();
                            onInitRoom?.(newSeed, category, isKatakana);
                            return;
                          }
                          onSelectProblem(category, isKatakana);
                        }
                      }} 
                      className={`w-full ${tabletLayout ? 'min-h-[92px] py-3' : 'h-full'} flex items-center gap-4 md:gap-8 px-4 md:px-8 border-2 rounded-xl shadow-sm hover:shadow-md transition-all text-left group ${
                        !hasSub ? 'pr-14 md:pr-16' : ''
                      } ${
                        paused
                          ? 'bg-rk-slate-50 border-rk-slate-300 opacity-85'
                          : locked
                          ? 'bg-rk-amber-50 border-rk-amber-200 opacity-80'
                          : hasSub
                            ? 'bg-rk-amber-100 border-rk-amber-400 hover:bg-rk-amber-200 hover:border-rk-amber-500'
                            : 'bg-rk-white border-rk-slate-200 hover:border-rk-primary/40'
                      }`}
                    >
                    <span className={`${tabletLayout ? 'text-[22px] min-w-[2.25rem]' : 'text-[14px] md:text-[18px] min-w-[1.25rem] md:min-w-[2rem]'} font-black text-rk-black text-center group-hover:text-rk-primary/40 transition-colors`}>
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0 h-full">
                        <div className={`${tabletLayout ? 'w-16 h-16' : 'w-10 h-10 md:w-14 md:h-14'} flex items-center justify-center flex-shrink-0 rounded-xl group-hover:scale-110 transition-transform border ${
                          paused
                            ? 'bg-rk-slate-100 border-rk-slate-300'
                            : locked
                            ? 'bg-rk-amber-100 border-rk-amber-200/60'
                            : hasSub
                              ? 'bg-rk-amber-200/80 border-rk-amber-400'
                              : 'bg-rk-white border-rk-slate-200/80'
                        }`}>
                        <span className={`${tabletLayout ? 'text-5xl' : 'text-2xl md:text-4xl'} leading-none`}>{locked ? "🔒" : (category.emoji || "❓")}</span>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 justify-center py-0.5">
                          <div className="flex items-center gap-2 md:gap-3">
                            <h3
                              className={`font-black text-rk-black min-w-0 line-clamp-3 break-words whitespace-pre-line ${
                                categoryTitleMultiline
                                  ? tabletLayout
                                    ? 'text-[20px] leading-[1.28]'
                                    : 'text-[11px] md:text-[14px] leading-[1.28]'
                                  : tabletLayout
                                    ? 'text-[24px] leading-tight'
                                    : 'text-[14px] md:text-[18px] leading-tight'
                              }`}
                            >
                              {categoryTitle}
                            </h3>
                            {category.isPremium && !locked && !paused && (
                              <span className="bg-rk-amber-100 text-rk-amber-600 text-[9px] md:text-[11px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-tighter shadow-sm">PRO</span>
                            )}
                            {paused ? (
                              <span className="bg-rk-slate-200 text-rk-slate-700 text-[9px] md:text-[11px] px-1.5 py-0.5 rounded-lg font-black tracking-tighter shadow-sm shrink-0">
                                {t.paused}
                              </span>
                            ) : null}
                            {category.isKanji && (
                              <span className="bg-rk-blue-600 text-rk-white text-[10px] md:text-[13px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter shadow-sm">漢字</span>
                            )}
                          </div>
                          <p className={`${tabletLayout ? 'text-[14px] tracking-wide' : 'text-[9px] md:text-[11px] tracking-widest'} font-black text-rk-slate-500 uppercase`}>
                            {paused ? t.pausedBody : locked ? t.premium : hasSub ? `${category.subCategories?.length} GROUPS` : `${category.words.length} WORDS`}
                          </p>
                      </div>
                    </div>
                    {hasSub && (
                      <div className={`mr-12 md:mr-16 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg className="w-4 h-4 md:w-6 md:h-6 text-rk-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    )}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedDesc(category); }}
                    className={`absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 md:right-7 flex items-center justify-center rounded-lg transition-all border-2 active:scale-90 z-10 ${
                      paused
                        ? 'bg-rk-slate-50 text-rk-slate-400 border-rk-slate-200'
                        : locked
                        ? 'bg-rk-slate-50 text-rk-slate-400 border-rk-slate-100'
                        : hasSub
                          ? 'bg-rk-amber-50 text-rk-amber-700/80 border-rk-amber-300 hover:bg-rk-amber-100 hover:text-rk-amber-900'
                          : 'bg-rk-slate-50 text-rk-slate-400 hover:text-rk-primary hover:bg-rk-primary/10 border-rk-slate-100'
                    }`}
                  >
                    <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                </div>

                <AnimatePresence>
                  {isExpanded && hasSub && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col w-full gap-2 md:gap-3 pl-6 md:pl-12"
                      >
                      {category.subCategories?.map((sub, subIdx) => {
                        const subTitleRaw = sub.title || sub.category;
                        const subTitle =
                          !sub.isKanji && isKatakana ? convertToKatakana(subTitleRaw) : subTitleRaw;
                        const subTitleMultiline = subTitle.includes('\n');

                        return (
                        <div key={sub.category + subIdx} className={`flex gap-2 md:gap-4 ${tabletLayout ? 'min-h-[84px]' : 'h-[8vh] md:h-[10vh]'}`}>
                          <button
                            onClick={() => {
                              if (isMultiplay && !seed) {
                                setPendingCategory(sub);
                              }
                              onSelectProblem(sub, isKatakana);
                            }}
                            className={`flex-grow flex items-center gap-3 md:gap-6 px-4 md:px-8 border-2 rounded-xl transition-all text-left shadow-sm bg-rk-amber-100 border-rk-amber-400 hover:bg-rk-amber-200 hover:border-rk-amber-500 ${tabletLayout ? 'min-h-[84px] py-2.5' : ''}`}
                          >
                            <span className={tabletLayout ? 'text-4xl' : 'text-xl md:text-3xl'}>{sub.emoji}</span>
                            <div className="flex flex-col min-w-0 flex-1 justify-center py-0.5">
                              <div className="flex items-center gap-2 md:gap-3">
                                <span
                                  className={`font-black text-rk-black min-w-0 whitespace-pre-line line-clamp-3 break-words ${
                                    subTitleMultiline
                                      ? tabletLayout
                                        ? 'text-[18px] leading-[1.28]'
                                        : 'text-[10px] md:text-[12px] leading-[1.28]'
                                      : tabletLayout
                                        ? 'text-[22px] leading-tight'
                                        : 'text-[12px] md:text-[15px] leading-tight'
                                  }`}
                                >
                                  {subTitle}
                                </span>
                                {sub.isKanji && (
                                  <span className="px-1.5 py-0.5 rounded bg-rk-blue-600 text-rk-white text-[10px] md:text-[13px] font-black shadow-sm leading-none">
                                    漢字
                                  </span>
                                )}
                              </div>
                              <span className={`${tabletLayout ? 'text-[14px]' : 'text-[9px] md:text-[11px]'} text-rk-slate-500 font-black uppercase`}>{sub.words.length} WORDS</span>
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDesc(sub);
                            }}
                            className="w-10 md:w-12 flex-shrink-0 flex items-center justify-center border-2 rounded-xl transition-all shadow-sm active:scale-90 bg-rk-amber-50 border-rk-amber-300 text-rk-amber-700/80 hover:bg-rk-amber-100 hover:text-rk-amber-900"
                          >
                            <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Description Modal */}
      {selectedDesc && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center p-6 bg-rk-slate-900/50 backdrop-blur-md animate-in fade-in" onClick={() => void closeShopDetailAndMaybeAd()}>
          <div className="bg-rk-white w-[80%] rounded-2xl p-6 md:p-8 shadow-[0_6px_0_var(--rk-slate-300)] animate-scale-in border-[4px] md:border-[6px] border-rk-white flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center flex-shrink-0 mb-4 md:mb-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-rk-slate-50 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                <span className="text-5xl md:text-6xl drop-shadow-sm leading-none">{selectedDesc.emoji}</span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-rk-slate-800 mb-2 whitespace-pre-line">
                {(() => {
                  const title = getCategoryDisplayTitle(selectedDesc.title || selectedDesc.category, language);
                  return (!selectedDesc.isKanji && isKatakana) ? convertToKatakana(title) : title;
                })()}
              </h3>
              <p className="text-rk-slate-600 font-bold text-sm md:text-base leading-relaxed px-2 md:px-4">
                {selectedDesc.description || t.noDesc}
              </p>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar bg-rk-slate-50 rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 mb-6 md:mb-8 border border-rk-slate-100 shadow-inner">
              <div className="space-y-4 md:space-y-6 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-[9px] md:text-[11px] font-black text-rk-slate-400 uppercase tracking-[0.2em]">{t.answerCount}</h4>
                  <p className="text-sm md:text-base font-black text-rk-primary">{selectedDesc.words.length} {language === 'ja' ? '個' : 'Words'}</p>
                </div>

                  <div className="border-t border-rk-slate-200/50 pt-4">
                  <h4 className="text-[9px] md:text-[11px] font-black text-rk-slate-400 uppercase tracking-[0.2em] mb-3">{t.allAnswers}</h4>
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-1">
                    {selectedDesc.words.map((word, i) => {
                      let displayWord = typeof word === 'string' ? convertToHiragana(word) : word.word;
                      if (!selectedDesc.isKanji && isKatakana) {
                        displayWord = convertToKatakana(displayWord);
                      }
                      return (
                        <span key={i} className="text-[10px] md:text-xs bg-rk-white px-2.5 md:px-3 py-1 rounded-lg md:rounded-xl border border-rk-slate-200 text-rk-slate-600 font-bold shadow-sm">
                          {displayWord}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {selectedDesc.source && (
                  <div className="border-t border-rk-slate-200/50 pt-4">
                    <h4 className="text-[9px] md:text-[11px] font-black text-rk-slate-400 uppercase tracking-[0.2em] mb-2">出典</h4>
                    <p className="text-[10px] md:text-xs text-rk-slate-500 font-bold leading-relaxed">
                      {selectedDesc.source.replace('【資料】: ', '')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="button"
              onClick={() => void closeShopDetailAndMaybeAd()}
              className="w-full py-4 md:py-5 bg-rk-primary text-rk-white rounded-[1.25rem] md:rounded-[1.5rem] font-black text-lg md:text-xl shadow-[0_6px_0_var(--rk-accent-primary-shadow)] active:translate-y-1 active:shadow-none transition-all flex-shrink-0"
            >
              {t.understand}
            </button>
          </div>
        </div>
      )}

      {/* Paused Dialog */}
      {pausedTarget && (
        <div className="absolute inset-0 z-[700] flex items-center justify-center p-6 bg-[color-mix(in_srgb,var(--rk-unlock-scrim)_90%,transparent)] backdrop-blur-sm animate-in fade-in" onClick={() => setPausedTarget(null)}>
          <div className="bg-rk-white w-[90%] max-w-md rounded-3xl p-8 shadow-2xl animate-scale-in border-[6px] border-rk-slate-200 flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <div className="w-24 h-24 bg-rk-slate-100 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border-2 border-rk-slate-200">
              <span className="text-5xl">{pausedTarget.emoji || '⏸️'}</span>
            </div>
            <span className="mb-3 bg-rk-slate-200 text-rk-slate-700 text-sm px-3 py-1 rounded-lg font-black">{t.paused}</span>
            <h3 className="text-2xl font-black text-rk-slate-800 mb-2 whitespace-pre-line">
              {getCategoryDisplayTitle(pausedTarget.title || pausedTarget.category, language)}
            </h3>
            <p className="text-rk-slate-600 font-bold mb-8 whitespace-pre-line leading-relaxed">
              {t.pausedBody}
            </p>
            <button
              type="button"
              onClick={() => setPausedTarget(null)}
              className="w-full py-4 bg-rk-primary text-rk-white rounded-2xl font-black text-lg shadow-[0_6px_0_var(--rk-accent-primary-shadow)] active:translate-y-1 active:shadow-none transition-all"
            >
              {t.understand}
            </button>
          </div>
        </div>
      )}

      {/* Unlock Dialog */}
      {unlockTarget && (
        <div className="absolute inset-0 z-[700] flex items-center justify-center p-6 bg-[color-mix(in_srgb,var(--rk-unlock-scrim)_90%,transparent)] backdrop-blur-sm animate-in fade-in" onClick={() => setUnlockTarget(null)}>
          <div className="bg-rk-white w-[90%] max-w-md rounded-3xl p-8 shadow-2xl animate-scale-in border-[6px] border-rk-amber-100 flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <div className="w-24 h-24 bg-rk-amber-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border-2 border-rk-amber-100">
              <span className="text-5xl">🔒</span>
            </div>
            
            <h3 className="text-2xl font-black text-rk-slate-800 mb-2">{t.unlock}</h3>
            <p className="text-rk-slate-500 font-bold mb-8 whitespace-pre-line">
              {getCategoryDisplayTitle(unlockTarget.title || unlockTarget.category, language)} を解放して遊びますか？
            </p>

            <div className="w-full space-y-4">
              <a 
                href="https://stripe.com" // 仮の決済URL
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-5 bg-rk-amber-500 text-rk-white rounded-2xl font-black text-xl shadow-[0_6px_0_var(--rk-shadow-unlock-buy)] active:translate-y-1 active:shadow-none transition-all"
              >
                {t.buy}
              </a>
              
              <button 
                onClick={() => {
                  setUnlockTarget(null);
                  // 有効化キー入力のロジックは App.tsx 側でハンドルする想定
                  const key = window.prompt(t.inputKey);
                  if (key) {
                    // キー検証イベントを発火させるなどの処理
                    window.dispatchEvent(new CustomEvent('ACTIVATE_MODULE', { detail: { key, moduleId: unlockTarget.category } }));
                  }
                }}
                className="w-full py-4 bg-rk-slate-100 text-rk-slate-600 rounded-2xl font-black text-sm hover:bg-rk-slate-200 transition-all"
              >
                {t.inputKey}
              </button>

              <button 
                onClick={() => setUnlockTarget(null)}
                className="w-full py-3 text-rk-slate-400 font-bold text-sm hover:text-rk-slate-600 transition-all"
              >
                もどる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiplay Code Modal (QR Code & Waiting Room) */}
      {(showCodeModal || (isMultiplay && roomId)) && (
        <div className="absolute inset-0 z-[800] flex items-center justify-center p-4 bg-[color-mix(in_srgb,var(--rk-unlock-scrim)_90%,transparent)] backdrop-blur-sm animate-in fade-in">
          <div className="bg-rk-white w-[92%] max-w-md rounded-xl py-10 px-6 shadow-2xl animate-scale-in border-[6px] border-rk-success-100 flex flex-col items-center text-center relative">
            <div className="absolute -top-6 -right-2 w-20 h-20 bg-rk-success-50 rounded-lg flex items-center justify-center shadow-lg border-4 border-rk-white z-10">
              <span className="text-3xl animate-bounce">🤝</span>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-black text-rk-slate-800 mb-2">
                みんなで解く
              </h3>
              
            {isMultiplay && (
              <div className="w-full bg-rk-success-50 rounded-2xl p-6 border-4 border-rk-success-100 mb-8 shadow-inner">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-rk-success-700 font-black text-base">参加者の一覧</span>
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full">
                    {roomPlayers.map(p => {
                      const isMe = p.uid === auth.currentUser?.uid;
                      const isRoomHost = p.uid === roomHostId;
                      
                      return (
                        <div 
                          key={p.uid} 
                          className={`px-4 py-3 rounded-2xl text-xs font-black border-2 transition-all flex items-center gap-3 shadow-sm ${
                            p.isReady 
                              ? 'bg-rk-amber-50 border-rk-amber-300 text-rk-amber-700' 
                              : 'bg-rk-white border-rk-slate-100 text-rk-slate-400'
                          }`}
                        >
                          <span className="text-2xl">{p.emoji || '👤'}</span>
                          <div className="flex flex-col items-start overflow-hidden flex-1">
                            <div className="flex items-center gap-1 w-full">
                              <span className="truncate text-left font-black">{p.name}</span>
                              {isMe && (
                                <span className="bg-rk-slate-200 text-rk-slate-600 px-1.5 py-0.5 rounded text-[8px] flex-shrink-0">あなた</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isRoomHost ? (
                                <span className="bg-rk-amber-400 text-rk-white px-1.5 py-0.5 rounded text-[8px] font-black">ホスト</span>
                              ) : (
                                <span className="bg-rk-success-100 text-rk-success-600 px-1.5 py-0.5 rounded text-[8px]">ゲスト</span>
                              )}
                              <span className="text-[9px] opacity-70">
                                {p.isReady ? 'じゅんびOK' : 'じゅんび中'}
                              </span>
                            </div>
                          </div>
                          {p.isReady && <CheckCircle size={18} className="text-rk-amber-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

              <div className="flex flex-col items-center gap-1 text-rk-success-700 font-bold">
                <div className="flex items-center gap-2">
                  <span className="bg-rk-success-100 px-3 py-1 rounded-lg text-xs">カテゴリー</span>
                  <span className="text-lg whitespace-pre-line text-left">{pendingCategory ? getCategoryDisplayTitle(pendingCategory.title || pendingCategory.category, language) : '探しもの'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-rk-success-100 px-3 py-1 rounded-lg text-xs">サイズ</span>
                  <span className="text-lg">{difficulty}×{difficulty}</span>
                </div>
              </div>
            </div>

            {isMultiplay && !isHost && (
              <div className="w-full space-y-4 mb-4">
                <div className="w-full bg-rk-sky-50 rounded-xl p-6 border-4 border-rk-sky-100">
                  {roomStatus === 'start' ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xs font-black text-rk-sky-600 uppercase tracking-widest">Game Starts In</span>
                      <div className="text-6xl font-black text-rk-slate-800 animate-bounce">
                        {Math.ceil(syncCountdown)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-rk-sky-600 font-black text-lg">ホストの開始を待っています...</p>
                      <p className="text-rk-sky-400 text-xs font-bold mt-1">準備ができたら「参加する」を押してね！</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="w-full space-y-4">
              {isHost ? (
                <>
                  <button 
                    onClick={recruitedAt ? handleCancelRecruit : handleRecruit}
                    className={`w-full h-14 rounded-xl font-black text-base shadow-lg active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 ${
                      recruitedAt 
                        ? 'bg-rk-slate-100 text-rk-slate-500 border-2 border-rk-slate-200 shadow-[0_4px_0_var(--rk-shadow-soft-plate)]' 
                        : 'bg-[var(--rk-hub-cocoa)] text-rk-white shadow-[0_4px_0_var(--rk-hub-cocoa-shadow)]'
                    }`}
                  >
                    {recruitedAt ? (
                      <>
                        <Trash2 size={20} className="text-rk-slate-400" />
                        募集をキャンセルする
                      </>
                    ) : (
                      <>
                        <MessageSquare size={20} className="text-rk-white/80" />
                        掲示板で募集する
                      </>
                    )}
                  </button>

                  {roomPlayers.length >= 1 && (
                    <div className="w-full space-y-2 pt-2 border-t border-rk-slate-100">
                      {roomPlayers.length > 1 && roomPlayers.every(p => p.isReady) && (
                        <div className="text-rk-success-600 font-black text-sm text-center animate-bounce mb-1">
                          ✨ 全員準備完了！ ✨
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          if (roomStatus === 'start') return;
                          const settings = pendingCategory ? {
                            category: pendingCategory.category,
                            isKatakana: isKatakana,
                            difficulty: difficulty,
                            gameMode: 'normal',
                            isSyncMode: isSyncMode,
                            seed: parseInt(numericSeed) || Math.floor(Math.random() * 1000000)
                          } : {
                            gameMode: 'search',
                            targetWord: DEFAULT_TARGET_WORD,
                            difficulty: difficulty,
                            isKatakana: isKatakana,
                            isSyncMode: isSyncMode,
                            seed: parseInt(numericSeed) || Math.floor(Math.random() * 1000000)
                          };
                          onHostStartGame?.(settings);
                        }}
                        className={`w-full h-16 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-3 ${
                          roomPlayers.length > 1 && roomPlayers.every(p => p.isReady)
                            ? 'bg-rk-primary text-rk-white shadow-[0_6px_0_var(--rk-accent-primary-shadow)] active:translate-y-1 active:shadow-none'
                            : 'bg-rk-success-400 text-rk-white shadow-[0_6px_0_var(--rk-success-500)] active:translate-y-1 active:shadow-none'
                        }`}
                      >
                        {roomStatus === 'start' ? '開始しています...' : '全員でスタート！'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full space-y-2">
                  <button
                    onClick={onToggleReady}
                    disabled={isReady || roomStatus === 'start'}
                    className={`w-full h-16 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-3 ${
                      isReady 
                        ? 'bg-rk-amber-100 text-rk-amber-600 cursor-default border-2 border-rk-amber-200' 
                        : 'bg-rk-primary text-rk-white shadow-[0_4px_0_var(--rk-accent-primary-shadow)] active:translate-y-1 active:shadow-none'
                    }`}
                  >
                    {isReady ? (
                      <>
                        <CheckCircle size={24} />
                        じゅんびOK！
                      </>
                    ) : (
                      <>
                        <MessageSquare size={24} />
                        じゅんびできた！
                      </>
                    )}
                  </button>
                  {!isReady && (
                    <p className="text-[10px] text-rk-slate-400 font-bold text-center">
                      ボタンを押してホストに知らせてね
                    </p>
                  )}
                </div>
              )}

              {isHost && roomPlayers.length === 0 && (
                <div className="text-xs text-rk-slate-400 font-bold text-center py-4 bg-rk-slate-50 rounded-xl border-2 border-dashed border-rk-slate-200">
                  参加者を待っています...
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                setShowCodeModal(false);
                onBack(); // Go back to title if they cancel waiting
              }}
              className="mt-6 text-rk-slate-400 font-bold text-sm hover:text-rk-slate-600 transition-all"
            >
              キャンセルして戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectScreen;
