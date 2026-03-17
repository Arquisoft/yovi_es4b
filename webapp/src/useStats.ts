import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMatchHistory, fetchPlayerStats } from './statsApi';
import { EMPTY_PLAYER_STATS, type MatchHistoryItem, type PlayerStatsSummary } from './stats/types';

export function useStats(userId?: string) {
  const [playerStats, setPlayerStats] = useState<PlayerStatsSummary>(EMPTY_PLAYER_STATS);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
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
        fetchMatchHistory(safeUserId),
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
  }, [safeUserId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  return {
    playerStats,
    matches,
    loading,
    error,
    refreshStats,
  };
}
