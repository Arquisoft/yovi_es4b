export type PlayerStatsSummary = {
  totalGames: number;
  victories: number;
  defeats: number;
  updatedAt: string;
};

export type MatchHistoryItem = {
  gameId: string;
  result: 'win' | 'loss';
  mode: 'human_vs_bot' | 'human_vs_human';
  winnerId: string;
  endedAt: string;
};
