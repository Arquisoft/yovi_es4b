import { useEffect, useState } from 'react';
import { fetchMatchHistory, fetchPlayerStats } from './statsApi';
import { EMPTY_PLAYER_STATS, type MatchHistoryItem, type PlayerStatsSummary } from './stats/types';

export function useStats(userId?: string) {
  const [playerStats, setPlayerStats] = useState<PlayerStatsSummary>(EMPTY_PLAYER_STATS);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || userId.trim().length === 0) {
      setPlayerStats(EMPTY_PLAYER_STATS);
      setMatches([]);
      setError(null);
      setLoading(false);
      return;
    }

    const safeUserId = userId.trim();
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);

      try {
        const [nextPlayerStats, nextMatches] = await Promise.all([
          fetchPlayerStats(safeUserId),
          fetchMatchHistory(safeUserId),
        ]);

        if (cancelled) return;

        setPlayerStats(nextPlayerStats);
        setMatches(nextMatches);
      } catch (requestError: unknown) {
        if (cancelled) return;

        setPlayerStats(EMPTY_PLAYER_STATS);
        setMatches([]);
        setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las estadisticas');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    playerStats,
    matches,
    loading,
    error,
  };
}
