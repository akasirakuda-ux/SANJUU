# スライドパズル × 放置検知 × モック広告（Flutter ローカルモック）

らくだ珈琲本番組み込み前の、PCローカル動作確認用 Flutter アプリです。

## 起動

```bash
cd flutter_slide_puzzle_idle
flutter pub get
flutter run -d windows
```

Chrome で試す場合: `flutter run -d chrome`

## 仕様メモ

| 項目 | 内容 |
|------|------|
| 盤面 | 5×5、右下（index 24）が空き |
| 画像 | `assets/images/rakuda_puzzle_01.png`（`PuzzleConfig.puzzleImageAsset`） |
| シャッフル | 完成形から合法手のみ100手逆方向 |
| 放置 | **Debug**: 20秒 / **Release**: 5分 → 3秒カウントダウン → 自動モード |
| 広告 | `MockVideoAdService`（後から AdMob に差替え） |
| インターバル | **Debug**: 15秒 / **Release**: 1分（暗転） |
| 完成 | 100手目でお祝い画面へ |

## ディレクトリ

- `lib/config/puzzle_config.dart` — 定数・画像パス
- `lib/services/puzzle_engine.dart` — シャッフル / 巻き戻し
- `lib/services/idle_timer_service.dart` — 5分放置タイマー
- `lib/services/ad_service.dart` — 広告抽象 + モック
- `lib/services/auto_play_controller.dart` — 広告ループ
- `lib/screens/puzzle_screen.dart` — メイン UI

## テスト

```bash
flutter test
```

## 次フェーズ（らくだ珈琲組み込み）

- WebView / PWA への埋め込み、または既存 `SlidePuzzleGame.tsx` との仕様すり合わせ
- AdMob 本番 SDK を `VideoAdService` 実装に差し替え
