import 'dart:async';

import '../config/puzzle_config.dart';
import '../models/slide_puzzle_state.dart';
import 'ad_service.dart';

/// 広告 → 1手スライド → インターバル のループ制御
class AutoPlayController {
  AutoPlayController({
    required VideoAdService adService,
    required this.onPhaseChanged,
    required this.onPuzzleStep,
    required this.onCompleted,
    required this.onExitToNormal,
  }) : _adService = adService;

  final VideoAdService _adService;
  final void Function(AutoPlayPhase phase) onPhaseChanged;
  final Future<bool> Function() onPuzzleStep;
  final void Function() onCompleted;
  final void Function() onExitToNormal;

  bool _running = false;
  bool _exitRequested = false;
  bool _disposed = false;

  AutoPlayPhase _phase = AutoPlayPhase.showingAd;
  AutoPlayPhase get phase => _phase;

  bool get isRunning => _running;

  Future<void> start() async {
    if (_disposed || _running) return;
    _running = true;
    _exitRequested = false;
    await _loop();
  }

  void requestExitToNormal() {
    _exitRequested = true;
  }

  void dispose() {
    _disposed = true;
    _running = false;
  }

  Future<void> _loop() async {
    while (_running && !_disposed) {
      if (_exitRequested) {
        _finish(exitNormal: true);
        return;
      }

      _setPhase(AutoPlayPhase.showingAd);
      await _adService.showVideoAd();
      if (!_running || _disposed) return;

      if (_exitRequested) {
        _finish(exitNormal: true);
        return;
      }

      _setPhase(AutoPlayPhase.sliding);
      final completed = await onPuzzleStep();
      if (!_running || _disposed) return;

      if (completed) {
        _finish(exitNormal: false, completed: true);
        return;
      }

      if (_exitRequested) {
        _finish(exitNormal: true);
        return;
      }

      _setPhase(AutoPlayPhase.interval);
      await Future<void>.delayed(PuzzleConfig.adIntervalDuration);
      if (!_running || _disposed) return;

      if (_exitRequested) {
        _finish(exitNormal: true);
        return;
      }
    }
  }

  void completePuzzle() {
    _finish(exitNormal: false, completed: true);
  }

  void _setPhase(AutoPlayPhase phase) {
    _phase = phase;
    onPhaseChanged(phase);
  }

  void _finish({required bool exitNormal, bool completed = false}) {
    _running = false;
    if (completed) {
      onCompleted();
    } else if (exitNormal) {
      onExitToNormal();
    }
  }
}
