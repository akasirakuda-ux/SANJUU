import 'package:flutter/material.dart';

import '../config/puzzle_config.dart';
import '../services/puzzle_engine.dart';

/// 1枚画像を 5×5 に Clip して表示（右下は空きマス）
class PuzzleBoard extends StatelessWidget {
  const PuzzleBoard({
    super.key,
    required this.board,
    this.onTileTap,
    this.highlightEmpty = true,
  });

  final List<int> board;
  final void Function(int fromIndex)? onTileTap;
  final bool highlightEmpty;

  @override
  Widget build(BuildContext context) {
    final gridSize = PuzzleConfig.gridSize;
    return AspectRatio(
      aspectRatio: 1,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final side = constraints.maxWidth;
          final cell = side / gridSize;
          return Stack(
            children: [
              for (var cellIndex = 0; cellIndex < board.length; cellIndex++)
                _PuzzleTile(
                  board: board,
                  cellIndex: cellIndex,
                  cellSize: cell,
                  gridSize: gridSize,
                  highlightEmpty: highlightEmpty,
                  onTap: onTileTap,
                ),
            ],
          );
        },
      ),
    );
  }
}

class _PuzzleTile extends StatelessWidget {
  const _PuzzleTile({
    required this.board,
    required this.cellIndex,
    required this.cellSize,
    required this.gridSize,
    required this.highlightEmpty,
    this.onTap,
  });

  final List<int> board;
  final int cellIndex;
  final double cellSize;
  final int gridSize;
  final bool highlightEmpty;
  final void Function(int fromIndex)? onTap;

  @override
  Widget build(BuildContext context) {
    final row = cellIndex ~/ gridSize;
    final col = cellIndex % gridSize;
    final tileId = board[cellIndex];
    final isEmpty = tileId == PuzzleEngine.emptyTileId;

    return Positioned(
      left: col * cellSize,
      top: row * cellSize,
      width: cellSize,
      height: cellSize,
      child: GestureDetector(
        onTap: isEmpty || onTap == null ? null : () => onTap!(cellIndex),
        child: AnimatedContainer(
          duration: PuzzleConfig.slideAnimationDuration,
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black26, width: 1.2),
            color: isEmpty
                ? (highlightEmpty ? Colors.grey.shade300 : Colors.transparent)
                : Colors.white,
          ),
          clipBehavior: Clip.hardEdge,
          child: isEmpty
              ? null
              : _TileImage(tileId: tileId, gridSize: gridSize),
        ),
      ),
    );
  }
}

class _TileImage extends StatelessWidget {
  const _TileImage({
    required this.tileId,
    required this.gridSize,
  });

  final int tileId;
  final int gridSize;

  @override
  Widget build(BuildContext context) {
    final pos = PuzzleEngine.tilePosition(tileId);
    return ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        clipBehavior: Clip.hardEdge,
        child: SizedBox(
          width: 400,
          height: 400,
          child: Stack(
            children: [
              Positioned(
                left: -pos.col * (400 / gridSize),
                top: -pos.row * (400 / gridSize),
                width: 400,
                height: 400,
                child: Image.asset(
                  PuzzleConfig.puzzleImageAsset,
                  fit: BoxFit.cover,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
