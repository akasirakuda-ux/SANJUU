# SANJUU (MVP)

30人＝1クラスを前提にしたリアルタイム集団パズルのMVPです。Firebase は使用しません。

## 構成

- `web/`: Next.js + TypeScript（クライアント）
- `ws/`: WebSocketサーバー（Node.js, メモリ上のみで状態管理）

## 開発起動

```bash
cd SANJUU
npm install
npm run dev
```

- Web: `http://localhost:3000`
- WebSocket: `ws://localhost:8080/ws`

## 負荷テスト（ダミークライアント）

```bash
cd SANJUU
npm run loadtest -- --rooms 100 --clientsPerRoom 30 --durationSec 60
```

