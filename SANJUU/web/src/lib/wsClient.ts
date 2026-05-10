import { decodeServerFrames, encodeJoin, encodePress } from './binary';

type Handlers = {
  onMessage: (msg: Parameters<typeof decodeServerFrames>[1] extends (m: infer M) => void ? M : never) => void;
  onStatus?: (s: { connected: boolean }) => void;
  /** ブラウザが開けないときの切り分け用 */
  onTransportError?: (detail: string) => void;
};

export class SanjuuWsClient {
  private ws?: WebSocket;
  private url: string;
  private roomId: number;
  private handlers: Handlers;
  private backoffMs = 250;
  private closed = false;
  /** start/stop と古いソケットの onopen/onclose を切り離す */
  private session = 0;

  constructor(opts: { url: string; roomId: number; handlers: Handlers }) {
    this.url = opts.url;
    this.roomId = opts.roomId;
    this.handlers = opts.handlers;
  }

  start() {
    this.closed = false;
    this.session++;
    this.backoffMs = 250;
    const s = this.session;
    this.openSocket(s);
  }

  stop() {
    this.closed = true;
    this.session++;
    try {
      this.ws?.close();
    } catch {}
  }

  press(n: number) {
    this.sendBytes(encodePress(n));
  }

  private openSocket(s: number) {
    if (this.closed || s !== this.session) return;
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      if (this.closed || s !== this.session) return;
      this.backoffMs = 250;
      this.handlers.onStatus?.({ connected: true });
      this.sendBytes(encodeJoin(this.roomId));
    };

    ws.onerror = () => {
      if (this.closed || s !== this.session) return;
      this.handlers.onTransportError?.('WebSocket error (see DevTools Network → WS)');
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      decodeServerFrames(ev.data, (m) => this.handlers.onMessage(m));
    };

    ws.onclose = () => {
      if (s !== this.session) return;
      if (this.closed) return;
      this.handlers.onStatus?.({ connected: false });
      const wait = this.backoffMs;
      this.backoffMs = Math.min(5000, Math.floor(this.backoffMs * 1.6));
      window.setTimeout(() => this.openSocket(s), wait);
    };
  }

  private sendBytes(bytes: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(bytes);
  }
}

