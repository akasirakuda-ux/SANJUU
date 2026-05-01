export type ClientToServer =
  | { t: 'join'; roomId: string; password: string }
  | { t: 'press'; n: number }
  | { t: 'ping'; ts: number };

export type ServerToClient =
  | { t: 'error'; code: string; message?: string }
  | { t: 'welcome'; roomId: string; you: { id: string }; full: { mask: number; ver: number } }
  | { t: 'diff'; n: number; v: 0 | 1; ver: number }
  | { t: 'pong'; ts: number; serverTs: number }
  | { t: 'roomCreated'; roomId: string; joinUrlPath: string };

export type CreateRoomRequest = { roomName?: string; password: string };
export type CreateRoomResponse = { roomId: string; joinUrlPath: string };

