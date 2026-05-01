import { getRandomHiraganaChar } from '../utils/randomLetters';

export function createBoard(size: number, targetWord: string) {
  const s = Math.max(0, Math.floor(size || 0));
  const word = (targetWord || '').trim();

  const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  const board: string[][] = Array.from({ length: s }, () => Array.from({ length: s }, () => getRandomHiraganaChar()));

  if (s > 0 && word.length > 0) {
    const chars = Array.from(word);
    const dirs: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const [dx, dy] = rand(dirs);
    const maxX = dx === 1 ? s - chars.length : dx === -1 ? chars.length - 1 : s - 1;
    const minX = dx === -1 ? chars.length - 1 : 0;
    const maxY = dy === 1 ? s - chars.length : dy === -1 ? chars.length - 1 : s - 1;
    const minY = dy === -1 ? chars.length - 1 : 0;

    if (maxX >= minX && maxY >= minY) {
      const startX = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
      const startY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
      for (let i = 0; i < chars.length; i++) {
        const x = startX + dx * i;
        const y = startY + dy * i;
        if (board[y] && board[y][x] !== undefined) board[y][x] = chars[i];
      }
    }
  }

  return board;
}
