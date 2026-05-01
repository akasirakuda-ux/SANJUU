import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { btnGhost, btnPrimary, cardClass } from '../ui/policy';

type EntranceStatus = 'peeking' | 'open' | 'closed';

interface EntranceProps {
  onEnter: () => void;
}

const Entrance: React.FC<EntranceProps> = ({ onEnter }) => {
  const [status, setStatus] = useState<EntranceStatus>('peeking');
  const [showExitButton, setShowExitButton] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening' | 'night'>('morning');
  const [isStreamMode, setIsStreamMode] = useState(false);

  useEffect(() => {
    // Force-enter bypass (for ops / recovery): https://rakuda.coffee/?force=1
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('force') === '1') {
        setStatus('open');
        const t = window.setTimeout(() => onEnter(), 50);
        return () => window.clearTimeout(t);
      }
    } catch {
      // ignore
    }

    let isMounted = true;
    let timeout1: NodeJS.Timeout;
    let timeout2: NodeJS.Timeout;

    // 時間帯の判定
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 16) setTimeOfDay('morning');
    else if (hour >= 16 && hour < 19) setTimeOfDay('evening');
    else setTimeOfDay('night');

    // 覗き見判定
    const checkStatus = async () => {
      const startTime = Date.now();
      try {
        // 実際の通信状態を確認
        const response = await fetch('/api/health').catch(() => ({ ok: false }));
        
        if (!isMounted) return;

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1500 - elapsedTime);

        timeout1 = setTimeout(() => {
          if (!isMounted) return;
          if (response.ok) {
            setStatus('open');
            // あかねちゃんの演出の後に本編へ
            timeout2 = setTimeout(() => {
              if (isMounted) onEnter();
            }, 2500);
          } else {
            setStatus('closed');
          }
        }, remainingTime);
      } catch (err) {
        console.error("Entrance check failed:", err);
        if (isMounted) {
          timeout1 = setTimeout(() => setStatus('closed'), 1500);
        }
      }
    };

    checkStatus();
    return () => {
      isMounted = false;
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [onEnter]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const v = p.get('stream');
      if (v === '1') {
        setIsStreamMode(true);
        return;
      }
      if (v === '0') {
        setIsStreamMode(false);
        return;
      }
    } catch {
      // ignore
    }
    try {
      setIsStreamMode(window.localStorage.getItem('rk_stream_mode') === '1');
    } catch {
      setIsStreamMode(false);
    }
  }, []);

  // 背景色の設定（ポリシー: slate ベース）
  const getBgOverlay = () => {
    switch (timeOfDay) {
      case 'morning': return 'bg-sky-50';
      case 'evening': return 'bg-amber-50';
      case 'night': return 'bg-violet-50';
    }
  };

  const getBrickColor = () => {
    switch (timeOfDay) {
      case 'morning': return 'bg-[#b87c6a]';
      case 'evening': return 'bg-[#8c4a38]';
      case 'night': return 'bg-[#4a2a1f]';
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center overflow-hidden ${getBgOverlay()}`}>
      {/* Stream toggle: always visible even if entrance blocks navigation */}
      <div className="fixed top-3 left-3 z-[99999] pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            const next = isStreamMode ? '0' : '1';
            try {
              window.localStorage.setItem('rk_stream_mode', next);
            } catch {
              // ignore
            }
            setIsStreamMode(next === '1');
          }}
          className={`px-4 py-3 rounded-2xl text-sm font-black border-2 shadow-xl active:scale-95 transition-transform ${
            isStreamMode
              ? 'bg-emerald-500 border-emerald-800 text-white'
              : 'bg-slate-900 border-slate-950 text-white'
          }`}
          title="配信モード（軽量化）を切り替えます（入口でも可能）"
        >
          広告 {isStreamMode ? 'なし' : 'あり'}
        </button>
        <div className="mt-1 text-[10px] font-bold text-slate-700 bg-white/90 border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
          build: 2026-04-28.12-45
        </div>
      </div>

      {/* 50年前のレンガの壁 */}
      <div className={`absolute inset-0 grid grid-cols-8 gap-1 p-1 opacity-80 ${getBrickColor()}`}>
        {Array.from({ length: 64 }).map((_, i) => (
          <div 
            key={i} 
            className={`h-full w-full border border-black/10 rounded-sm ${
              i % 7 === 0 ? 'opacity-40' : 'opacity-100' // 剥がれかけた表現
            }`}
            style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
          />
        ))}
      </div>

        {/* 覗き窓の枠 */}
        <div className={`relative z-10 w-64 h-80 ${cardClass} overflow-hidden`}>
          {/* 窓の中の光 */}
          <AnimatePresence>
            {status === 'peeking' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-amber-50 flex flex-col items-center justify-center"
              >
                {/* フワリの覗き込み */}
                <motion.div
                  animate={{ y: [40, 0, 40] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="text-5xl mb-2"
                >
                  🐈‍⬛
                </motion.div>
                <div className="text-[10px] text-slate-600 animate-pulse font-medium">
                  じゅんび中...
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-amber-100 blur-xl -z-10"
                />
              </motion.div>
            )}
          </AnimatePresence>

        {/* あかねちゃんの登場 */}
        <AnimatePresence>
          {status === 'open' && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-amber-50"
            >
              <div className="text-4xl mb-2">👧</div>
              <div className="text-sm font-medium text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                いらっしゃい！
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* フワリの登場 */}
        <AnimatePresence>
          {status === 'closed' && (
            <motion.div 
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-end pb-8 bg-slate-50"
            >
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-5xl mb-2"
              >
                🐈‍⬛
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className={`${cardClass} mx-4 text-center`}
              >
                ごめんね、いまは<br/>じゅんび中なんだ。
                <button 
                  onClick={onEnter}
                  className={`mt-2 block w-full ${btnGhost}`}
                >
                  （それでも入る）
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* フワリが去るアニメーション */}
      <AnimatePresence>
        {status === 'closed' && (
          <motion.div
            initial={{ x: 0, opacity: 1 }}
            animate={{ x: 400, opacity: 0 }}
            transition={{ delay: 3, duration: 2, ease: "linear" }}
            onAnimationComplete={() => setShowExitButton(true)}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          >
            <div className="relative">
              <span className="text-6xl">🐈‍⬛</span>
              {/* 高く上げた尻尾の表現（簡易的に絵文字で代用しつつ動きを出す） */}
              <motion.div 
                animate={{ rotate: [-10, 10, -10] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="absolute -top-2 -right-2 text-2xl"
              >
                🪄
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* おさんぽボタン */}
      <AnimatePresence>
        {showExitButton && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-20 z-30"
          >
            <button 
              onClick={() => window.location.href = 'https://www.google.com'}
              className={`flex items-center gap-2 ${btnPrimary}`}
            >
              <LogOut className="w-5 h-5" />
              またのぞきにくることにする（いったん帰る）
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 覗き見中のメッセージ */}
      {status === 'peeking' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-20 text-sm text-slate-600"
        >
          お店をのぞいてみる...
        </motion.div>
      )}
    </div>
  );
};

export default Entrance;
