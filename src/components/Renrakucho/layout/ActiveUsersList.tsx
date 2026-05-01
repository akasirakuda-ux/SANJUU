import React from 'react';
import { motion } from 'framer-motion';
import type { ActiveUser } from '../types';

const ActiveUsersList: React.FC<{
  activeUsers: ActiveUser[];
}> = ({ activeUsers }) => {
  if (activeUsers.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col items-center">
      <div className="text-[10px] font-black text-amber-950 mb-2 uppercase tracking-widest text-center">
        今、いる人（{activeUsers.length}人）
      </div>
      <div className="flex flex-wrap justify-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
        {activeUsers.map((u) => (
          <motion.div key={u.uid} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-sm">{u.emoji}</div>
            <div className="text-[8px] font-bold text-amber-950 max-w-[40px] truncate text-center bg-white border border-slate-200 shadow-sm rounded-lg px-1.5 py-0.5">
              {u.name}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ActiveUsersList;
