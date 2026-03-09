import type { MatchHistoryItem, PlayerStatsSummary } from './stats/types';

const STATS_API_URL = import.meta.env.VITE_STATS_API_URL ?? '/stats';

type StatsResponse = {
  totalGames?: number;
  victories?: number;
  defeats?: number;
  updatedAt?: string | null;
};

type StatsHistoryResponse = {
  items?: Array<{
    gameId?: string;
    result?: 'win' | 'loss';
    mode?: 'human_vs_bot' | 'human_vs_human' | null;
    winnerId?: string | null;
    botId?: string | null;
    endedAt?: string;
  }>;
};

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
  }));
}
