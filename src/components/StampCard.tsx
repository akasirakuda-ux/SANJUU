import React, { useState } from 'react';
import RakudaFloatingBackdrop from './RakudaFloatingBackdrop';

interface StampCardProps {
  completedDates: string[]; // YYYY-MM-DD
  specialDates: string[]; // YYYY-MM-DD
  onClose: () => void;
}

const StampCard: React.FC<StampCardProps> = ({ completedDates, specialDates, onClose }) => {
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed
  
  const changeMonth = (delta: number) => {
    setViewDate(new Date(year, month + delta, 1));
  };

  // Get days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const seasonalEmojis = [
    '🎍', '👹', '🌸', '🎒', '🎏', '☔',
    '🎋', '🎆', '🎑', '🎃', '🍂', '🎄'
  ];

  const days = [];
  // Add empty slots for days before the first of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const isCompleted = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return completedDates.includes(dateStr);
  };

  const isSpecial = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return specialDates.includes(dateStr);
  };

  const getStampColor = (count: number) => {
    if (count >= 40) return '#ef4444'; // Red
    if (count >= 30) return '#fbbf24'; // Gold
    if (count >= 20) return '#3b82f6'; // Blue
    if (count >= 10) return '#22c55e'; // Green
    return '#78350f'; // Brown (amber-900)
  };

  const totalStamps = completedDates.length;
  const stampColor = getStampColor(totalStamps);

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-gradient-to-b from-emerald-200/95 via-green-200/90 to-emerald-300/85 backdrop-blur-sm overflow-hidden">
      <RakudaFloatingBackdrop variant="stamp" />
      <div className="relative z-10 bg-white rounded-xl shadow-sm w-full max-w-md border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden"
        style={{ borderColor: stampColor + '44' }} // Add transparency to the border
      >
        {/* Header */}
        <div className="p-4 pb-2 flex flex-col items-center bg-gradient-to-b from-emerald-100 to-green-100 relative border-b border-emerald-300/90">
          <div className="flex items-center justify-between w-full mb-2">
            <button 
              onClick={() => changeMonth(-1)}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-700 border border-slate-200 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="text-sm">{seasonalEmojis[month]}</div>
            <button 
              onClick={() => changeMonth(1)}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-700 border border-slate-200 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <h2 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            {year}年 {monthNames[month]} しゅっせき簿
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            アプリをひらいてスタンプをあつめよう！
          </p>
        </div>

        {/* Calendar Grid */}
        <div className="p-4 pt-3 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 gap-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-black ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-emerald-500'}`}>
                {d}
              </div>
            ))}
            {days.map((day, i) => (
              <div 
                key={i} 
                className={`aspect-square rounded-xl border flex items-center justify-center relative overflow-hidden
                  ${day === null ? 'border-transparent' : 'border-emerald-100 bg-white shadow-sm'}
                `}
              >
                {day && (
                  <>
                    <span className="absolute top-1 left-1.5 text-[10px] font-black text-emerald-200">
                      {day}
                    </span>
                    {isCompleted(day) && (
                      <div 
                        className={`w-[85%] h-[85%] border rounded-xl flex items-center justify-center rotate-[-10deg] relative
                          ${isSpecial(day) ? 'bg-emerald-100/50' : ''}
                        `}
                        style={{ borderColor: stampColor }}
                      >
                        <span className="text-sm leading-none select-none">🐫</span>
                        {isSpecial(day) && (
                          <span className="absolute -top-1 -right-1 text-[10px] animate-pulse">✨</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 flex flex-col gap-3 bg-emerald-100 border-t border-emerald-300/90">
          <div className="flex justify-center items-center gap-2 bg-white/80 py-2 px-4 rounded-xl border border-emerald-100">
            <span className="text-xs font-black text-emerald-900">るいけいスタンプ:</span>
            <span className="text-sm font-medium tabular-nums" style={{ color: stampColor }}>
              {totalStamps}
            </span>
            <span className="text-xs font-black text-emerald-900">こ</span>
          </div>
          <button 
            onClick={onClose}
            className="w-full p-3 bg-emerald-200 text-slate-800 rounded-xl text-sm font-medium shadow-sm active:scale-95 transition-transform border border-emerald-300"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
};

export default StampCard;
