export type GameState = {
  actions?: Action[];
  phase: 'ready' | 'playing' | 'finished';
  lobbyStatus?: 'open' | 'closed';
  joinedPlayers?: string[];
  mode?: 'turn' | 'realtime';
  turn?: number;
  turnFinished?: boolean;
  maxTurns?: number;
  round?: number;
  maxRounds?: number;
  startedAt?: number;
  finishedAt?: number;
  needsBoardInit?: boolean;
  targetValue?: number;
  score?: Record<string, number>;
  players?: string[];
  currentTurnPlayer?: string;
  winner?: string | null;
  cursors?: Record<string, { r: number; c: number; ts: number }>;
  lastAction?: Record<string, { r: number; c: number; type: string; ts: number }>;
  spectators?: string[];
};

export type ActionType = 'reveal' | 'highlight' | 'lock' | 'select';

export type Action = {
  r: number;
  c: number;
  turn: number;
  type: ActionType;
  user?: string;
};

