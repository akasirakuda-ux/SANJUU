import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';

const NotificationToast: React.FC<{
  notification: { type: 'success' | 'error'; text: string } | null;
}> = ({ notification }) => {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className={`fixed bottom-[calc(env(safe-area-inset-bottom)+var(--rk-app-status-footer-reserve)+10px)] left-1/2 z-[2850] p-3 rounded-xl shadow-sm border border-rk-slate-200 flex items-center gap-3 text-sm font-medium -translate-x-1/2 ${notification.type === 'success' ? 'bg-rk-success-50 text-rk-slate-700' : 'bg-rk-rose-50 text-rk-slate-700'}`}
        >
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {notification.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;

