/** 待機室を画面に出さないとき、盤面側へ渡す状態・操作 */

export type HundredWaitHeadlessState = {
  betweenRounds: boolean;
  problemsGenerating: boolean;
  joinOk: boolean;
  joinError: string | null;
  joinRoomFull: boolean;
  joinStalled: boolean;
  isHost: boolean;
  status: string;
  boardTransitionBusy: boolean;
  roomBoardReady: boolean;
  canHostStart: boolean;
};

export type HundredWaitHeadlessController = {
  requestStart: () => void;
  retryJoin: () => void;
  cancelGeneration: () => void;
};

export const HUNDRED_WAIT_HEADLESS_IDLE: HundredWaitHeadlessState = {
  betweenRounds: false,
  problemsGenerating: false,
  joinOk: false,
  joinError: null,
  joinRoomFull: false,
  joinStalled: false,
  isHost: false,
  status: 'recruiting',
  boardTransitionBusy: false,
  roomBoardReady: false,
  canHostStart: false,
};
