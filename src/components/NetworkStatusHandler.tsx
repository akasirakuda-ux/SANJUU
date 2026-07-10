import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface NetworkStatusHandlerProps {
  /**
   * (optional) Used by legacy blackout UI. Kept optional so the handler never blocks the app.
   */
  onReset?: () => void;
  /** しずかの間・みんなの願いなど — 遅延警告の浮遊 UI（`z-[9999]`）を出さずポーリングも止める */
  suppressFloatingWarnings?: boolean;
}

type MessageType = 'fuwari' | 'rakuda';

interface WarningMessage {
  id: number;
  sender: string;
  text: string;
  type: MessageType;
}

export const NetworkStatusHandler: React.FC<NetworkStatusHandlerProps> = ({
  suppressFloatingWarnings = false,
}) => {
  const [latency, setLatency] = useState(0);
  const [lastWarningTime, setLastWarningTime] = useState(0);
  const [messages, setMessages] = useState<WarningMessage[]>([]);

  const WARNING_INTERVAL = 60000; // 1分に1回
  const LATENCY_THRESHOLD = 2000; // 2秒以上の遅延で警告

  const addMessage = useCallback((sender: string, text: string, type: MessageType) => {
    const newMessage: WarningMessage = {
      id: Date.now(),
      sender,
      text,
      type
    };
    setMessages(prev => [...prev, newMessage]);
    setLastWarningTime(Date.now());

    // 5秒後にメッセージを消去（アニメーション完了後）
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== newMessage.id));
    }, 8000);
  }, []);

  const checkNetwork = useCallback(async () => {
    const start = Date.now();
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const end = Date.now();
      const currentLatency = end - start;
      
      setLatency(currentLatency);

      // 通信が遅い場合の警告
      if (currentLatency > LATENCY_THRESHOLD && Date.now() - lastWarningTime > WARNING_INTERVAL) {
        const rand = Math.random();
        if (rand < 0.5) {
          addMessage('フワリ', 'にゃ？', 'fuwari');
        } else {
          addMessage('らくだ珈琲🐫☕', '停電しちゃうかも💦停電したらゴメンネ', 'rakuda');
        }
      }
      // If the health endpoint returns a non-2xx, treat it as "slow/unhealthy" but never block UI.
      if (!response.ok && Date.now() - lastWarningTime > WARNING_INTERVAL) {
        addMessage('らくだ珈琲🐫☕', '通信が不安定かも。ゆっくり試してね', 'rakuda');
      }
    } catch (error) {
      // Never block the app with a full-screen overlay. Just show a gentle warning occasionally.
      if (Date.now() - lastWarningTime > WARNING_INTERVAL) {
        addMessage('らくだ珈琲🐫☕', '通信が不安定かも。ゆっくり試してね', 'rakuda');
      }
    }
  }, [lastWarningTime, addMessage]);

  useEffect(() => {
    if (suppressFloatingWarnings) {
      setMessages([]);
      return;
    }
    const interval = setInterval(checkNetwork, 10000); // 10秒ごとにチェック
    return () => clearInterval(interval);
  }, [checkNetwork, suppressFloatingWarnings]);

  return (
    <>
      {!suppressFloatingWarnings ? (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ y: '100vh', opacity: 0, x: '10%' }}
                animate={{ y: '-20vh', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 7, ease: "linear" }}
                className="absolute bottom-0 left-4"
              >
                <div
                  className={`
                px-6 py-3 rounded-2xl shadow-lg border-2 text-sm md:text-base font-medium
                ${msg.type === 'fuwari' ? 'bg-rk-white border-rk-blue-200 text-rk-blue-600' : 
                  'bg-rk-amber-50 border-rk-amber-200 text-rk-amber-700'}
              `}
                >
                  <span className="font-bold mr-2">{msg.sender}:</span>
                  {msg.text}
                  <div
                    className={`absolute -bottom-2 left-6 w-4 h-4 rotate-45 border-r-2 border-b-2 
                  ${msg.type === 'fuwari' ? 'bg-rk-white border-rk-blue-200' : 
                    'bg-rk-amber-50 border-rk-amber-200'}
                `}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </>
  );
};
