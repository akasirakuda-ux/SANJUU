
import React, { useEffect, useState } from 'react';

/** 浮遊パーツで使う文字・絵文字（トップ等で共有） */
export const FLOATING_CHAR_POOL = [
  'こ',
  'と',
  'ば',
  '探',
  'し',
  '🐫',
  '☕',
  '🫖',
  '🍵',
  '🧋',
  '🍰',
  '🌭',
  '🍟',
  '🍔',
  '🥖',
  '🍩',
  '📝',
  '✏️',
  '📒',
] as const;

interface FloatingCharProps {
  colorClass?: string;
  /** ベースフォントサイズの倍率（例: 1.5 で約 5 割増し） */
  sizeScale?: number;
}

const FloatingChar: React.FC<FloatingCharProps> = ({ colorClass = "text-emerald-950/95", sizeScale = 1 }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [char, setChar] = useState('');
  const [swayDuration, setSwayDuration] = useState('3s');
  
  useEffect(() => {
    const randomChar = FLOATING_CHAR_POOL[Math.floor(Math.random() * FLOATING_CHAR_POOL.length)];
    const left = Math.random() * 100;
    const duration = 15 + Math.random() * 25; // Slower ascent for more elegance
    const delay = Math.random() * 20;
    const baseSize = 30 + Math.random() * 60; // 既定レンジ
    const size = baseSize * sizeScale;
    const swayTime = 4 + Math.random() * 4;
    
    setChar(randomChar);
    setSwayDuration(`${swayTime}s`);
    setStyle({
      left: `${left}%`,
      top: '100%', 
      animationDuration: `${duration}s`,
      animationDelay: `-${delay}s`,
      fontSize: `${size}px`,
      fontFamily: '"M PLUS Rounded 1c", sans-serif',
    });
  }, [sizeScale]);

  return (
    <div 
      className={`absolute ${colorClass} select-none pointer-events-none animate-bubble font-black -z-10`}
      style={style}
    >
      <div className="animate-sway" style={{ animationDuration: swayDuration }}>
        {char}
      </div>
    </div>
  );
};

export default FloatingChar;
