import React from 'react';

interface IconPreviewProps {
  onClick?: () => void;
}

const IconPreview: React.FC<IconPreviewProps> = ({ onClick }) => {
  // Specifications:
  // 1. Background: White rounded square
  // 2. Grid: 3x3
  // 3. Characters: R1: こ,と,ば | R2: ら,探,☕ | R3: く,だ,し
  // 4. Font: Rounded M+ (Bold/Black)
  // 5. Highlights: Red (#FF6B6B) horizontal Row 1, Green (#4ECDC4) diagonal center to bottom-right
  // 6. Colors: White under highlights, Dark Navy (#1E293B) otherwise

  const downloadSvg = () => {
    const svgElement = document.getElementById('icon-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = 'kotoba-sagashi-icon.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        onClick={onClick}
        className="w-48 h-48 rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-white flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform hover:shadow-emerald-200/50 hover:shadow-2xl"
      >
        <svg 
          id="icon-svg"
          width="100%" height="100%" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background */}
          <rect width="512" height="512" fill="white" />
          
          {/* Highlights (Layered behind text) */}
          {/* Red Band - Row 1 */}
          <rect 
            x="1" y="14" 
            width="510" height="160" 
            fill="#FF6B6B" 
            rx="45" 
          />
          
          {/* Green Band - Diagonal from '探' (256,256) to 'し' (423,418) */}
          <rect 
            x="256" y="256" 
            width="450" height="160" 
            fill="#4ECDC4" 
            rx="45"
            transform="rotate(44.13, 256, 256) translate(-110, -80)" 
          />
          
          {/* Text Layer */}
          <g fontFamily='"M PLUS Rounded 1c", "Hiragino Sans", "Meiryo", sans-serif' fontWeight="700" textAnchor="middle" dominantBaseline="central">
            {/* Row 1 - All White under Red Band */}
            <text x="89" y="94" fontSize="143" fill="white">こ</text>
            <text x="256" y="94" fontSize="143" fill="white">と</text>
            <text x="423" y="94" fontSize="143" fill="white">ば</text>
            
            {/* Row 2 */}
            <text x="89" y="256" fontSize="143" fill="#1E293B">ら</text>
            <text x="256" y="256" fontSize="143" fill="white">探</text> {/* Unified font size */}
            <text x="423" y="256" fontSize="143" fill="#1E293B">☕</text>
            
            {/* Row 3 */}
            <text x="89" y="418" fontSize="143" fill="#1E293B">く</text>
            <text x="256" y="418" fontSize="143" fill="#1E293B">だ</text>
            <text x="423" y="418" fontSize="143" fill="white">し</text> {/* White under green line */}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default IconPreview;
