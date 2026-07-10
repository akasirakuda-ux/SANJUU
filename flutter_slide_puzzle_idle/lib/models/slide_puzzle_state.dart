import '../config/puzzle_config.dart';
import '../services/puzzle_engine.dart';

/// 盤面 + 広告1本ごとに巻き戻す手順
class SlidePuzzleState {
  const SlidePuzzleState({
    required this.board,
    required this.undoMoves,
    this.resolvedStep = 0,
  });

  final List<int> board;
  final List<int> undoMoves;
  final int resolvedStep;

  int get gridSize => PuzzleConfig.gridSize;
  int get totalSteps => undoMoves.length;
  bool get isSolved => PuzzleEngine.isSolved(board);

  SlidePuzzleState copyWith({
    List<int>? board,
    List<int>? undoMoves,
    int? resolvedStep,
  }) {
    return SlidePuzzleState(
      board: board ?? List<int>.from(this.board),
      undoMoves: undoMoves ?? List<int>.from(this.undoMoves),
      resolvedStep: resolvedStep ?? this.resolvedStep,
    );
  }

  factory SlidePuzzleState.initial({int? seed}) {
    final generated = PuzzleEngine.generateShuffled(
      moveCount: PuzzleConfig.shuffleMoveCount,
      seed: seed,
    );
    return SlidePuzzleState(
      board: generated.board,
      undoMoves: generated.undoMoves,
    );
  }

  SlidePuzzleState applyOneUndoStep() {
    if (resolvedStep >= undoMoves.length) return this;
    final undoIndex = undoMoves.length - 1 - resolvedStep;
    final nextBoard = PuzzleEngine.applyUndoStep(board, undoMoves[undoIndex]);
    return copyWith(
      board: nextBoard,
      resolvedStep: resolvedStep + 1,
    );
  }
}

enum AppMode {
  normal,
  idleCountdown,
  autoPlay,
}

enum AutoPlayPhase {
  showingAd,
  sliding,
  interval,
}
