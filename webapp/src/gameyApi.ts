// A broader set of values used by the UI.  The server only understands
// `human_vs_human` or `human_vs_bot` but we expose additional choices so the
// user can pick a difficulty.  `useGamey` will translate these into the
// appropriate payload (mode + optional bot_id) when calling the API.
export type GameMode =
  | 'human_vs_human'
  | 'human_vs_bot'          // legacy/default "very easy" random bot
  | 'bot_muy_facil'         // random bot (same as human_vs_bot)
  | 'bot_facil'             // biased_random bot
  | 'bot_medio'             // greedy bot
  | 'bot_dificil';          // minimax bot


export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface YEN {
  size: number;
  turn: number;
  players: string[];
  layout: string;
}

export interface CreateGameRequest {
  size?: number;
  mode?: GameMode;
  bot_id?: string;
}

export interface MoveRequest {
  coords: Coordinates;
}

export interface GameStateResponse {
  api_version: string;
  game_id: string;
  mode: GameMode;
  bot_id: string | null;
  yen: YEN;
  game_over: boolean;
  next_player: number | null;
  winner: number | null;
}

interface ApiErrorResponse {
  message: string;
}

const GAMEY_API_URL = import.meta.env.VITE_GAMEY_API_URL ?? '/api';

function withUserIdHeader(baseHeaders: Record<string, string>, userId?: string): Record<string, string> {
  if (!userId || userId.trim().length === 0) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    'x-user-id': userId.trim(),
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${GAMEY_API_URL}${path}`;
  const response = await fetch(url, init);
  const raw = await response.text();
  let payload: unknown = null;

  if (raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status} (${response.statusText}) at ${url}`,
        );
      }
      throw new Error(`Invalid JSON response from ${url}`);
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : raw.trim().length > 0
          ? raw
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error(`Empty response body from ${url}`);
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string' &&
    !('game_id' in payload)
  ) {
    throw new Error((payload as ApiErrorResponse).message);
  }

  return payload as T;
}

export async function createGame(request: CreateGameRequest = {}): Promise<GameStateResponse> {
  // convert our UI-oriented mode values into what the backend expects.
  let apiMode: 'human_vs_human' | 'human_vs_bot' = 'human_vs_bot';
  let botId: string | undefined = request.bot_id;

  switch (request.mode) {
    case 'human_vs_human':
      apiMode = 'human_vs_human';
      break;
    case 'human_vs_bot':
      apiMode = 'human_vs_bot';
      break;
    case 'bot_muy_facil':
      apiMode = 'human_vs_bot';
      botId = 'random_bot';
      break;
    case 'bot_facil':
      apiMode = 'human_vs_bot';
      botId = 'biased_random_bot';
      break;
    case 'bot_medio':
      apiMode = 'human_vs_bot';
      botId = 'greedy_bot';
      break;
    case 'bot_dificil':
      apiMode = 'human_vs_bot';
      botId = 'minimax_bot';
      break;
    default:
      if (request.mode) {
        // unknown but preserve value, server will error if invalid
        apiMode = request.mode as 'human_vs_bot';
      }
      break;
  }

  const body: any = {
    size: request.size ?? 7,
    mode: apiMode,
    ...(botId ? { bot_id: botId } : {}),
  };

  return requestJson<GameStateResponse>('/v1/games', {
    method: 'POST',
    headers: withUserIdHeader({ 'Content-Type': 'application/json' }, userId),
    body: JSON.stringify(body),
  });
}

export async function getGame(gameId: string): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(`/v1/games/${gameId}`, {
    method: 'GET',
  });
}

export async function playMove(gameId: string, move: MoveRequest, userId?: string): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(`/v1/games/${gameId}/moves`, {
    method: 'POST',
    headers: withUserIdHeader({ 'Content-Type': 'application/json' }, userId),
    body: JSON.stringify(move),
  });
}

export async function resignGame(gameId: string, userId?: string): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(`/v1/games/${gameId}/resign`, {
    method: 'POST',
    headers: withUserIdHeader({}, userId),
  });
}
