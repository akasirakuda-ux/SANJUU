import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

interface GameNarratorProps {
  message: string;
  isVisible: boolean;
  /** false のときしずかの間など従来の bottom-24。それ以外は下端ステータス帯の上に寄せる */
  reserveBottomStatusInset?: boolean;
}

const GameNarrator: React.FC<GameNarratorProps> = ({ message, isVisible, reserveBottomStatusInset = false }) => {
  const [displayMessage, setDisplayMessage] = useState('');

  useEffect(() => {
    if (message) {
      setDisplayMessage(message);
    }
  }, [message]);

  return (
    <AnimatePresence>
      {isVisible && displayMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={`fixed left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md pointer-events-none ${
            reserveBottomStatusInset
              ? 'bottom-[calc(env(safe-area-inset-bottom)+var(--rk-app-status-footer-reserve)+5rem)]'
              : 'bottom-24'
          }`}
        >
          <div className="bg-rk-white/90 backdrop-blur-md border-2 border-rk-success-400 p-4 rounded-2xl shadow-xl flex items-start gap-3 relative">
            {/* Camel Icon */}
            <div className="w-10 h-10 bg-rk-success-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-rk-success-200">
              <span className="text-xl">🐫</span>
            </div>
            
            {/* Message */}
            <div className="flex-1">
              <div className="text-[10px] font-black text-rk-success-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <MessageCircle size={10} />
                Game Master
              </div>
              <p className="text-sm font-bold text-rk-success-900 leading-relaxed">
                {displayMessage}
              </p>
            </div>

            {/* Speech Bubble Tail */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-rk-white border-r-2 border-b-2 border-rk-success-400 rotate-45" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GameNarrator;
