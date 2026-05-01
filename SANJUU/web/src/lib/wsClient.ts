import { decodeServerFrames, encodeJoin, encodePress } from './binary';

type Handlers = {
  onMessage: (msg: Parameters<typeof decodeServerFrames>[1] extends (m: infer M) => void ? M : never) => void;
  onStatus?: (s: { connected: boolean }) => void;
};

export class SanjuuWsClient {
  private ws?: WebSocket;
  private url: string;
  private roomId: number;
  private handlers: Handlers;
  private backoffMs = 250;
  private closed = false;

  constructor(opts: { url: string; roomId: number; handlers: Handlers }) {
    this.url = opts.url;
    this.roomId = opts.roomId;
    this.handlers = opts.handlers;
  }

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {}
  }

  press(n: number) {
    this.sendBytes(encodePress(n));
  }

  private connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.handlers.onStatus?.({ connected: false });

    ws.onopen = () => {
      this.backoffMs = 250;
      this.handlers.onStatus?.({ connected: true });
      this.sendBytes(encodeJoin(this.roomId));
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      decodeServerFrames(ev.data, (m) => this.handlers.onMessage(m));
    };

    ws.onclose = () => {
      this.handlers.onStatus?.({ connected: false });
      if (this.closed) return;
      const wait = this.backoffMs;
      this.backoffMs = Math.min(5000, Math.floor(this.backoffMs * 1.6));
      window.setTimeout(() => this.connect(), wait);
    };
  }

  private sendBytes(bytes: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(bytes);
  }
}

