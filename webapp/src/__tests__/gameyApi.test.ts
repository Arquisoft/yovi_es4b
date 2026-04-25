import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  cancelMatchmakingTicket,
  createGame,
  getBotHint,
  enqueueMatchmaking,
  getGame,
  getMatchmakingTicket,
  passTurnGame,
  playMove,
  resignGame,
} from '../gameyApi';

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as typeof fetch;

function okResponse(body: string, overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: vi.fn().mockResolvedValue(body),
    ...overrides,
  } as unknown as Response;
}

function failResponse(body: string, overrides: Partial<Response> = {}): Response {
  return {
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    text: vi.fn().mockResolvedValue(body),
    ...overrides,
  } as unknown as Response;
}

describe('gameyApi', () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  test('createGame posts default values and trims the user id header', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        JSON.stringify({
          api_version: '1.0.0',
          game_id: 'game-1',
          mode: 'human_vs_bot',
          bot_id: 'biased_random_bot',
          yen: { size: 7, turn: 0, players: ['B', 'R'], layout: 'B/R' },
          game_over: false,
          next_player: 0,
          winner: null,
        }),
      ),
    );

    const result = await createGame({}, '  adri  ');

    expect(result.game_id).toBe('game-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'adri',
      },
      body: JSON.stringify({
        size: 7,
        mode: 'human_vs_bot',
      }),
    });
  });

  test('getGame, playMove, passTurnGame and resignGame call the expected endpoints', async () => {
    const payload = JSON.stringify({
      api_version: '1.0.0',
      game_id: 'game-1',
      mode: 'human_vs_human',
      bot_id: null,
      yen: { size: 7, turn: 0, players: ['B', 'R'], layout: 'B/R' },
      game_over: false,
      next_player: 0,
      winner: null,
    });
    fetchMock.mockResolvedValue(okResponse(payload));

    await getGame('game-1');
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/games/game-1', {
      method: 'GET',
      headers: {},
    });

    await playMove('game-1', { coords: { x: 1, y: 0, z: -1 } }, 'adri');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/games/game-1/moves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'adri',
      },
      body: JSON.stringify({ coords: { x: 1, y: 0, z: -1 } }),
    });

    await passTurnGame('game-1', 'adri', 'ptk-1');
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/games/game-1/pass', {
      method: 'POST',
      headers: {
        'x-user-id': 'adri',
        'x-player-token': 'ptk-1',
      },
    });

    await resignGame('game-1', 'adri');
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/games/game-1/resign', {
      method: 'POST',
      headers: {
        'x-user-id': 'adri',
      },
    });
  });

  test('matchmaking endpoints call the expected routes', async () => {
    const ticketPayload = JSON.stringify({
      api_version: '1.0.0',
      ticket_id: 'ticket-1',
      status: 'waiting',
      poll_after_ms: 1000,
      position: 1,
      game_id: null,
      player_id: null,
      player_token: null,
    });
    fetchMock.mockResolvedValue(okResponse(ticketPayload));

    await enqueueMatchmaking(9, 'adri');
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/matchmaking/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'adri',
      },
      body: JSON.stringify({ size: 9 }),
    });

    await getMatchmakingTicket('ticket-1');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/matchmaking/tickets/ticket-1', {
      method: 'GET',
    });

    await cancelMatchmakingTicket('ticket-1');
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/matchmaking/tickets/ticket-1/cancel', {
      method: 'POST',
    });
  });

  test('rejects invalid path segments before issuing client requests', async () => {
    await expect(getGame('game/1')).rejects.toThrow('gameId is invalid');
    await expect(passTurnGame('game 1')).rejects.toThrow('gameId is invalid');
    await expect(getMatchmakingTicket('../ticket-1')).rejects.toThrow('ticketId is invalid');
    await expect(cancelMatchmakingTicket('ticket?1')).rejects.toThrow('ticketId is invalid');
    await expect(getBotHint({ size: 3, turn: 0, players: ['B', 'R'], layout: 'B/../...' }, 'bot/unsafe'))
      .rejects.toThrow('botId is invalid');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('omits the user id header when it is blank', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        JSON.stringify({
          api_version: '1.0.0',
          game_id: 'game-1',
          mode: 'human_vs_human',
          bot_id: null,
          yen: { size: 7, turn: 0, players: ['B', 'R'], layout: 'B/R' },
          game_over: false,
          next_player: 0,
          winner: null,
        }),
      ),
    );

    await createGame({ size: 9, mode: 'human_vs_human', bot_id: 'ignored_bot' }, '   ');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: 9,
        mode: 'human_vs_human',
        bot_id: 'ignored_bot',
      }),
    });
  });

  test('throws the API message when the response is not ok and includes a message payload', async () => {
    fetchMock.mockResolvedValue(failResponse(JSON.stringify({ message: 'No permitido' }), { status: 403 }));

    await expect(getGame('game-1')).rejects.toThrow('No permitido');
  });

  test('throws the raw response when the response is not ok without an API message', async () => {
    fetchMock.mockResolvedValue(failResponse('["Gateway exploded"]', { status: 502, statusText: 'Bad Gateway' }));

    await expect(getGame('game-1')).rejects.toThrow('["Gateway exploded"]');
  });

  test('throws a detailed error when a failing response contains invalid JSON', async () => {
    fetchMock.mockResolvedValue(
      failResponse('not-json', {
        status: 500,
        statusText: 'Server Error',
      }),
    );

    await expect(getGame('game-1')).rejects.toThrow('Request failed with status 500 (Server Error) at /api/v1/games/game-1');
  });

  test('throws when a successful response is invalid json, empty, or message-only', async () => {
    fetchMock.mockResolvedValueOnce(okResponse('not-json'));
    await expect(getGame('game-1')).rejects.toThrow('Invalid JSON response from /api/v1/games/game-1');

    fetchMock.mockResolvedValueOnce(okResponse('   '));
    await expect(getGame('game-1')).rejects.toThrow('Empty response body from /api/v1/games/game-1');

    fetchMock.mockResolvedValueOnce(okResponse(JSON.stringify({ message: 'Game not ready' })));
    await expect(getGame('game-1')).rejects.toThrow('Game not ready');
  });

  test('playMove surfaces 409 occupied-cell errors with explanatory message', async () => {
    fetchMock.mockResolvedValue(
      failResponse(
        JSON.stringify({
          message: 'Could not apply move: Player 1 tries to place a stone on an occupied position: 2 0 0',
        }),
        { status: 409, statusText: 'Conflict' },
      ),
    );

    await expect(playMove('game-1', { coords: { x: 2, y: 0, z: 0 } }, 'adri')).rejects
      .toThrow('Could not apply move: Player 1 tries to place a stone on an occupied position: 2 0 0');
  });
});
