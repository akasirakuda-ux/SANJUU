import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Info } from 'lucide-react';
import { btnGhost, btnPrimary, cardClass } from '../ui/policy';
import { RK19QuietRoomBackButton } from '../ui/baselineParts';
import { pageTopHeadingClass } from '../ui/typography';
import { trackRakudaHubMenu } from '../lib/rakudaGaEvents';
import { openRakudaNote } from '../lib/rakudaNoteUrl';

interface QuietRoomProps {
  onBack: () => void;
  /** トップの統一入り口で「はじめる」済みのとき、開始オーバーレイを省略 */
  skipIntro?: boolean;
}

interface FloatingObject {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  swayDuration: number;
  rotationDuration: number;
}

const ANIMALS = ['🐫', '🐑', '🐘', '🦒', '🧸', '🐣', '🐼', '🐻', '🐰', '🐷', '🐯', '🦁', '🐶', '🐱'];
const FISH = ['🐠', '🐡'];
const NATURE = ['🌙', '⭐', '🎈', '🍀', '☁️', '🍃', '🌸'];
const ALL_OBJECTS = [...ANIMALS, ...FISH, ...NATURE];

const AMACHA_MUSIC_URL = 'https://amachamusic.chagasi.com/image_iyashi2.html';

/** 甘茶の音楽工房 — 時間帯で曲を切り替え */
const QUIET_ROOM_BGM = {
  day: { src: '/quiet-room-bgm.mp3', title: 'あの日描いた夢' },
  night: { src: '/quiet-room-bgm-night.mp3', title: '静寂の星空' },
} as const;

type QuietTimeMode = 'day' | 'evening' | 'night';

const bgmTrackForTimeMode = (mode: QuietTimeMode) =>
  mode === 'day' ? QUIET_ROOM_BGM.day : QUIET_ROOM_BGM.night;

const BGM_FADE_SEC = 2.2;

function waitForBgmReady(el: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve();
      return;
    }
    const done = () => {
      el.removeEventListener('canplay', done);
      el.removeEventListener('error', done);
      resolve();
    };
    el.addEventListener('canplay', done);
    el.addEventListener('error', done);
  });
}

