import { createGame, type GameMode } from '../gameyApi';
import { describe, expect, test, vi, beforeEach } from 'vitest';

describe('gameyApi.createGame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(response: any) {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(response),
    } as Response);
  }

  test.each<
    [GameMode, string | undefined, string | undefined]
  >([
    ['human_vs_human', undefined, undefined],
    ['human_vs_bot', undefined, 'random_bot'],
    ['bot_muy_facil', 'human_vs_bot', 'random_bot'],
    ['bot_facil', 'human_vs_bot', 'biased_random_bot'],
    ['bot_medio', 'human_vs_bot', 'greedy_bot'],
    ['bot_dificil', 'human_vs_bot', 'minimax_bot'],
  ])(
    'mode %s sends apiMode %s and bot_id %s',
    async (mode, expectedMode, expectedBot) => {
      const fakeResponse = {
        api_version: '1',
        game_id: 'foo',
        mode: 'human_vs_human',
        bot_id: null,
        yen: { size: 7, turn: 0, players: ['X', 'O'], layout: '' },
        game_over: false,
        next_player: 0,
        winner: null,
      };
      mockFetch(fakeResponse);

      await createGame({ size: 3, mode });

      expect(global.fetch).toHaveBeenCalled();
      const [url, init] = (global.fetch as any).mock.calls[0];
      expect(url).toMatch(/\/v1\/games$/);
      const body = JSON.parse(init.body);
      if (expectedMode) {
        expect(body.mode).toBe(expectedMode);
      }
      if (expectedBot) {
        expect(body.bot_id).toBe(expectedBot);
      }
    },
  );
});
