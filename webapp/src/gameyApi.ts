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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isObject(payload) || typeof payload.message !== 'string') {
    return null;
  }

  return payload.message;
}

function isMessageOnlyPayload(payload: unknown): payload is ApiErrorResponse {
  return isObject(payload) && typeof payload.message === 'string' && !('game_id' in payload);
}

function withUserIdHeader(baseHeaders: Record<string, string>, userId?: string): Record<string, string> {
  if (!userId || userId.trim().length === 0) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    'x-user-id': userId.trim(),
  };
}

function parseResponsePayload(response: Response, raw: string, url: string): unknown {
  if (raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status} (${response.statusText}) at ${url}`);
    }

    throw new Error(`Invalid JSON response from ${url}`);
  }
}

function throwIfResponseFailed(response: Response, raw: string, payload: unknown): void {
  if (response.ok) {
    return;
  }

  const message = extractErrorMessage(payload) ?? (raw.trim().length > 0 ? raw : `Request failed with status ${response.status}`);
  throw new Error(message);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${GAMEY_API_URL}${path}`;
  const response = await fetch(url, init);
  const raw = await response.text();
  const payload = parseResponsePayload(response, raw, url);

  throwIfResponseFailed(response, raw, payload);

  if (!payload) {
    throw new Error(`Empty response body from ${url}`);
  }

  if (isMessageOnlyPayload(payload)) {
    throw new Error(payload.message);
  }

  return payload as T;
}

export async function createGame(
  request: CreateGameRequest = {},
  userId?: string
): Promise<GameStateResponse> {
  const body = {
    size: request.size ?? 7,
    mode: request.mode ?? 'human_vs_bot',
    ...(request.bot_id ? { bot_id: request.bot_id } : {}),
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
