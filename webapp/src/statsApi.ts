import type { FinalBoardSnapshot, MatchHistoryItem, PlayerStatsSummary } from './stats/types';

const STATS_API_URL = import.meta.env.VITE_STATS_API_URL ?? '/stats';

type StatsResponse = {
  totalGames?: number;
  victories?: number;
  defeats?: number;
  updatedAt?: string | null;
};

type StatsHistoryResponse = {
  items?: StatsHistoryItemResponse[];
};

type StatsHistoryItemResponse = {
  gameId?: string;
  result?: 'win' | 'loss';
  mode?: 'human_vs_bot' | 'human_vs_human' | null;
  winnerId?: string | null;
  botId?: string | null;
  endedAt?: string;
  finalBoard?: {
    size?: number;
    turn?: number;
    players?: unknown;
    layout?: string;
  } | null;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function normalizeFinalBoard(raw: StatsHistoryItemResponse['finalBoard']): FinalBoardSnapshot | null {
  if (!raw) {
    return null;
  }

  const hasValidSize = Number.isInteger(raw.size) && Number(raw.size) > 0;
  const hasValidTurn = Number.isInteger(raw.turn) && Number(raw.turn) >= 0;
  if (
    !hasValidSize ||
    !hasValidTurn ||
    typeof raw.layout !== 'string' ||
    raw.layout.length === 0 ||
    !isStringArray(raw.players) ||
    raw.players.length === 0
  ) {
    return null;
  }

  return {
    size: Number(raw.size),
    turn: Number(raw.turn),
    players: raw.players,
    layout: raw.layout,
  };
}

function buildHeaders(userId: string): HeadersInit {
  return {
    'x-user-id': userId.trim(),
  };
}

async function requestJson<T>(path: string, userId: string): Promise<T> {
  const response = await fetch(`${STATS_API_URL}${path}`, {
    headers: buildHeaders(userId),
  });

  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchPlayerStats(userId: string): Promise<PlayerStatsSummary> {
  const payload = await requestJson<StatsResponse>('/v1/me', userId);

  return {
    totalGames: Number(payload.totalGames ?? 0),
    victories: Number(payload.victories ?? 0),
    defeats: Number(payload.defeats ?? 0),
    updatedAt: payload.updatedAt ?? null,
  };
}

export async function fetchMatchHistory(userId: string, limit = 20): Promise<MatchHistoryItem[]> {
  const payload = await requestJson<StatsHistoryResponse>(`/v1/me/history?limit=${limit}`, userId);

  return (payload.items ?? []).map((item, index) => ({
    gameId: item.gameId ?? `match-${index}`,
    result: item.result === 'loss' ? 'loss' : 'win',
    mode: item.mode ?? null,
    winnerId: item.winnerId ?? null,
    botId: item.botId ?? null,
    endedAt: item.endedAt ?? new Date(0).toISOString(),
    finalBoard: normalizeFinalBoard(item.finalBoard),
  }));
}
