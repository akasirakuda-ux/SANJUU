import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatBoardDimensions, resolveBoardCols, resolveBoardRows } from './boardDimensions';
import { countPlacedWordOccurrences } from './hundredPickupOccurrences';

/** 三十・ひと言探しの1セッションを problems サブコレに記録（回答履歴・盤面サイズ） */
export async function archiveHundredSessionToProblemHistory(
  roomId: string,
  reason: 'timeout' | 'cleared',
): Promise<void> {
  if (!roomId) return;

  const roomSnap = await getDoc(doc(db, 'hundred_rooms', roomId));
  if (!roomSnap.exists()) return;
  const room = roomSnap.data() as Record<string, unknown>;

  const problemsSnap = await getDocs(
    query(collection(db, 'hundred_rooms', roomId, 'problems'), orderBy('order', 'desc'), limit(1)),
  );
  if (problemsSnap.empty) return;
  const problemRef = problemsSnap.docs[0].ref;

  const playersSnap = await getDocs(collection(db, 'hundred_rooms', roomId, 'players'));
  const answerHistory: string[] = [];
  playersSnap.forEach((playerDoc) => {
    const pd = playerDoc.data() as Record<string, unknown>;
    const name = typeof pd.name === 'string' ? pd.name.trim() || 'ななし' : 'ななし';
    const emoji = typeof pd.emoji === 'string' ? pd.emoji.trim() : '';
    const foundCount = typeof pd.foundCount === 'number' ? pd.foundCount : Number(pd.foundCount) || 0;
    answerHistory.push(`${emoji}${name}: ${foundCount}個`);
  });

  const targetWord = typeof room.targetWord === 'string' ? room.targetWord.trim() : '';
  const boardCols = resolveBoardCols({
    boardCols: room.boardCols as number | undefined,
    boardSize: room.boardSize as number | undefined,
  });
  const boardRows = resolveBoardRows({
    boardRows: room.boardRows as number | undefined,
    boardSize: room.boardSize as number | undefined,
  });
  const totalCount = countPlacedWordOccurrences(room.words);
  const boardLabel = formatBoardDimensions({ boardCols, boardRows, boardSize: boardCols });

  await updateDoc(problemRef, {
    isCorrect: reason === 'cleared' ? true : false,
    answerHistory,
    cleared: reason === 'cleared',
    endReason: reason,
    targetWord,
    boardCols,
    boardRows,
    boardLabel,
    totalCount,
    finishedAt: serverTimestamp(),
    title: targetWord
      ? `探しもの：「${targetWord}」${boardLabel}`
      : `探しもの ${boardLabel}`,
  });
}
