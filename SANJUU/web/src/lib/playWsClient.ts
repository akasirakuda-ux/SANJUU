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
  private session = 0;
  private hostKey?: string;

  constructor(opts: { url: string; roomId: number; hostKey?: string; handlers: Handlers }) {
    this.url = opts.url;
    this.roomId = opts.roomId;
    this.handlers = opts.handlers;
    this.hostKey = opts.hostKey;
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

  private openSocket(s: number) {
    if (this.closed || s !== this.session) return;
    const ws = new WebSocket(this.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      if (this.closed || s !== this.session) return;
      this.backoffMs = 250;
      this.handlers.onStatus?.({ connected: true });
      this.sendBytes(encodePlayJoin(this.roomId));
    };

    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      decodePlayFrames(ev.data, (m) => this.handlers.onMessage(m));
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

