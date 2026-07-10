import 'dart:math';

import '../config/puzzle_config.dart';

class ShuffledPuzzle {
  const ShuffledPuzzle({
    required this.board,
    required this.undoMoves,
  });

  final List<int> board;
  final List<int> undoMoves;
}

/// 5×5 スライドパズルの生成・合法手・100手逆シャッフル
class PuzzleEngine {
  PuzzleEngine._();

  static int get gridSize => PuzzleConfig.gridSize;
  static int get tileCount => gridSize * gridSize;
  static int get emptyTileId => tileCount - 1;

  static List<int> createSolvedBoard() {
    return List<int>.generate(tileCount, (index) => index);
  }

  static bool isSolved(List<int> board) {
    if (board.length != tileCount) return false;
    for (var i = 0; i < tileCount; i++) {
      if (board[i] != i) return false;
    }
    return true;
  }

  static int findEmptyIndex(List<int> board) {
    return board.indexOf(emptyTileId);
  }

  static List<int> neighborIndices(int index) {
    final row = index ~/ gridSize;
    final col = index % gridSize;
    final neighbors = <int>[];
    if (col > 0) neighbors.add(index - 1);
    if (col < gridSize - 1) neighbors.add(index + 1);
    if (row > 0) neighbors.add(index - gridSize);
    if (row < gridSize - 1) neighbors.add(index + gridSize);
    return neighbors;
  }

  static bool canSlide(List<int> board, int fromIndex) {
    final emptyIndex = findEmptyIndex(board);
    if (emptyIndex < 0) return false;
    return neighborIndices(emptyIndex).contains(fromIndex);
  }

  static List<int> slide(List<int> board, int fromIndex) {
    if (!canSlide(board, fromIndex)) {
      throw ArgumentError('illegal slide from $fromIndex');
    }
    final next = List<int>.from(board);
    final emptyIndex = findEmptyIndex(board);
    final tmp = next[fromIndex];
    next[fromIndex] = next[emptyIndex];
    next[emptyIndex] = tmp;
    return next;
  }

  /// 完成形から合法手のみを100手。各手の undo は「空きマスが移動前にあった index」
  static ShuffledPuzzle generateShuffled({
    int moveCount = PuzzleConfig.shuffleMoveCount,
    int? seed,
  }) {
    final random = Random(seed ?? DateTime.now().millisecondsSinceEpoch);
    var board = createSolvedBoard();
    var emptyIndex = findEmptyIndex(board);
    var previousEmpty = -1;
    final undoMoves = <int>[];

    for (var step = 0; step < moveCount; step++) {
      final candidates = neighborIndices(emptyIndex)
          .where((index) => index != previousEmpty)
          .toList();
      if (candidates.isEmpty) {
        candidates.addAll(neighborIndices(emptyIndex));
      }
      final picked = candidates[random.nextInt(candidates.length)];
      final emptyBefore = emptyIndex;
      board = slide(board, picked);
      undoMoves.add(emptyBefore);
      previousEmpty = emptyIndex;
      emptyIndex = picked;
    }

    return ShuffledPuzzle(board: board, undoMoves: undoMoves);
  }

  static List<int> applyUndoStep(List<int> board, int undoFromIndex) {
    return slide(board, undoFromIndex);
  }

  /// タイル ID からグリッド上の (row, col)
  static ({int row, int col}) tilePosition(int tileId) {
    return (row: tileId ~/ gridSize, col: tileId % gridSize);
  }
}
