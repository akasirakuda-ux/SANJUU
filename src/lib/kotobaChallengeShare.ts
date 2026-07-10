import { getPublicUrl } from '../constants';
import type { GameState } from '../types';
import { inferPickupCharsetFromWord, normalizePickupCharset, type PickupCharset } from './hundredPickupCharset';

export type SamePuzzleChallengeInput = {
  categoryId: string;
  difficulty: number;
  actualSeed: number;
  isKatakana?: boolean;
  gameMode?: GameState['gameMode'] | 'pickup';
  targetWord?: string;
  boardCols?: number;
  boardRows?: number;
  pickupCharset?: PickupCharset | string | null;
};

function challengeBaseUrl(): string {
  const base = getPublicUrl();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${base}${path}${path.endsWith('/') ? '' : '/'}`;
}

/** ことば探し・ひと言探し — 同じお題を開く共有 URL（useUrlParams と対） */
export function buildSamePuzzleChallengeUrl(input: SamePuzzleChallengeInput): string | null {
  if (!Number.isFinite(input.actualSeed) || input.actualSeed < 0) return null;
  const params = new URLSearchParams();

  if (input.gameMode === 'pickup' || input.categoryId === 'pickup') {
    const word = String(input.targetWord ?? '').trim();
    if (!word) return null;
    const charset = normalizePickupCharset(
      input.pickupCharset ?? inferPickupCharsetFromWord(word) ?? 'hiragana',
    );
    params.set('c', 'pickup');
    params.set('m', 'pickup');
    params.set('w', word);
    params.set('d', String(input.difficulty));
    params.set('s', String(Math.floor(input.actualSeed)));
    if (charset !== 'hiragana') params.set('pc', charset);
    const cols = input.boardCols ?? input.difficulty;
    const rows = input.boardRows ?? input.difficulty;
    if (cols !== input.difficulty) params.set('cols', String(cols));
    if (rows !== input.difficulty) params.set('rows', String(rows));
  } else if (input.gameMode === 'search') {
    const word = String(input.targetWord ?? '').trim();
    if (!word) return null;
    params.set('c', 'search');
    params.set('m', 'search');
    params.set('w', word);
    params.set('d', String(input.difficulty));
    params.set('s', String(Math.floor(input.actualSeed)));
    if (input.isKatakana) params.set('k', '1');
  } else {
    const cat = String(input.categoryId ?? '').trim();
    if (!cat || cat === 'pickup' || cat === 'search') return null;
    params.set('c', cat);
    params.set('d', String(input.difficulty));
    params.set('s', String(Math.floor(input.actualSeed)));
    if (input.isKatakana) params.set('k', '1');
  }

  return `${challengeBaseUrl()}?${params.toString()}`;
}

export function buildSamePuzzleChallengeUrlFromGameState(
  gameState: GameState,
  gridCols: number,
  gridRows: number,
  opts?: { hundredPickup?: boolean },
): string | null {
  const cat = gameState.category?.category;
  if (!cat || gameState.actualSeed === undefined) return null;

  if (opts?.hundredPickup && cat === 'pickup') {
    const word = gameState.targetWord ?? '';
    return buildSamePuzzleChallengeUrl({
      categoryId: 'pickup',
      difficulty: gameState.difficulty,
      actualSeed: gameState.actualSeed,
      gameMode: 'pickup',
      targetWord: word,
      boardCols: gridCols,
      boardRows: gridRows,
      pickupCharset: inferPickupCharsetFromWord(word),
    });
  }

  if (opts?.hundredPickup) return null;

  return buildSamePuzzleChallengeUrl({
    categoryId: cat,
    difficulty: gameState.difficulty,
    actualSeed: gameState.actualSeed,
    isKatakana: gameState.isKatakana,
    gameMode: gameState.gameMode,
    targetWord: gameState.targetWord,
    boardCols: gridCols,
    boardRows: gridRows,
  });
}

export function adultChallengeShareText(challengeUrl: string): string {
  return [
    '1人でクリアしたよ。周りの大人はできるかな？',
    'らくだ珈琲で同じお題に挑戦してみて 🐪',
    challengeUrl,
  ].join('\n');
}

export async function copyAdultChallengeShareText(challengeUrl: string): Promise<boolean> {
  const value = adultChallengeShareText(challengeUrl);
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function adultChallengeShareToastMessage(ok: boolean): string {
  return ok ? 'コピーしたよ！周りの大人に見せてね' : 'コピーできませんでした。もう一度お試しください';
}
