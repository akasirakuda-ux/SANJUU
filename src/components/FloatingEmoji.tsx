
import React, { useEffect, useState } from 'react';

interface FloatingEmojiProps {
  opacityClass?: string;
}

const FloatingEmoji: React.FC<FloatingEmojiProps> = ({ opacityClass = "opacity-20" }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [emoji, setEmoji] = useState('');
  const [swayDuration, setSwayDuration] = useState('3s');
  
  useEffect(() => {
    const emojis = ['🍰', '☕', '🫖', '🍵', '🍷', '🍹', '🧋', '🥃'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const left = Math.random() * 100;
    const duration = 15 + Math.random() * 25; 
    const delay = Math.random() * 20; 
    const size = 40 + Math.random() * 80; 
    const swayTime = 4 + Math.random() * 4; 
    
    setEmoji(randomEmoji);
    setSwayDuration(`${swayTime}s`);
    setStyle({
      left: `${left}%`,
      top: '100%', 
      animationDuration: `${duration}s`,
      animationDelay: `-${delay}s`,
      fontSize: `${size}px`,
    });
  }, []);

  return (
    <div 
      className={`absolute ${opacityClass} select-none pointer-events-none animate-bubble z-0`}
      style={style}
    >
      <div className="animate-sway" style={{ animationDuration: swayDuration }}>
        {emoji}
      </div>
    </div>
  );
};

export default FloatingEmoji;
