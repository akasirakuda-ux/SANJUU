import { useEffect } from 'react';
import { MASTER } from '../constants';

export const useUrlParams = (
  isAuthReady: boolean,
  handleConfirmJoin: (rid: string) => void,
  startSearchGame: any,
  startNewGame: any
) => {
  useEffect(() => {
    if (!isAuthReady) return;

    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      const catParam = params.get('c');
      const diffParam = params.get('d');
      const seedParam = params.get('s');
      const modeParam = params.get('m');
      const wordParam = params.get('w');
      const katakanaParam = params.get('k');

      if (roomParam) {
        handleConfirmJoin(roomParam.trim());
        window.history.replaceState({}, '', window.location.pathname);
      } else if (catParam && seedParam) {
        const diff = diffParam ? parseInt(diffParam) : 3;
        const isK = katakanaParam === '1';
        
        if (modeParam === 'search' && wordParam) {
          startSearchGame(wordParam, diff, 20, parseInt(seedParam), isK);
        } else {
          const cat = MASTER.categories.find(c => c.category === catParam);
          if (cat) {
            startNewGame(cat, parseInt(seedParam), diff, isK);
          }
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    checkParams();
    window.addEventListener('popstate', checkParams);
    return () => window.removeEventListener('popstate', checkParams);
  }, [isAuthReady, handleConfirmJoin, startNewGame, startSearchGame]);
};
