import 'dart:async';

import 'package:flutter/material.dart';

import '../config/puzzle_config.dart';
import '../models/slide_puzzle_state.dart';
import '../services/ad_service.dart';
import '../services/auto_play_controller.dart';
import '../services/idle_timer_service.dart';
import '../services/puzzle_engine.dart';
import '../widgets/overlays.dart';
import '../widgets/puzzle_board.dart';
import 'celebration_screen.dart';

class PuzzleScreen extends StatefulWidget {
  const PuzzleScreen({super.key});

  @override
  State<PuzzleScreen> createState() => _PuzzleScreenState();
}

class _PuzzleScreenState extends State<PuzzleScreen> {
  late SlidePuzzleState _puzzle;
  AppMode _mode = AppMode.normal;
  AutoPlayPhase _autoPhase = AutoPlayPhase.showingAd;
  int _countdownLeft = PuzzleConfig.countdownDuration.inSeconds;
  int _intervalLeft = 0;

  final IdleTimerService _idleTimer = IdleTimerService();
  final VideoAdService _adService = MockVideoAdService();
  AutoPlayController? _autoPlay;

  Timer? _countdownTimer;
  Timer? _intervalUiTimer;

  @override
  void initState() {
    super.initState();
    _puzzle = SlidePuzzleState.initial();
    _startIdleTimer();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _intervalUiTimer?.cancel();
    _idleTimer.dispose();
    _autoPlay?.dispose();
    super.dispose();
  }

  void _startIdleTimer() {
    _idleTimer.start(onIdle: _beginIdleCountdown);
  }

  void _onUserActivity() {
    if (_mode == AppMode.normal) {
      _idleTimer.resetActivity();
    } else if (_mode == AppMode.idleCountdown) {
      _countdownTimer?.cancel();
      setState(() => _mode = AppMode.normal);
      _startIdleTimer();
    } else if (_mode == AppMode.autoPlay) {
      _autoPlay?.requestExitToNormal();
    }
  }

  void _beginIdleCountdown() {
    if (!mounted || _mode != AppMode.normal) return;
    setState(() {
      _mode = AppMode.idleCountdown;
      _countdownLeft = PuzzleConfig.countdownDuration.inSeconds;
    });
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_countdownLeft <= 1) {
        timer.cancel();
        _enterAutoPlayMode();
        return;
      }
      setState(() => _countdownLeft -= 1);
    });
  }

  void _enterAutoPlayMode() {
    _idleTimer.stop();
    setState(() => _mode = AppMode.autoPlay);

    _autoPlay?.dispose();
    _autoPlay = AutoPlayController(
      adService: _adService,
      onPhaseChanged: _onAutoPhaseChanged,
      onPuzzleStep: _performAutoSlideStep,
      onCompleted: _onPuzzleFullyCompleted,
      onExitToNormal: _returnToNormalMode,
    );
    unawaited(_autoPlay!.start());
  }

  void _onAutoPhaseChanged(AutoPlayPhase phase) {
    if (!mounted) return;
    setState(() => _autoPhase = phase);
    if (phase == AutoPlayPhase.interval) {
      _startIntervalUiTimer();
    } else {
      _intervalUiTimer?.cancel();
    }
  }

  void _startIntervalUiTimer() {
    _intervalUiTimer?.cancel();
    _intervalLeft = PuzzleConfig.adIntervalDuration.inSeconds;
    _intervalUiTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _autoPhase != AutoPlayPhase.interval) {
        timer.cancel();
        return;
      }
      if (_intervalLeft <= 1) {
        timer.cancel();
        setState(() => _intervalLeft = 0);
        return;
      }
      setState(() => _intervalLeft -= 1);
    });
  }

  Future<bool> _performAutoSlideStep() async {
    if (_puzzle.resolvedStep >= _puzzle.totalSteps) return _puzzle.isSolved;

    await Future<void>.delayed(PuzzleConfig.slideAnimationDuration);
    if (!mounted) return false;

    setState(() {
      _puzzle = _puzzle.applyOneUndoStep();
    });

    await Future<void>.delayed(PuzzleConfig.slideAnimationDuration);
    if (!mounted) return false;

    return _puzzle.isSolved;
  }

  void _onPuzzleFullyCompleted() {
    if (!mounted) return;
    _autoPlay?.dispose();
    _autoPlay = null;
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const CelebrationScreen()),
    );
  }

  void _returnToNormalMode() {
    if (!mounted) return;
    _intervalUiTimer?.cancel();
    _autoPlay?.dispose();
    _autoPlay = null;
    setState(() {
      _mode = AppMode.normal;
      _autoPhase = AutoPlayPhase.showingAd;
    });
    _startIdleTimer();
  }

  void _onManualTileTap(int fromIndex) {
    _onUserActivity();
    if (_mode != AppMode.normal) return;
    if (!PuzzleEngine.canSlide(_puzzle.board, fromIndex)) return;
    setState(() {
      final nextBoard = PuzzleEngine.slide(_puzzle.board, fromIndex);
      _puzzle = _puzzle.copyWith(board: nextBoard);
    });
  }

  @override
  Widget build(BuildContext context) {
    final progress = _puzzle.resolvedStep;
    final total = _puzzle.totalSteps;

    return Listener(
      onPointerDown: (_) => _onUserActivity(),
      onPointerSignal: (_) => _onUserActivity(),
      child: Scaffold(
        backgroundColor: const Color(0xFFD8F3DC),
        appBar: AppBar(
          title: const Text('スライドパズル（モック）'),
          backgroundColor: const Color(0xFF2D6A4F),
          foregroundColor: Colors.white,
        ),
        body: Stack(
          fit: StackFit.expand,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    _mode == AppMode.autoPlay
                        ? '自動進行中 $progress / $total 手'
                        : 'タップでタイマーリセット（放置 ${PuzzleConfig.idleDuration.inMinutes > 0 ? "${PuzzleConfig.idleDuration.inMinutes}分" : "${PuzzleConfig.idleDuration.inSeconds}秒"}）',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1B4332),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: PuzzleBoard(
                          board: _puzzle.board,
                          onTileTap: _mode == AppMode.normal ? _onManualTileTap : null,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_mode == AppMode.idleCountdown)
              CountdownOverlay(secondsLeft: _countdownLeft),
            if (_mode == AppMode.autoPlay && _autoPhase == AutoPlayPhase.showingAd)
              const AdOverlay(phaseLabel: '動画広告再生中'),
            if (_mode == AppMode.autoPlay && _autoPhase == AutoPlayPhase.sliding)
              Container(
                color: Colors.black38,
                alignment: Alignment.bottomCenter,
                padding: const EdgeInsets.all(24),
                child: const Text(
                  'カシャッ… 1手進みました',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            if (_mode == AppMode.autoPlay && _autoPhase == AutoPlayPhase.interval)
              DimIntervalOverlay(secondsRemaining: _intervalLeft),
          ],
        ),
      ),
    );
  }
}
