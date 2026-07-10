import '../config/puzzle_config.dart';

/// 本番 AdMob 等に差し替えやすい動画広告の抽象
abstract class VideoAdService {
  Future<void> showVideoAd();
}

/// ローカルモック：指定秒数待って「広告終了」を返す
class MockVideoAdService implements VideoAdService {
  MockVideoAdService({Duration? duration})
      : _duration = duration ?? PuzzleConfig.mockAdDuration;

  final Duration _duration;

  @override
  Future<void> showVideoAd() async {
    await Future<void>.delayed(_duration);
  }
}
