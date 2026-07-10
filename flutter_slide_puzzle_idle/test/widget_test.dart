import 'package:flutter_test/flutter_test.dart';
import 'package:slide_puzzle_idle/main.dart';

void main() {
  testWidgets('アプリが起動する', (tester) async {
    await tester.pumpWidget(const SlidePuzzleIdleApp());
    expect(find.text('スライドパズル（モック）'), findsOneWidget);
  });
}
