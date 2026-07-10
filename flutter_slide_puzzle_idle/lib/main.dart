import 'package:flutter/material.dart';

import 'screens/puzzle_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SlidePuzzleIdleApp());
}

class SlidePuzzleIdleApp extends StatelessWidget {
  const SlidePuzzleIdleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Slide Puzzle Idle Mock',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2D6A4F)),
        useMaterial3: true,
      ),
      home: const PuzzleScreen(),
    );
  }
}
