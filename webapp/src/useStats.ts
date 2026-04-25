import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMatchHistory, fetchPlayerStats } from './statsApi';
import {
  DEFAULT_HISTORY_FILTERS,
  EMPTY_PLAYER_STATS,
  type HistoryFilters,
  type MatchHistoryItem,
  type PlayerStatsSummary,
} from './stats/types';

function hasActiveHistoryFilters(filters: HistoryFilters) {
  return (
    filters.result !== DEFAULT_HISTORY_FILTERS.result ||
    filters.mode !== DEFAULT_HISTORY_FILTERS.mode ||
    filters.bot !== DEFAULT_HISTORY_FILTERS.bot ||
    filters.winner !== DEFAULT_HISTORY_FILTERS.winner ||
    filters.dateSort !== DEFAULT_HISTORY_FILTERS.dateSort
  );
}

export function useStats(userId?: string) {
  const [playerStats, setPlayerStats] = useState<PlayerStatsSummary>(EMPTY_PLAYER_STATS);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const safeUserId = userId?.trim() ?? '';

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshStats = useCallback(async () => {
    if (safeUserId.length === 0) {
      // Invalidate any in-flight request so stale responses cannot overwrite the cleared state.
      requestIdRef.current += 1;
      setPlayerStats(EMPTY_PLAYER_STATS);
      setMatches([]);
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const [nextPlayerStats, nextMatches] = await Promise.all([
        fetchPlayerStats(safeUserId),
        hasActiveHistoryFilters(historyFilters)
          ? fetchMatchHistory(safeUserId, historyFilters)
          : fetchMatchHistory(safeUserId),
      ]);

      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      setPlayerStats(nextPlayerStats);
      setMatches(nextMatches);
    } catch (requestError: unknown) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      setPlayerStats(EMPTY_PLAYER_STATS);
      setMatches([]);
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las estadisticas');
    } finally {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [historyFilters, safeUserId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  return {
    playerStats,
    matches,
    loading,
    error,
    historyFilters,
    setHistoryFilters,
    refreshStats,
  };
}
