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
        <rect width="512" height="512" fill="white" />
        
        {/* Highlights */}
        <rect 
          x="1" y="14" 
          width="510" height="160" 
          fill="#FF6B6B" 
          rx="45" 
        />
        
        <rect 
          x="256" y="256" 
          width="450" height="160" 
          fill="#4ECDC4" 
          rx="45"
          transform="rotate(44.13, 256, 256) translate(-110, -80)" 
        />
        
        {/* Text Layer */}
        <g fontFamily='"M PLUS Rounded 1c", "Hiragino Sans", "Meiryo", sans-serif' fontWeight="700" textAnchor="middle" dominantBaseline="central">
          <text x="89" y="94" fontSize="143" fill="white">こ</text>
          <text x="256" y="94" fontSize="143" fill="white">と</text>
          <text x="423" y="94" fontSize="143" fill="white">ば</text>
          
          <text x="89" y="256" fontSize="143" fill="#1E293B">ら</text>
          <text x="256" y="256" fontSize="143" fill="white">探</text>
          <text x="423" y="256" fontSize="143" fill="#1E293B">☕</text>
          
          <text x="89" y="418" fontSize="143" fill="#1E293B">く</text>
          <text x="256" y="418" fontSize="143" fill="#1E293B">だ</text>
          <text x="423" y="418" fontSize="143" fill="white">し</text>
        </g>
      </svg>
    </div>
  );
};

export default KotobaLogo;
