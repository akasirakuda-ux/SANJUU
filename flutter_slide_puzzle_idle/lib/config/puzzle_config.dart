import 'package:flutter/foundation.dart';

/// パズル・放置・広告ループの定数（画像パスはここだけ変更）
class PuzzleConfig {
  PuzzleConfig._();

  static const String puzzleImageAsset = 'assets/images/rakuda_puzzle_01.png';
  static const int gridSize = 5;
  static const int shuffleMoveCount = 100;

  /// デバッグビルドではローカル確認用に短縮（リリースは仕様どおり）
  static Duration get idleDuration =>
      kDebugMode ? const Duration(seconds: 20) : const Duration(minutes: 5);

  static const Duration countdownDuration = Duration(seconds: 3);

  static Duration get adIntervalDuration =>
      kDebugMode ? const Duration(seconds: 15) : const Duration(minutes: 1);

  static Duration get mockAdDuration =>
      kDebugMode ? const Duration(seconds: 5) : const Duration(seconds: 10);

  static const Duration slideAnimationDuration = Duration(milliseconds: 300);
}
