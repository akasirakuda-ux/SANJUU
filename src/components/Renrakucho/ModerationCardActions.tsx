import React from 'react';

const btnYellow =
  'text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-amber-400 bg-rk-amber-50 text-rk-amber-950 hover:bg-rk-amber-100 disabled:opacity-40';
const btnRed =
  'text-[10px] font-bold px-2 py-1 rounded-lg border border-rk-rose-400 bg-rk-rose-50 text-rk-rose-900 hover:bg-rk-rose-100 disabled:opacity-40';

const ModerationCardActions: React.FC<{
  userId?: string;
  userName: string;
  disabled?: boolean;
  onIssueYellowCard: (userId: string, userName: string) => void | Promise<void>;
  onIssueRedCard: (userId: string, userName: string) => void | Promise<void>;
  compact?: boolean;
}> = ({ userId, userName, disabled, onIssueYellowCard, onIssueRedCard, compact = false }) => {
  if (!userId) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-1'}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onIssueYellowCard(userId, userName)}
        className={btnYellow}
        title="警告のみ。投稿はできます"
      >
        🟨 イエロー
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onIssueRedCard(userId, userName)}
        className={btnRed}
        title="らくだ珈琲の利用をすべて停止"
      >
        🟥 レッド
      </button>
    </div>
  );
};

export default ModerationCardActions;
