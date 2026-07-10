import React from 'react';

const TabBar: React.FC<{
  themeVariant?: 'default' | 'hundred';
  activeTab: 'main' | 'admin';
  setActiveTab: React.Dispatch<React.SetStateAction<'main' | 'admin'>>;
  isAdmin: boolean;
  unreadCount: number;
}> = ({ themeVariant = 'default', activeTab, setActiveTab, isAdmin, unreadCount }) => {
  if (!isAdmin) return null;

  const isHundred = themeVariant === 'hundred';
  const activeBorder = isHundred ? 'border-rk-red-600 text-rk-red-950' : 'border-rk-amber-200 text-rk-slate-700';
  const idle = isHundred ? 'border-transparent text-rk-red-800/80' : 'border-transparent text-rk-slate-600';

  return (
    <nav
      className={
        isHundred
          ? 'flex bg-rk-red-100 border-b border-rk-red-200'
          : 'flex bg-rk-amber-50 border-b border-rk-amber-200'
      }
    >
      <button
        type="button"
        onClick={() => setActiveTab('main')}
        className={`flex-1 p-3 font-medium text-sm transition-colors border-b-4 ${activeTab === 'main' ? activeBorder : idle}`}
      >
        メイン
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('admin')}
        className={`flex-1 p-3 font-medium text-sm transition-colors border-b-4 relative ${activeTab === 'admin' ? activeBorder : idle}`}
      >
        かんり
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[1.25rem] h-5 px-1 bg-rk-red-600 text-rk-white text-[10px] font-black rounded-lg flex items-center justify-center border-2 border-rk-red-800 shadow-md z-10 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
    </nav>
  );
};

export default TabBar;
