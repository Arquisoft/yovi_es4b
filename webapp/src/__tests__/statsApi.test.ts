import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchMatchHistory, fetchPlayerStats } from '../statsApi';

const fetchMock = vi.fn();
global.fetch = fetchMock as typeof fetch;

function responseJson(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function responseJsonFailure(ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockRejectedValue(new Error('invalid json')),
  } as unknown as Response;
}

describe('statsApi', () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  test('fetchPlayerStats requests the user header and normalizes missing fields', async () => {
    fetchMock.mockResolvedValue(responseJson({ totalGames: '4', victories: undefined, defeats: 2 }));

    const result = await fetchPlayerStats('  adri  ');

    expect(fetchMock).toHaveBeenCalledWith('/stats/v1/me', {
      headers: {
        'x-user-id': 'adri',
      },
    });
    expect(result).toEqual({
      totalGames: 4,
      victories: 0,
      defeats: 2,
      updatedAt: null,
    });
  });

  test('fetchMatchHistory maps defaults and uses the provided limit', async () => {
    fetchMock.mockResolvedValue(
      responseJson({
        items: [
          {
            gameId: 'g-1',
            result: 'loss',
            mode: 'online',
            winnerId: 'rival',
            botId: null,
            endedAt: '2026-03-01T10:00:00.000Z',
            finalBoard: {
              size: 3,
              turn: 4,
              players: ['B', 'R'],
              layout: 'B/R./...',
            },
          },
          {
            result: 'unexpected',
            finalBoard: {
              size: 3,
              turn: 1,
              players: [],
              layout: '',
            },
          },
        ],
      }),
    );

    const result = await fetchMatchHistory('adri', 5);

    expect(fetchMock).toHaveBeenCalledWith('/stats/v1/me/history?limit=5', {
      headers: {
        'x-user-id': 'adri',
      },
    });
    expect(result).toEqual([
      {
        gameId: 'g-1',
        result: 'loss',
        mode: 'online',
        winnerId: 'rival',
        botId: null,
        endedAt: '2026-03-01T10:00:00.000Z',
        finalBoard: {
          size: 3,
          turn: 4,
          players: ['B', 'R'],
          layout: 'B/R./...',
        },
      },
      {
        gameId: 'match-1',
        result: 'win',
        mode: null,
        winnerId: null,
        botId: null,
        endedAt: new Date(0).toISOString(),
        finalBoard: null,
      },
    ]);
  });

  test('fetchMatchHistory serializes history filters as query parameters', async () => {
    fetchMock.mockResolvedValue(responseJson({ items: [] }));

    await fetchMatchHistory('adri', {
      limit: 5,
      result: 'win',
      mode: 'human_vs_bot',
      bot: 'bot:greedy_bot',
      winner: 'you',
      dateSort: 'oldest_first',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/stats/v1/me/history?limit=5&result=win&mode=human_vs_bot&botId=greedy_bot&winner=you&sort=oldest_first',
      {
        headers: {
          'x-user-id': 'adri',
        },
      },
    );
  });

  test('fetchMatchHistory serializes empty bot and rival winner filters', async () => {
    fetchMock.mockResolvedValue(responseJson({ items: [] }));

    await fetchMatchHistory('adri', {
      bot: 'without_bot',
      winner: 'rival',
    });

    expect(fetchMock).toHaveBeenCalledWith('/stats/v1/me/history?limit=20&hasBot=false&winner=rival', {
      headers: {
        'x-user-id': 'adri',
      },
    });
  });

  test('uses backend error message when the stats request fails', async () => {
    fetchMock.mockResolvedValue(responseJson({ message: 'Stats offline' }, false, 503));

    await expect(fetchPlayerStats('adri')).rejects.toThrow('Stats offline');
  });

  test('falls back to the status code when the stats error response has no message', async () => {
    fetchMock.mockResolvedValue(responseJsonFailure(false, 500));

    await expect(fetchMatchHistory('adri')).rejects.toThrow('Request failed with status 500');
  });
});
