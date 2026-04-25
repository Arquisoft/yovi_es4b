export type PlayerStatsSummary = {
  totalGames: number;
  victories: number;
  defeats: number;
  updatedAt: string | null;
};

export const EMPTY_PLAYER_STATS: PlayerStatsSummary = {
  totalGames: 0,
  victories: 0,
  defeats: 0,
  updatedAt: null,
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
  mode: 'human_vs_bot' | 'local_human_vs_human' | 'human_vs_human' | 'online' | null;
  winnerId: string | null;
  botId: string | null;
  endedAt: string;
  finalBoard?: FinalBoardSnapshot | null;
};

export type FinalBoardSnapshot = {
  size: number;
  turn: number;
  players: string[];
  layout: string;
};

export type ResultFilter = 'all' | 'win' | 'loss';
export type ModeFilter = 'all' | 'human_vs_bot' | 'local_human_vs_human' | 'online';
export type BotFilter = 'all' | 'with_bot' | 'without_bot' | `bot:${string}`;
export type WinnerFilter = 'all' | 'you' | 'rival';
export type DateSort = 'recent_first' | 'oldest_first';

export type HistoryFilters = {
  result: ResultFilter;
  mode: ModeFilter;
  bot: BotFilter;
  winner: WinnerFilter;
  dateSort: DateSort;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  result: 'all',
  mode: 'all',
  bot: 'all',
  winner: 'all',
  dateSort: 'recent_first',
};

export const botHistoryLabels: Record<string, string> = {
  random_bot: 'Muy facil',
  biased_random_bot: 'Facil',
  greedy_bot: 'Intermedio',
  minimax_bot: 'Dificil',
};