const QuietRoom: React.FC<QuietRoomProps> = ({ onBack, skipIntro = false }) => {
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showInfo, setShowInfo] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [objects, setObjects] = useState<FloatingObject[]>([]);
  const [bgClass, setBgClass] = useState('bg-rk-sky-100');
  const [timeMode, setTimeMode] = useState<'day' | 'evening' | 'night'>('day');
  
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const skipIntroAppliedRef = useRef(false);
  const bgmSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const bgmFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgmSrcRef = useRef<string>(bgmTrackForTimeMode('day').src);
  const bgmSwitchingRef = useRef(false);

  const rampBgmGain = useCallback((to: number, durationSec = BGM_FADE_SEC) => {
    const ctx = audioContextRef.current;
    const gain = bgmGainRef.current;
    if (!ctx || !gain) return;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(to, t + durationSec);
  }, []);

  const applyBgmAudibility = useCallback(
    (fade = false) => {
      const target = isMuted ? 0 : volume;
      if (fade) rampBgmGain(target);
      else if (bgmGainRef.current) bgmGainRef.current.gain.value = target;
      else if (audioRef.current) {
        audioRef.current.muted = isMuted;
        audioRef.current.volume = isMuted ? 0 : volume;
      }
    },
    [isMuted, volume, rampBgmGain],
  );

  const ensureBgmElementSrc = useCallback((mode: QuietTimeMode) => {
    const el = audioRef.current;
    if (!el) return;
    const src = bgmTrackForTimeMode(mode).src;
    if (bgmSrcRef.current !== src) {
      el.src = src;
      el.load();
      bgmSrcRef.current = src;
    }
  }, []);

  const playBgmWithFadeIn = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    ensureBgmElementSrc(timeMode);
    el.muted = false;
    el.volume = 1;
    if (bgmGainRef.current) bgmGainRef.current.gain.value = 0;
    try {
      await el.play();
    } catch (e) {
      console.log('Audio play failed:', e);
      return;
    }
    applyBgmAudibility(true);
  }, [applyBgmAudibility, ensureBgmElementSrc, timeMode]);

  const crossfadeBgmToMode = useCallback(
    async (mode: QuietTimeMode) => {
      const el = audioRef.current;
      if (!el || bgmSwitchingRef.current) return;
      const nextSrc = bgmTrackForTimeMode(mode).src;
      if (bgmSrcRef.current === nextSrc) return;

      bgmSwitchingRef.current = true;
      const peak = isMuted ? 0 : volume;
      try {
        rampBgmGain(0, BGM_FADE_SEC);
        await new Promise<void>((resolve) => {
          bgmFadeTimerRef.current = setTimeout(() => {
            bgmFadeTimerRef.current = null;
            resolve();
          }, BGM_FADE_SEC * 1000 + 80);
        });
        el.pause();
        el.currentTime = 0;
        el.src = nextSrc;
        el.load();
        bgmSrcRef.current = nextSrc;
        await waitForBgmReady(el);
        try {
          await el.play();
        } catch (e) {
          console.log('Audio play failed:', e);
          return;
        }
        if (bgmGainRef.current) {
          bgmGainRef.current.gain.value = 0;
        }
        rampBgmGain(peak, BGM_FADE_SEC);
      } finally {
        bgmSwitchingRef.current = false;
      }
    },
    [isMuted, volume, rampBgmGain],
  );

  const stopBgmWithFadeOut = useCallback(async () => {
    if (bgmFadeTimerRef.current) {
      clearTimeout(bgmFadeTimerRef.current);
      bgmFadeTimerRef.current = null;
    }
    rampBgmGain(0, BGM_FADE_SEC);
    await new Promise<void>((resolve) => {
      bgmFadeTimerRef.current = setTimeout(() => {
        bgmFadeTimerRef.current = null;
        const el = audioRef.current;
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
        resolve();
      }, BGM_FADE_SEC * 1000 + 60);
    });
  }, [rampBgmGain]);

  // Synthesized Pop Sound
  const playPopSound = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Higher pitch for a "small" feel
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);

      // Shorter duration and lower volume for a "small" sound
      gain.gain.setValueAtTime(volume * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      console.error('Pop sound failed:', e);
    }
  }, [isMuted, volume]);

  // 時間帯で空の色を変える（昼は明るい水色、夕・夜は静かな深い青）
  useEffect(() => {
    const updateTimeMode = () => {
      const hour = new Date().getHours();
      let mode: 'day' | 'evening' | 'night' = 'day';
      let bg =
        'bg-gradient-to-b from-rk-sky-200 via-rk-cyan-100 to-rk-sky-300';

      if (hour >= 6 && hour < 17) {
        mode = 'day';
        bg = 'bg-gradient-to-b from-rk-sky-200 via-rk-cyan-100 to-rk-sky-300';
      } else if (hour >= 17 && hour < 20) {
        mode = 'evening';
        bg = 'bg-gradient-to-b from-rk-slate-900 via-rk-blue-950 to-rk-black';
      } else {
        mode = 'night';
        bg = 'bg-gradient-to-b from-rk-black via-rk-slate-950 to-rk-blue-950';
      }

      setTimeMode(mode);
      setBgClass(bg);
    };

    updateTimeMode();
    const interval = setInterval(updateTimeMode, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // UI Auto-hide logic
  const resetUITimer = useCallback(() => {
    setIsUIVisible(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => {
      setIsUIVisible(false);
    }, 4000);
  }, []);

  useEffect(() => {
    resetUITimer();
    return () => {
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    };
  }, [resetUITimer]);

  // Object generation logic
  useEffect(() => {
    const generateObject = () => {
      const id = Math.random().toString(36).substring(2, 9);
      let emoji = '';
      
      if (timeMode === 'night') {
        emoji = Math.random() < 0.9 ? '⭐' : ALL_OBJECTS[Math.floor(Math.random() * ALL_OBJECTS.length)];
      } else {
        emoji = ALL_OBJECTS[Math.floor(Math.random() * ALL_OBJECTS.length)];
      }

      const newObj: FloatingObject = {
        id,
        emoji,
        x: Math.random() * 90 + 5, // 5% to 95%
        y: 110, // Start below screen
        size: 30 + Math.random() * 50,
        duration: 20 + Math.random() * 30,
        delay: 0,
        swayDuration: 4 + Math.random() * 4,
        rotationDuration: 10 + Math.random() * 10,
      };

      setObjects(prev => [...prev, newObj]);

      // Remove object after animation
      setTimeout(() => {
        setObjects(prev => prev.filter(o => o.id !== id));
      }, newObj.duration * 1000);
    };

    // Initial batch
    for (let i = 0; i < 10; i++) {
      setTimeout(generateObject, Math.random() * 5000);
    }

    const interval = setInterval(generateObject, 4000);
    return () => clearInterval(interval);
  }, [timeMode]);

  const handleStart = () => {
    setIsStarted(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        void audioContextRef.current.resume().catch(() => {
          /* 端末の音声ルーティング不可 — しずかの間は HTMLAudio で続行 */
        });
      }
    } catch {
      /* ignore */
    }
    void playBgmWithFadeIn();
    resetUITimer();
  };

  useEffect(() => {
    if (!skipIntro || skipIntroAppliedRef.current) return;
    skipIntroAppliedRef.current = true;
    setIsStarted(true);
    requestAnimationFrame(() => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
          void audioContextRef.current.resume();
        }
      } catch {
        /* ignore */
      }
      void playBgmWithFadeIn();
      resetUITimer();
    });
  }, [skipIntro, resetUITimer, playBgmWithFadeIn]);

  const handlePop = (id: string) => {
    playPopSound();
    setObjects(prev => prev.filter(o => o.id !== id));
  };

  const handleBack = () => {
    void (async () => {
      await stopBgmWithFadeOut();
      onBack();
    })();
  };

  const handleOpenNote = () => {
    trackRakudaHubMenu('note');
    openRakudaNote();
    resetUITimer();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (isStarted && bgmGainRef.current) {
      rampBgmGain(next ? 0 : volume, 0.35);
    } else {
      applyBgmAudibility(false);
    }
    resetUITimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isStarted && bgmGainRef.current && !isMuted) {
      rampBgmGain(val, 0.25);
    } else {
      applyBgmAudibility(false);
    }
    resetUITimer();
  };

  // BGM: MediaElement → Gain（音量・ミュート）
  useEffect(() => {
    if (!isStarted) return;
    const el = audioRef.current;
    if (!el) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      if (!bgmSourceRef.current) {
        bgmSourceRef.current = ctx.createMediaElementSource(el);
      }
      if (!bgmGainRef.current) {
        bgmGainRef.current = ctx.createGain();
      }

      try {
        bgmSourceRef.current.disconnect();
      } catch {}
      try {
        bgmGainRef.current.disconnect();
      } catch {}

      bgmSourceRef.current.connect(bgmGainRef.current);
      bgmGainRef.current.connect(ctx.destination);
      if (!isStarted) bgmGainRef.current.gain.value = 0;
    } catch (e) {
      console.warn('[QuietRoom] audio routing setup failed', e);
    }
  }, [isStarted]);

  /** 未開始時だけ <audio> の src を時間帯に合わせる（開始後はフェード切替のみ） */
  useEffect(() => {
    if (!isStarted) ensureBgmElementSrc(timeMode);
  }, [timeMode, isStarted, ensureBgmElementSrc]);

  /** 昼↔夜の境目で BGM をフェードアウト → 曲替え → フェードイン */
  const prevTimeModeRef = useRef(timeMode);
  useEffect(() => {
    if (!isStarted) {
      prevTimeModeRef.current = timeMode;
      return;
    }
    const prev = prevTimeModeRef.current;
    if (prev === timeMode) return;
    const prevTrack = bgmTrackForTimeMode(prev);
    const nextTrack = bgmTrackForTimeMode(timeMode);
    prevTimeModeRef.current = timeMode;
    if (prevTrack.src === nextTrack.src) return;
    void crossfadeBgmToMode(timeMode);
  }, [timeMode, isStarted, crossfadeBgmToMode]);

  useEffect(() => {
    return () => {
      if (bgmFadeTimerRef.current) clearTimeout(bgmFadeTimerRef.current);
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-[200] transition-colors duration-[30000ms] ease-linear overflow-hidden flex flex-col ${bgClass}`}
      onClick={resetUITimer}
      onMouseMove={resetUITimer}
      onTouchStart={resetUITimer}
    >
      {/* BGM Element */}
      {/* src は React で切り替えない（17時などで即遮断されるため）。曲替えは crossfadeBgmToMode のみ */}
      <audio ref={audioRef} loop preload="auto" />

      {/* Floating Objects Layer（タップ用絵文字 — 背景パターンより手前） */}
      <div className="absolute inset-0 pointer-events-none z-[5]">
        <AnimatePresence>
          {objects.map(obj => (
            <motion.div
              key={obj.id}
              initial={{ y: '110vh', x: `${obj.x}vw`, opacity: 0 }}
              animate={{ 
                y: '-20vh', 
                opacity: 1,
                transition: { duration: obj.duration, ease: 'linear' }
              }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-auto cursor-pointer select-none"
              style={{ fontSize: obj.size }}
              onClick={(e) => {
                e.stopPropagation();
                handlePop(obj.id);
              }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
            >
              <motion.div
                animate={{ 
                  x: [-15, 15, -15],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: obj.swayDuration, 
                  repeat: Infinity, 
                  ease: 'easeInOut' 
                }}
              >
                {obj.emoji}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* UI Layer */}
      {!isStarted ? (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm z-[210] ${
            timeMode === 'day' ? 'bg-rk-white/30' : 'bg-rk-sky-900/25'
          }`}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${cardClass} bg-rk-sky-50/95 border-rk-sky-200 ring-1 ring-rest-accent/25 flex flex-col items-center gap-3`}
          >
            <div className="text-sm">🐫</div>
            <h2 className={`${pageTopHeadingClass} text-rk-slate-800`}>しずかの間</h2>
            <p className="text-xs text-rk-slate-600 text-center">
              急がなくていい、<br />
              ただぼんやりと眺めていられる場所。
            </p>
            <button
              onClick={handleStart}
              className={`${btnPrimary} w-full`}
            >
              そっと、はじめる
            </button>
            <button 
              onClick={handleBack}
              className={`${btnGhost} w-full`}
            >
              もどる
            </button>
            <button
              type="button"
              onClick={handleOpenNote}
              className="text-[11px] font-bold text-rk-slate-500 underline underline-offset-2 active:opacity-70"
            >
              大人の方 — らくだの記事（note・外部）
            </button>
          </motion.div>
        </div>
      ) : (
        <>
          {/* Controls */}
          <AnimatePresence>
            {isUIVisible && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                {/* Top Bar */}
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center pointer-events-auto">
                  <RK19QuietRoomBackButton onClick={handleBack} />
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-rk-white px-3 py-2.5 rounded-xl border border-rk-slate-300 shadow-md min-w-[9.5rem]">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="shrink-0 text-rk-slate-800 active:scale-95 transition-transform"
                        aria-label={isMuted ? 'ミュート解除' : 'ミュート'}
                      >
                        {isMuted ? <VolumeX size={22} strokeWidth={2.5} /> : <Volume2 size={22} strokeWidth={2.5} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        aria-label="音量"
                        className="quiet-room-volume-slider w-[7.5rem] sm:w-32 h-3 rounded-full appearance-none cursor-pointer"
                        style={{
                          WebkitAppearance: 'none',
                          background: isMuted
                            ? 'linear-gradient(to right, var(--rk-slate-300) 0%, var(--rk-slate-300) 100%)'
                            : `linear-gradient(to right, var(--rk-rest-accent) 0%, var(--rk-rest-accent) ${volume * 100}%, var(--rk-slate-200) ${volume * 100}%, var(--rk-slate-200) 100%)`,
                        }}
                      />
                    </div>
                    
                    <button
                      onClick={() => setShowInfo(true)}
                      className="w-12 h-12 flex items-center justify-center bg-rk-white rounded-xl text-rk-slate-700 shadow-sm border border-rk-slate-200 active:scale-95 transition-transform"
                    >
                      <Info size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div
                  className={`absolute bottom-8 left-1/2 -translate-x-1/2 font-black tracking-widest text-xs uppercase font-kiwi pointer-events-none ${
                    timeMode === 'day' ? 'text-rk-sky-800/50' : 'text-rk-white/40'
                  }`}
                >
                  らくだ珈琲 しずかの間
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info Modal */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[250] flex items-center justify-center bg-rk-sky-900/40 backdrop-blur-md p-4"
                onClick={() => setShowInfo(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className={`${cardClass} max-w-sm w-full`}
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-sm font-medium text-rk-slate-700 mb-3 flex items-center gap-2">
                    <Info className="text-rest-accent" /> しずかの間について
                  </h3>
                  <div className="space-y-3 text-xs text-rk-slate-600 leading-relaxed">
                    <p>ここは、何もしなくていい場所です。</p>
                    <p>流れる時間をただ眺めたり、ふわふわ浮いている仲間たちをパチンと弾いたりして、心を休めてください。</p>
                    <p>時間帯によって、空の色や集まってくる仲間たちが少しずつ変わります。</p>
                    
                    <div className="pt-3 border-t border-rk-slate-200 mt-3 text-[10px] text-rk-slate-600 leading-relaxed">
                      <p>
                        BGMは{' '}
                        <a
                          href={AMACHA_MUSIC_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rest-accent underline font-bold"
                        >
                          甘茶の音楽工房
                        </a>
                        （Music Atelier Amacha）さんの作品を使わせていただいています。
                      </p>
                      <ul className="mt-2 space-y-1">
                        <li>
                          ・昼（6時〜17時）「{QUIET_ROOM_BGM.day.title}」
                        </li>
                        <li>
                          ・夕方・夜（17時以降）「{QUIET_ROOM_BGM.night.title}」
                        </li>
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-rk-slate-200 mt-3">
                      <button
                        type="button"
                        onClick={handleOpenNote}
                        className="text-[11px] font-bold text-rk-slate-600 underline underline-offset-2 text-left active:opacity-70"
                      >
                        大人の方 — らくだの記事（note・外部）
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInfo(false)}
                    className={`${btnGhost} w-full mt-3`}
                  >
                    わかった
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <style>{`
        .font-kiwi { font-family: 'Kiwi Maru', serif; }
        .quiet-room-volume-slider::-webkit-slider-runnable-track {
          height: 12px;
          border-radius: 9999px;
        }
        .quiet-room-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          margin-top: -4px;
          background: var(--rk-white);
          border: 3px solid var(--rk-rest-accent);
          border-radius: 50%;
          box-shadow: 0 1px 4px rgb(0 0 0 / 0.22);
          cursor: pointer;
        }
        .quiet-room-volume-slider::-moz-range-track {
          height: 12px;
          border-radius: 9999px;
          background: transparent;
        }
        .quiet-room-volume-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: var(--rk-white);
          border: 3px solid var(--rk-rest-accent);
          border-radius: 50%;
          box-shadow: 0 1px 4px rgb(0 0 0 / 0.22);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default QuietRoom;
