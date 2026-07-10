import 'dart:async';

import '../config/puzzle_config.dart';

/// スクリーンセーバー型：操作でリセット、期限でコールバック
class IdleTimerService {
  IdleTimerService({Duration? idleDuration})
      : _idleDuration = idleDuration ?? PuzzleConfig.idleDuration;

  final Duration _idleDuration;
  Timer? _timer;
  void Function()? _onIdle;

  bool get isRunning => _timer?.isActive ?? false;

  void start({required void Function() onIdle}) {
    _onIdle = onIdle;
    _restart();
  }

  void resetActivity() {
    if (_onIdle == null) return;
    _restart();
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _onIdle = null;
  }

  void dispose() {
    stop();
  }

  void _restart() {
    _timer?.cancel();
    _timer = Timer(_idleDuration, () {
      _onIdle?.call();
    });
  }
}
