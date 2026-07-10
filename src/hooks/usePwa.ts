import { useState } from 'react';

export const usePwa = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);

  // beforeinstallprompt は preventDefault すると DevTools に警告が出る。
  // カスタムの prompt() 導線（handleInstallClick）が UI に未配線のため、標準バナーに任せる。

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallGuideModal(true);
    }
  };

  return { 
    deferredPrompt, 
    handleInstallClick, 
    showInstallGuideModal, 
    setShowInstallGuideModal 
  };
};
