import { useEffect } from 'react';
import { MASTER, isWordCategoryPaused } from '../constants';
import { hrefWithoutSearchParams } from '../lib/rakudaStreamMode';

export const useUrlParams = (
  isAuthReady: boolean,
  handleConfirmJoin: (rid: string) => void,
  handleJoinBoardGameRecruit: (kind: 'reversi' | 'gomoku', roomCode: string) => void,
  startSearchGame: any,
  startNewGame: any,
  startPickupSoloGame?: any,
) => {
  useEffect(() => {
    if (!isAuthReady) return;

    const checkParams = () => {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      const reversiParam = params.get('reversi');
      const gomokuParam = params.get('gomoku');
      const catParam = params.get('c');
      const diffParam = params.get('d');
      const seedParam = params.get('s');
      const modeParam = params.get('m');
      const wordParam = params.get('w');
      const katakanaParam = params.get('k');
      const pickupCharsetParam = params.get('pc');
      const colsParam = params.get('cols');
      const rowsParam = params.get('rows');

      if (reversiParam) {
        handleJoinBoardGameRecruit('reversi', reversiParam.trim().toUpperCase());
        window.history.replaceState({}, '', hrefWithoutSearchParams('reversi'));
      } else if (gomokuParam) {
        handleJoinBoardGameRecruit('gomoku', gomokuParam.trim().toUpperCase());
        window.history.replaceState({}, '', hrefWithoutSearchParams('gomoku'));
      } else if (roomParam) {
        handleConfirmJoin(roomParam.trim());
        window.history.replaceState({}, '', hrefWithoutSearchParams('room'));
      } else if (modeParam === 'pickup' && wordParam && seedParam && startPickupSoloGame) {
        const diff = diffParam ? parseInt(diffParam, 10) : 3;
        const seed = parseInt(seedParam, 10);
        const cols = colsParam ? parseInt(colsParam, 10) : undefined;
        const rows = rowsParam ? parseInt(rowsParam, 10) : undefined;
        if (Number.isFinite(seed) && Number.isFinite(diff)) {
          void startPickupSoloGame(
            wordParam,
            diff,
            seed,
            pickupCharsetParam,
            Number.isFinite(cols) ? cols : undefined,
            Number.isFinite(rows) ? rows : undefined,
          );
        }
        window.history.replaceState(
          {},
          '',
          hrefWithoutSearchParams('c', 'd', 's', 'm', 'w', 'k', 'pc', 'cols', 'rows'),
        );
      } else if (catParam && seedParam) {
        const diff = diffParam ? parseInt(diffParam) : 3;
        const isK = katakanaParam === '1';
        
        if (modeParam === 'search' && wordParam) {
          startSearchGame(wordParam, diff, 20, parseInt(seedParam), isK);
        } else {
          const cat = MASTER.categories.find(c => c.category === catParam);
          if (cat && !isWordCategoryPaused(cat.category)) {
            startNewGame(cat, parseInt(seedParam), diff, isK);
          }
        }
        window.history.replaceState(
          {},
          '',
          hrefWithoutSearchParams('c', 'd', 's', 'm', 'w', 'k'),
        );
      }
    };

    checkParams();
    window.addEventListener('popstate', checkParams);
    return () => window.removeEventListener('popstate', checkParams);
  }, [isAuthReady, handleConfirmJoin, handleJoinBoardGameRecruit, startNewGame, startSearchGame, startPickupSoloGame]);
};
