import { describe, expect, test } from 'vitest';
import { botDifficultyOptions, mapDifficultyToBotId } from '../stats/types';

describe('stats/types', () => {
  test('maps known difficulty levels to their bot ids', () => {
    expect(botDifficultyOptions).toHaveLength(4);
    expect(mapDifficultyToBotId('very_easy')).toBe('random_bot');
    expect(mapDifficultyToBotId('easy')).toBe('biased_random_bot');
    expect(mapDifficultyToBotId('medium')).toBe('greedy_bot');
    expect(mapDifficultyToBotId('hard')).toBe('minimax_bot');
  });

  test('falls back to the default bot when the difficulty is unknown at runtime', () => {
    expect(mapDifficultyToBotId('legendary' as never)).toBe('biased_random_bot');
  });
});
