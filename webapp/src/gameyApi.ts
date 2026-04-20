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

export type GameCompletionReason = 'win_condition' | 'resignation' | 'disconnect_timeout';

export interface MoveRequest {
  coords: Coordinates;
  player_token?: string;
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
  completion_reason?: GameCompletionReason | null;
  player0_user_id?: string | null;
  player1_user_id?: string | null;
  opponent_inactivity_timeout_remaining_ms?: number | null;
  turn_timeout_remaining_ms?: number | null;
}

interface ApiErrorResponse {
  message: string;
}

export type MatchmakingStatus = 'waiting' | 'matched' | 'cancelled';

export interface MatchmakingTicketResponse {
  api_version: string;
  ticket_id: string;
  status: MatchmakingStatus;
  poll_after_ms: number | null;
  position: number | null;
  game_id: string | null;
  player_id: number | null;
  player_token: string | null;
}

const GAMEY_API_URL = import.meta.env.VITE_GAMEY_API_URL ?? '/api';
const SAFE_API_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

function trimTrailingSlashes(value: string): string {
  let normalizedValue = value;

  while (normalizedValue.endsWith('/')) {
    normalizedValue = normalizedValue.slice(0, -1);
  }

  return normalizedValue;
}

const NORMALIZED_GAMEY_API_URL = trimTrailingSlashes(GAMEY_API_URL);

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

function withPlayerTokenHeader(
  baseHeaders: Record<string, string>,
  playerToken?: string,
): Record<string, string> {
  if (!playerToken || playerToken.trim().length === 0) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    'x-player-token': playerToken.trim(),
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

function buildApiUrl(path: string): string {
  return `${NORMALIZED_GAMEY_API_URL}${path}`;
}

function encodeApiPathSegment(value: string, label: string): string {
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0 || !SAFE_API_PATH_SEGMENT.test(normalizedValue)) {
    throw new Error(`${label} is invalid`);
  }

  return encodeURIComponent(normalizedValue);
}

function buildGameUrl(gameId: string, action?: 'moves' | 'resign' | 'pass'): string {
  const encodedGameId = encodeApiPathSegment(gameId, 'gameId');
  return buildApiUrl(`/v1/games/${encodedGameId}${action ? `/${action}` : ''}`);
}

function buildBotChooseUrl(botId: string): string {
  return buildApiUrl(`/v1/ybot/choose/${encodeApiPathSegment(botId, 'botId')}`);
}

function buildMatchmakingTicketUrl(ticketId: string, action?: 'cancel'): string {
  const encodedTicketId = encodeApiPathSegment(ticketId, 'ticketId');
  return buildApiUrl(`/v1/matchmaking/tickets/${encodedTicketId}${action ? `/${action}` : ''}`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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

  return requestJson<GameStateResponse>(buildApiUrl('/v1/games'), {
    method: 'POST',
    headers: withUserIdHeader({ 'Content-Type': 'application/json' }, userId),
    body: JSON.stringify(body),
  });
}

export async function getGame(
  gameId: string,
  userId?: string,
  playerToken?: string,
): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(buildGameUrl(gameId), {
    method: 'GET',
    headers: withPlayerTokenHeader(withUserIdHeader({}, userId), playerToken),
  });
}

export async function playMove(gameId: string, move: MoveRequest, userId?: string): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(buildGameUrl(gameId, 'moves'), {
    method: 'POST',
    headers: withUserIdHeader({ 'Content-Type': 'application/json' }, userId),
    body: JSON.stringify(move),
  });
}

export async function resignGame(
  gameId: string,
  userId?: string,
  playerToken?: string,
): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(buildGameUrl(gameId, 'resign'), {
    method: 'POST',
    headers: withPlayerTokenHeader(withUserIdHeader({}, userId), playerToken),
  });
}

export async function passTurnGame(
  gameId: string,
  userId?: string,
  playerToken?: string,
): Promise<GameStateResponse> {
  return requestJson<GameStateResponse>(buildGameUrl(gameId, 'pass'), {
    method: 'POST',
    headers: withPlayerTokenHeader(withUserIdHeader({}, userId), playerToken),
  });
}

export interface BotMoveResponse {
  api_version: string;
  bot_id: string;
  coords: Coordinates;
}

export async function getBotHint(
  yen: YEN,
  botId = 'minimax_bot',
): Promise<BotMoveResponse> {
  return requestJson<BotMoveResponse>(buildBotChooseUrl(botId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(yen),
  });
}

export async function enqueueMatchmaking(
  size = 7,
  userId?: string,
): Promise<MatchmakingTicketResponse> {
  return requestJson<MatchmakingTicketResponse>(buildApiUrl('/v1/matchmaking/enqueue'), {
    method: 'POST',
    headers: withUserIdHeader({ 'Content-Type': 'application/json' }, userId),
    body: JSON.stringify({ size }),
  });
}

export async function getMatchmakingTicket(ticketId: string): Promise<MatchmakingTicketResponse> {
  return requestJson<MatchmakingTicketResponse>(buildMatchmakingTicketUrl(ticketId), {
    method: 'GET',
  });
}

export async function cancelMatchmakingTicket(ticketId: string): Promise<MatchmakingTicketResponse> {
  return requestJson<MatchmakingTicketResponse>(buildMatchmakingTicketUrl(ticketId, 'cancel'), {
    method: 'POST',
  });
}
