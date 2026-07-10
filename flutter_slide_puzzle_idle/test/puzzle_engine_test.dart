import 'package:flutter_test/flutter_test.dart';
import 'package:slide_puzzle_idle/services/puzzle_engine.dart';

void main() {
  test('100手逆シャッフル後、undoを100回で完成する', () {
    final shuffled = PuzzleEngine.generateShuffled(moveCount: 100, seed: 42);
    var board = List<int>.from(shuffled.board);

    expect(PuzzleEngine.isSolved(board), isFalse);

    for (var i = shuffled.undoMoves.length - 1; i >= 0; i--) {
      board = PuzzleEngine.applyUndoStep(board, shuffled.undoMoves[i]);
    }

    expect(PuzzleEngine.isSolved(board), isTrue);
    expect(shuffled.undoMoves.length, 100);
  });

  test('右下(index24)は空きタイルID', () {
    final board = PuzzleEngine.createSolvedBoard();
    expect(board[24], PuzzleEngine.emptyTileId);
    expect(PuzzleEngine.tileCount, 25);
  });
}
