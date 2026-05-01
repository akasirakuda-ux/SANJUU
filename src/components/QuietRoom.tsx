import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Volume2, VolumeX, Info } from 'lucide-react';
import { btnGhost, btnPrimary, cardClass } from '../ui/policy';
import { pageTopHeadingClass } from '../ui/typography';

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
const VIZ_BARS = 24;

const QuietRoom: React.FC<QuietRoomProps> = ({ onBack, skipIntro = false }) => {
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showInfo, setShowInfo] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [objects, setObjects] = useState<FloatingObject[]>([]);
  const [bgClass, setBgClass] = useState('bg-sky-100');
  const [timeMode, setTimeMode] = useState<'day' | 'evening' | 'night'>('day');
  
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const skipIntroAppliedRef = useRef(false);
  const bgmSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bgmAnalyserRef = useRef<AnalyserNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const bgmFreqDataRef = useRef<Uint8Array | null>(null);
  const vizBarRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Synthesized Pop Sound
  const playPopSound = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

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

  // 静寂の青：深い青のグラデ（時間帯でトーンのみ変える）
  useEffect(() => {
    const updateTimeMode = () => {
      const hour = new Date().getHours();
      let mode: 'day' | 'evening' | 'night' = 'day';
      let bg =
        'bg-gradient-to-b from-slate-800 via-blue-950 to-slate-950';

      if (hour >= 6 && hour < 17) {
        mode = 'day';
        bg = 'bg-gradient-to-b from-slate-800 via-blue-950 to-slate-950';
      } else if (hour >= 17 && hour < 20) {
        mode = 'evening';
        bg = 'bg-gradient-to-b from-slate-900 via-blue-950 to-black';
      } else {
        mode = 'night';
        bg = 'bg-gradient-to-b from-black via-slate-950 to-blue-950';
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
    if (audioRef.current) {
      // Volume/mute are controlled by GainNode when possible.
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
    // Ensure AudioContext is resumed by user gesture (for analyser + routing)
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        void audioContextRef.current.resume();
      }
    } catch {}
    resetUITimer();
  };

  useEffect(() => {
    if (!skipIntro || skipIntroAppliedRef.current) return;
    skipIntroAppliedRef.current = true;
    setIsStarted(true);
    requestAnimationFrame(() => {
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.play().catch((e) => console.log('Audio play failed:', e));
      }
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
          void audioContextRef.current.resume();
        }
      } catch {}
      resetUITimer();
    });
  }, [skipIntro, resetUITimer]);

  const handlePop = (id: string) => {
    playPopSound();
    setObjects(prev => prev.filter(o => o.id !== id));
  };

  const handleBack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onBack();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (bgmGainRef.current) {
      bgmGainRef.current.gain.value = next ? 0 : volume;
    } else if (audioRef.current) {
      audioRef.current.muted = next;
      audioRef.current.volume = next ? 0 : volume;
    }
    resetUITimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (bgmGainRef.current) {
      bgmGainRef.current.gain.value = isMuted ? 0 : val;
    } else if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : val;
    }
    resetUITimer();
  };

  // BGM Visualizer (AnalyserNode): frequency driven
  useEffect(() => {
    if (!isStarted) return;
    const el = audioRef.current;
    if (!el) return;

    let raf = 0;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      if (!bgmSourceRef.current) {
        bgmSourceRef.current = ctx.createMediaElementSource(el);
      }
      if (!bgmAnalyserRef.current) {
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0.75;
        bgmAnalyserRef.current = an;
      }
      if (!bgmGainRef.current) {
        bgmGainRef.current = ctx.createGain();
      }

      // Ensure routing is connected once
      try {
        bgmSourceRef.current.disconnect();
      } catch {}
      try {
        bgmAnalyserRef.current.disconnect();
      } catch {}
      try {
        bgmGainRef.current.disconnect();
      } catch {}

      bgmSourceRef.current.connect(bgmAnalyserRef.current);
      bgmAnalyserRef.current.connect(bgmGainRef.current);
      bgmGainRef.current.connect(ctx.destination);

      bgmGainRef.current.gain.value = isMuted ? 0 : volume;

      const freqBins = bgmAnalyserRef.current.frequencyBinCount;
      if (!bgmFreqDataRef.current || bgmFreqDataRef.current.length !== freqBins) {
        bgmFreqDataRef.current = new Uint8Array(freqBins);
      }

      const bars = vizBarRefs.current;
      const data = bgmFreqDataRef.current;
      const an = bgmAnalyserRef.current;

      const tick = () => {
        if (!an || !data) return;
        an.getByteFrequencyData(data);

        // Map bars to bins (more detail in low-mid)
        const minBin = 2;
        const maxBin = Math.min(freqBins - 1, Math.floor(freqBins * 0.45));

        for (let i = 0; i < VIZ_BARS; i++) {
          const bar = bars[i];
          if (!bar) continue;
          const x0 = i / VIZ_BARS;
          const x1 = (i + 1) / VIZ_BARS;

          // quadratic mapping -> emphasize low bins
          const b0 = Math.floor(minBin + (maxBin - minBin) * x0 * x0);
          const b1 = Math.max(b0 + 1, Math.floor(minBin + (maxBin - minBin) * x1 * x1));

          let peak = 0;
          for (let b = b0; b < b1; b++) peak = Math.max(peak, data[b] ?? 0);

          const norm = peak / 255;
          const floor = 0.08;
          const v = floor + (1 - floor) * Math.pow(norm, 0.85);
          bar.style.transform = `scaleY(${v.toFixed(3)})`;
          bar.style.opacity = String(isMuted ? 0.22 : 0.6);
        }

        raf = window.requestAnimationFrame(tick);
      };

      raf = window.requestAnimationFrame(tick);
    } catch (e) {
      console.warn('[QuietRoom] visualizer setup failed', e);
    }

    return () => window.cancelAnimationFrame(raf);
  }, [isStarted, isMuted, volume]);

  return (
    <div 
      className={`fixed inset-0 z-[200] transition-colors duration-[30000ms] ease-linear overflow-hidden flex flex-col ${bgClass}`}
      onClick={resetUITimer}
      onMouseMove={resetUITimer}
      onTouchStart={resetUITimer}
    >
      {/* BGM Element */}
      <audio 
        ref={audioRef} 
        src="/bgm.mp3" 
        loop 
        preload="auto"
      />

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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-sky-900/25 backdrop-blur-sm z-[210]">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${cardClass} bg-sky-50/95 border-sky-200 flex flex-col items-center gap-3`}
          >
            <div className="text-sm">🐫</div>
            <h2 className={`${pageTopHeadingClass} text-slate-800`}>しずかの間</h2>
            <p className="text-xs text-slate-600 text-center">
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
                  <button
                    onClick={handleBack}
                    className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-700 shadow-sm border border-slate-200 active:scale-95 transition-transform"
                  >
                    <ChevronLeft size={32} strokeWidth={3} />
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={toggleMute} className="text-slate-700">
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={volume} 
                        onChange={handleVolumeChange}
                        className="w-24 h-1.5 bg-slate-100 rounded-xl appearance-none cursor-pointer accent-slate-600"
                      />
                    </div>
                    
                    <button
                      onClick={() => setShowInfo(true)}
                      className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-700 shadow-sm border border-slate-200 active:scale-95 transition-transform"
                    >
                      <Info size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 font-black tracking-widest text-xs uppercase font-kiwi pointer-events-none">
                  らくだ珈琲 しずかの間
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Pseudo Visualizer (no audio analysis) */}
          <div className="absolute left-0 right-0 bottom-0 z-[8] pointer-events-none px-6 pb-5">
            <div className="h-10 flex items-end justify-center gap-[3px]">
              {Array.from({ length: VIZ_BARS }, (_, i) => (
                <div
                  key={`viz-${i}`}
                  ref={(el) => {
                    vizBarRefs.current[i] = el;
                  }}
                  className="w-[3px] h-full rounded-full bg-gradient-to-t from-sky-400/60 via-cyan-200/70 to-white/80"
                  style={{ transformOrigin: 'bottom', transform: 'scaleY(0.12)' }}
                  aria-hidden
                />
              ))}
            </div>
          </div>

          {/* Info Modal */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[250] flex items-center justify-center bg-sky-900/40 backdrop-blur-md p-4"
                onClick={() => setShowInfo(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className={`${cardClass} max-w-sm w-full`}
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Info className="text-sky-400" /> しずかの間について
                  </h3>
                  <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                    <p>ここは、何もしなくていい場所です。</p>
                    <p>流れる時間をただ眺めたり、ふわふわ浮いている仲間たちをパチンと弾いたりして、心を休めてください。</p>
                    <p>時間帯によって、空の色や集まってくる仲間たちが少しずつ変わります。</p>
                    
                    <div className="pt-3 border-t border-slate-200 mt-3 text-[10px] text-slate-600">
                      <p>BGMは</p>
                      <p>サイト名⇒ 甘茶の音楽工房（英語表記＝Music Atelier Amacha）</p>
                      <p>さんの「静寂の星空」を使わせていただいてます</p>
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
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default QuietRoom;
