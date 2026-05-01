import {
  decodePlayFrames,
  encodePlayJoin,
  encodePlayPress,
  encodePlayReset,
  encodePlayReveal,
  encodePlaySetWord,
  encodePlayStart,
} from './playBinary';

import type { PlayDiff, PlayError, PlayFull } from './playBinary';

type Handlers = {
  onMessage: (m: PlayFull | PlayDiff | PlayError) => void;
  onStatus?: (s: { connected: boolean }) => void;
};

export class PlayWsClient {
  private ws?: WebSocket;
  private url: string;
  private roomId: number;
  private handlers: Handlers;
  private backoffMs = 250;
  private closed = false;
  private hostKey?: string;

  constructor(opts: { url: string; roomId: number; hostKey?: string; handlers: Handlers }) {
    this.url = opts.url;
    this.roomId = opts.roomId;
    this.handlers = opts.handlers;
    this.hostKey = opts.hostKey;
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

  press(idx: number) {
    this.sendBytes(encodePlayPress(idx));
  }

  startGame() {
    if (!this.hostKey) return;
    this.sendBytes(encodePlayStart(this.hostKey));
  }

  reveal() {
    if (!this.hostKey) return;
    this.sendBytes(encodePlayReveal(this.hostKey));
  }

  reset() {
    if (!this.hostKey) return;
    this.sendBytes(encodePlayReset(this.hostKey));
  }

  setWord(word: string) {
    if (!this.hostKey) return;
    this.sendBytes(encodePlaySetWord(this.hostKey, word));
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
      this.sendBytes(encodePlayJoin(this.roomId));
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      decodePlayFrames(ev.data, (m) => this.handlers.onMessage(m));
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

