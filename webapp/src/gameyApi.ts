export type GameMode = 'human_vs_human' | 'human_vs_bot';

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GAMEY_API_URL}${path}`, init);
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (payload && typeof payload.message === 'string' && !('game_id' in payload)) {
    throw new Error((payload as ApiErrorResponse).message);
  }

  return payload as T;
}

export async function createGame(request: CreateGameRequest = {}): Promise<GameStateResponse> {
  const body = {
    size: request.size ?? 7,
    mode: request.mode ?? 'human_vs_bot',
    ...(request.bot_id ? { bot_id: request.bot_id } : {}),
  };

  return requestJson<GameStateResponse>('/v1/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getGame(gameId: string): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(`/v1/games/${gameId}`, {
    method: 'GET',
  });
}

export async function playMove(gameId: string, move: MoveRequest): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(`/v1/games/${gameId}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(move),
  });
}

export async function resignGame(gameId: string): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(`/v1/games/${gameId}/resign`, {
    method: 'POST',
  });
}
