import React from 'react';

interface KotobaLogoProps {
  className?: string;
  size?: number;
}

const KotobaLogo: React.FC<KotobaLogoProps> = ({ className, size = 32 }) => {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg 
        width="100%" height="100%" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"
        className="rounded-lg overflow-hidden"
      >
        {/* Background */}
        <rect width="512" height="512" fill="var(--rk-white)" />
        
        {/* Highlights */}
        <rect 
          x="1" y="14" 
          width="510" height="160" 
          fill="var(--rk-logo-band-coral)" 
          rx="45" 
        />
        
        <rect 
          x="256" y="256" 
          width="450" height="160" 
          fill="var(--rk-logo-band-mint)" 
          rx="45"
          transform="rotate(44.13, 256, 256) translate(-110, -80)" 
        />
        
        {/* Text Layer */}
        <g fontFamily='"M PLUS Rounded 1c", "Hiragino Sans", "Meiryo", sans-serif' fontWeight="700" textAnchor="middle" dominantBaseline="central">
          <text x="89" y="94" fontSize="143" fill="var(--rk-white)">こ</text>
          <text x="256" y="94" fontSize="143" fill="var(--rk-white)">と</text>
          <text x="423" y="94" fontSize="143" fill="var(--rk-white)">ば</text>
          
          <text x="89" y="256" fontSize="143" fill="var(--rk-slate-800)">ら</text>
          <text x="256" y="256" fontSize="143" fill="var(--rk-white)">探</text>
          <text x="423" y="256" fontSize="143" fill="var(--rk-slate-800)">☕</text>
          
          <text x="89" y="418" fontSize="143" fill="var(--rk-slate-800)">く</text>
          <text x="256" y="418" fontSize="143" fill="var(--rk-slate-800)">だ</text>
          <text x="423" y="418" fontSize="143" fill="var(--rk-white)">し</text>
        </g>
      </svg>
    </div>
  );
};

export default KotobaLogo;
