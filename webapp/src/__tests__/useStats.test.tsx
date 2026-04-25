import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { useStats } from '../useStats';
import { EMPTY_PLAYER_STATS } from '../stats/types';

const fetchPlayerStats = vi.fn();
const fetchMatchHistory = vi.fn();

vi.mock('../statsApi', () => ({
  fetchPlayerStats: (...args: unknown[]) => fetchPlayerStats(...args),
  fetchMatchHistory: (...args: unknown[]) => fetchMatchHistory(...args),
}));

function StatsProbe({ userId }: { userId?: string }) {
  const { playerStats, matches, loading, error, historyFilters, setHistoryFilters, refreshStats } = useStats(userId);

  return (
    <div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="error">{error ?? ''}</div>
      <div data-testid="total-games">{playerStats.totalGames}</div>
      <div data-testid="victories">{playerStats.victories}</div>
      <div data-testid="defeats">{playerStats.defeats}</div>
      <div data-testid="updated-at">{playerStats.updatedAt ?? ''}</div>
      <div data-testid="match-count">{matches.length}</div>
      <div data-testid="result-filter">{historyFilters.result}</div>
      <button
        type="button"
        onClick={() => setHistoryFilters({ ...historyFilters, result: 'win' })}
      >
        only wins
      </button>
      <button type="button" onClick={() => void refreshStats()}>refresh stats</button>
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useStats', () => {
  beforeEach(() => {
    fetchPlayerStats.mockReset();
    fetchMatchHistory.mockReset();
  });

  test('keeps empty defaults when user id is missing', () => {
    render(<StatsProbe />);

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toBeEmptyDOMElement();
    expect(screen.getByTestId('total-games')).toHaveTextContent(String(EMPTY_PLAYER_STATS.totalGames));
    expect(screen.getByTestId('victories')).toHaveTextContent(String(EMPTY_PLAYER_STATS.victories));
    expect(screen.getByTestId('defeats')).toHaveTextContent(String(EMPTY_PLAYER_STATS.defeats));
    expect(screen.getByTestId('updated-at')).toBeEmptyDOMElement();
    expect(screen.getByTestId('match-count')).toHaveTextContent('0');
    expect(fetchPlayerStats).not.toHaveBeenCalled();
    expect(fetchMatchHistory).not.toHaveBeenCalled();
  });

  test('loads stats and trims the user id before requesting data', async () => {
    fetchPlayerStats.mockResolvedValue({
      totalGames: 8,
      victories: 5,
      defeats: 3,
      updatedAt: '2026-03-01T10:00:00.000Z',
    });
    fetchMatchHistory.mockResolvedValue([
      {
        gameId: 'game-1',
        result: 'win',
        mode: 'human_vs_bot',
        winnerId: 'adri',
        botId: 'greedy_bot',
        endedAt: '2026-03-01T10:05:00.000Z',
      },
    ]);

    render(<StatsProbe userId="  adri  " />);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(fetchPlayerStats).toHaveBeenCalledWith('adri');
    expect(fetchMatchHistory).toHaveBeenCalledWith('adri');
    expect(screen.getByTestId('error')).toBeEmptyDOMElement();
    expect(screen.getByTestId('total-games')).toHaveTextContent('8');
    expect(screen.getByTestId('victories')).toHaveTextContent('5');
    expect(screen.getByTestId('defeats')).toHaveTextContent('3');
    expect(screen.getByTestId('updated-at')).toHaveTextContent('2026-03-01T10:00:00.000Z');
    expect(screen.getByTestId('match-count')).toHaveTextContent('1');
  });

  test('reloads history with Mongo-backed filters when filters change', async () => {
    fetchPlayerStats.mockResolvedValue({
      totalGames: 8,
      victories: 5,
      defeats: 3,
      updatedAt: '2026-03-01T10:00:00.000Z',
    });
    fetchMatchHistory
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          gameId: 'game-win',
          result: 'win',
          mode: 'human_vs_bot',
          winnerId: 'adri',
          botId: 'greedy_bot',
          endedAt: '2026-03-01T10:05:00.000Z',
        },
      ]);

    render(<StatsProbe userId="adri" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: /only wins/i }));

    await waitFor(() => {
      expect(screen.getByTestId('result-filter')).toHaveTextContent('win');
      expect(screen.getByTestId('match-count')).toHaveTextContent('1');
    });

    expect(fetchMatchHistory).toHaveBeenLastCalledWith('adri', {
      result: 'win',
      mode: 'all',
      bot: 'all',
      winner: 'all',
      dateSort: 'recent_first',
    });
  });

  test('resets values and exposes a readable error when the request fails', async () => {
    fetchPlayerStats.mockRejectedValue(new Error('Stats unavailable'));
    fetchMatchHistory.mockResolvedValue([
      {
        gameId: 'game-1',
        result: 'win',
        mode: 'human_vs_bot',
        winnerId: 'adri',
        botId: 'greedy_bot',
        endedAt: '2026-03-01T10:05:00.000Z',
      },
    ]);

    render(<StatsProbe userId="adri" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Stats unavailable');
    expect(screen.getByTestId('total-games')).toHaveTextContent('0');
    expect(screen.getByTestId('victories')).toHaveTextContent('0');
    expect(screen.getByTestId('defeats')).toHaveTextContent('0');
    expect(screen.getByTestId('updated-at')).toBeEmptyDOMElement();
    expect(screen.getByTestId('match-count')).toHaveTextContent('0');
  });

  test('uses the generic fallback message when the request rejects with a non-Error value', async () => {
    fetchPlayerStats.mockRejectedValue('plain failure');
    fetchMatchHistory.mockResolvedValue([]);

    render(<StatsProbe userId="adri" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('error')).toHaveTextContent('No se pudieron cargar las estadisticas');
  });

  test('ignores in-flight results after the effect is cancelled', async () => {
    const playerStatsRequest = deferred<{
      totalGames: number;
      victories: number;
      defeats: number;
      updatedAt: string | null;
    }>();
    const historyRequest = deferred<
      Array<{
        gameId: string;
        result: 'win' | 'loss';
        mode: 'human_vs_bot';
        winnerId: string;
        botId: string;
        endedAt: string;
      }>
    >();

    fetchPlayerStats.mockReturnValue(playerStatsRequest.promise);
    fetchMatchHistory.mockReturnValue(historyRequest.promise);

    const { rerender } = render(<StatsProbe userId="adri" />);

    rerender(<StatsProbe userId={undefined} />);

    playerStatsRequest.resolve({
      totalGames: 9,
      victories: 8,
      defeats: 1,
      updatedAt: '2026-03-01T10:00:00.000Z',
    });
    historyRequest.resolve([
      {
        gameId: 'late-game',
        result: 'win',
        mode: 'human_vs_bot',
        winnerId: 'adri',
        botId: 'greedy_bot',
        endedAt: '2026-03-01T10:05:00.000Z',
      },
    ]);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('total-games')).toHaveTextContent('0');
    expect(screen.getByTestId('match-count')).toHaveTextContent('0');
    expect(screen.getByTestId('error')).toBeEmptyDOMElement();
  });

  test('allows manual refresh to request stats again', async () => {
    fetchPlayerStats
      .mockResolvedValueOnce({
        totalGames: 3,
        victories: 2,
        defeats: 1,
        updatedAt: '2026-03-01T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        totalGames: 4,
        victories: 3,
        defeats: 1,
        updatedAt: '2026-03-01T11:00:00.000Z',
      });
    fetchMatchHistory
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          gameId: 'game-2',
          result: 'win',
          mode: 'human_vs_bot',
          winnerId: 'adri',
          botId: 'greedy_bot',
          endedAt: '2026-03-01T11:02:00.000Z',
        },
      ]);

    render(<StatsProbe userId="adri" />);

    await waitFor(() => {
      expect(screen.getByTestId('total-games')).toHaveTextContent('3');
      expect(screen.getByTestId('match-count')).toHaveTextContent('0');
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh stats/i }));

    await waitFor(() => {
      expect(screen.getByTestId('total-games')).toHaveTextContent('4');
      expect(screen.getByTestId('match-count')).toHaveTextContent('1');
    });

    expect(fetchPlayerStats).toHaveBeenCalledTimes(2);
    expect(fetchMatchHistory).toHaveBeenCalledTimes(2);
  });
});
