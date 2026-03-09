export type PlayerStatsSummary = {
  totalGames: number;
  victories: number;
  defeats: number;
  updatedAt: string;
};

export type BotDifficulty = 'very_easy' | 'easy' | 'medium' | 'hard';

export const botDifficultyOptions: ReadonlyArray<{
  value: BotDifficulty;
  label: string;
  botId: 'random_bot' | 'biased_random_bot' | 'greedy_bot' | 'minimax_bot';
}> = [
  { value: 'very_easy', label: 'Muy facil', botId: 'random_bot' },
  { value: 'easy', label: 'Facil', botId: 'biased_random_bot' },
  { value: 'medium', label: 'Intermedio', botId: 'greedy_bot' },
  { value: 'hard', label: 'Dificil', botId: 'minimax_bot' },
] as const;

export function mapDifficultyToBotId(difficulty: BotDifficulty): string {
  return botDifficultyOptions.find((option) => option.value === difficulty)?.botId ?? 'biased_random_bot';
}

export type MatchHistoryItem = {
  gameId: string;
  result: 'win' | 'loss';
  mode: 'human_vs_bot' | 'human_vs_human';
  winnerId: string;
  endedAt: string;
};
