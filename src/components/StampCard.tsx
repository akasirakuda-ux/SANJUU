import React, { useState } from 'react';
import {
  getDayClearCount,
  getTotalStampCount,
  isSpecialStampDay,
} from '../lib/shussekiDailyClears';
import { getShussekiMilestoneForTotal } from '../lib/shussekiMilestones';
import RakudaFloatingBackdrop from './RakudaFloatingBackdrop';
import { PARENT_REASSURANCE } from '../constants/parentReassurance';

interface StampCardProps {
  completedDates: string[]; // YYYY-MM-DD
  specialDates: string[]; // YYYY-MM-DD
  dailyClearCounts?: Record<string, number>;
  onClose: () => void;
}

const StampCard: React.FC<StampCardProps> = ({
  completedDates,
  specialDates,
  dailyClearCounts = {},
  onClose,
}) => {
  const now = new Date();
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const shussekiUser = { completedDates, specialDates, dailyClearCounts };

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
    '7月', '8月', '9月', '10月', '11月', '12月',
  ];

  const seasonalEmojis = [
    '🎍', '👹', '🌸', '🎒', '🎏', '☔',
    '🎋', '🎆', '🎑', '🎃', '🍂', '🎄',
  ];

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const dateKeyForDay = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isCompleted = (day: number) => getDayClearCount(shussekiUser, dateKeyForDay(day)) > 0;

  const isSpecial = (day: number) => isSpecialStampDay(shussekiUser, dateKeyForDay(day));

  const getStampColor = (count: number) => {
    if (count >= 40) return 'var(--rk-red-500)';
    if (count >= 30) return 'var(--rk-amber-400)';
    if (count >= 20) return 'var(--rk-blue-500)';
    if (count >= 10) return 'var(--rk-stamp-tier-green)';
    return 'var(--rk-amber-900)';
  };

  const totalStamps = getTotalStampCount(shussekiUser);
  const stampColor = getStampColor(totalStamps);
  const milestone = getShussekiMilestoneForTotal(totalStamps);

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-gradient-to-b from-rk-success-200/95 via-rk-success-200/90 to-rk-success-300/85 backdrop-blur-sm overflow-hidden">
      <RakudaFloatingBackdrop variant="stamp" />
      <div
        className="relative z-10 bg-rk-white rounded-xl shadow-sm w-full max-w-md border border-rk-slate-200 flex flex-col max-h-[95vh] overflow-hidden"
        style={{ borderColor: `color-mix(in srgb, ${stampColor} 27%, transparent)` }}
      >
        <div className="p-4 pb-2 flex flex-col items-center bg-gradient-to-b from-rk-success-100 to-rk-success-100 relative border-b border-rk-success-300/90">
          <div className="flex items-center justify-between w-full mb-2">
            <button
              onClick={() => changeMonth(-1)}
              className="w-10 h-10 flex items-center justify-center bg-rk-white rounded-xl shadow-sm text-rk-slate-700 border border-rk-slate-200 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="text-sm">{seasonalEmojis[month]}</div>
            <button
              onClick={() => changeMonth(1)}
              className="w-10 h-10 flex items-center justify-center bg-rk-white rounded-xl shadow-sm text-rk-slate-700 border border-rk-slate-200 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <h2 className="text-sm font-medium text-rk-slate-700 flex items-center gap-2">
            {year}年 {monthNames[month]} しゅっせき簿
          </h2>
          <p className="text-xs text-rk-slate-600 mt-1">
            ゲームを遊んでスタンプをあつめよう！
          </p>
          <p className="text-[10px] font-bold text-rk-slate-600 mt-2 leading-relaxed whitespace-pre-wrap text-center px-1">
            {PARENT_REASSURANCE.stampCard}
          </p>
        </div>

        <div className="p-4 pt-3 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 gap-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-black ${i === 0 ? 'text-rk-red-400' : i === 6 ? 'text-rk-blue-400' : 'text-rk-success-500'}`}>
                {d}
              </div>
            ))}
            {days.map((day, i) => {
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-xl border flex items-center justify-center relative overflow-hidden
                  ${day === null ? 'border-transparent' : 'border-rk-success-100 bg-rk-white shadow-sm'}
                `}
                >
                  {day && (
                    <>
                      <span className="absolute top-1 left-1.5 text-[10px] font-black text-rk-success-200">
                        {day}
                      </span>
                      {isCompleted(day) && (
                        <div
                          className={`w-[85%] h-[85%] border rounded-xl flex items-center justify-center rotate-[-10deg] relative
                          ${isSpecial(day) ? 'bg-rk-success-100/50' : ''}
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
              );
            })}
          </div>
        </div>

        <div className="p-4 pt-2 flex flex-col gap-3 bg-rk-success-100 border-t border-rk-success-300/90">
          {milestone ? (
            <div
              className={`rounded-xl border-2 px-3 py-2.5 text-center shadow-sm ${
                milestone.days >= 100
                  ? 'border-rk-amber-400/90 bg-gradient-to-b from-rk-amber-50 to-rk-white'
                  : 'border-rk-success-300/90 bg-rk-white/90'
              }`}
            >
              <p className="text-[13px] font-black text-rk-success-950">{milestone.title}</p>
              <p className="mt-1 text-[11px] font-bold leading-relaxed text-rk-slate-700">{milestone.body}</p>
            </div>
          ) : null}
          <div className="flex justify-center items-center gap-2 bg-rk-white/80 py-2 px-4 rounded-xl border border-rk-success-100">
            <span className="text-xs font-black text-rk-success-900">出席した日：</span>
            <span className="text-sm font-medium tabular-nums" style={{ color: stampColor }}>
              {totalStamps}
            </span>
            <span className="text-xs font-black text-rk-success-900">日</span>
          </div>
          <button
            onClick={onClose}
            className="w-full p-3 bg-rk-success-200 text-rk-slate-800 rounded-xl text-sm font-medium shadow-sm active:scale-95 transition-transform border border-rk-success-300"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
};

export default StampCard;
