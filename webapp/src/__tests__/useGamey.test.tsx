import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  GAME_SESSION_STORE_VERSION,
  gameSessionStore,
} from '../gameSessionStore';
import { useGamey } from '../useGamey';

const createGame = vi.fn();
const getGame = vi.fn();
const getHint = vi.fn();
const playMove = vi.fn();
const passTurnGame = vi.fn();
const resignGame = vi.fn();
const enqueueMatchmaking = vi.fn();
const getMatchmakingTicket = vi.fn();
const cancelMatchmakingTicket = vi.fn();

vi.mock('../gameyApi', () => ({
  createGame: (...args: unknown[]) => createGame(...args),
  getGame: (...args: unknown[]) => getGame(...args),
  getHint: (...args: unknown[]) => getHint(...args),
  playMove: (...args: unknown[]) => playMove(...args),
  passTurnGame: (...args: unknown[]) => passTurnGame(...args),
  resignGame: (...args: unknown[]) => resignGame(...args),
  enqueueMatchmaking: (...args: unknown[]) => enqueueMatchmaking(...args),
  getMatchmakingTicket: (...args: unknown[]) => getMatchmakingTicket(...args),
  cancelMatchmakingTicket: (...args: unknown[]) => cancelMatchmakingTicket(...args),
}));

function buildGame(overrides: Record<string, unknown> = {}) {
  return {
    api_version: '1.0.0',
    game_id: 'game-1',
    mode: 'human_vs_bot',
    bot_id: 'biased_random_bot',
    yen: {
      size: 7,
      turn: 0,
      players: ['B', 'R'],
      layout: 'B/R',
    },
    game_over: false,
    next_player: 0,
    winner: null,
    completion_reason: null,
    ...overrides,
  };
}

describe('useGamey', () => {
  beforeEach(() => {
    createGame.mockReset();
    getGame.mockReset();
    getHint.mockReset();
    playMove.mockReset();
    passTurnGame.mockReset();
    resignGame.mockReset();
    enqueueMatchmaking.mockReset();
    getMatchmakingTicket.mockReset();
    cancelMatchmakingTicket.mockReset();
    localStorage.clear();
  });

  test('starts with the expected defaults', () => {
    const { result } = renderHook(() => useGamey());

    expect(result.current.boardSize).toBe(7);
    expect(result.current.mode).toBe('human_vs_bot');
    expect(result.current.botDifficulty).toBe('easy');
    expect(result.current.game).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.restoringSession).toBe(false);
    expect(result.current.hasActiveGameInProgress).toBe(false);
    expect(result.current.gameIdPendingAutomaticOpen).toBeNull();
    expect(result.current.matchmakingStatus).toBe('idle');
    expect(result.current.matchmakingTicketId).toBeNull();
  });

  test('creates a local game, marks it as active, and persists it', async () => {
    createGame.mockResolvedValue(buildGame());
    const { result } = renderHook(() => useGamey('adri'));

    let created = false;
    await act(async () => {
      created = await result.current.createNewGame();
    });

    expect(created).toBe(true);
    expect(createGame).toHaveBeenCalledWith(
      {
        size: 7,
        mode: 'human_vs_bot',
        bot_id: 'biased_random_bot',
      },
      'adri',
    );
    expect(result.current.game?.game_id).toBe('game-1');
    expect(result.current.hasActiveGameInProgress).toBe(true);
    expect(result.current.board).toHaveLength(2);
    expect(result.current.canPlayCell).toBe(true);
    expect(gameSessionStore.load('adri')).toEqual({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'local_active',
      userId: 'adri',
      gameId: 'game-1',
    });
  });

  test('blocks creating a second game while one is still active', async () => {
    createGame.mockResolvedValue(buildGame());
    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.createNewGame();
    });

    createGame.mockClear();

    let created = true;
    await act(async () => {
      created = await result.current.createNewGame();
    });

    expect(created).toBe(false);
    expect(createGame).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/ya tienes una partida activa/i);
  });

  test('supports overrides when creating a new game', async () => {
    createGame.mockResolvedValue(buildGame({ mode: 'human_vs_human', bot_id: null }));
    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.createNewGame({ mode: 'human_vs_human', size: 9 });
    });

    expect(createGame).toHaveBeenCalledWith(
      {
        size: 9,
        mode: 'human_vs_human',
      },
      'adri',
    );
  });

  test('stores request errors as readable text', async () => {
    createGame.mockRejectedValue(new Error('Cannot create game'));
    const { result } = renderHook(() => useGamey('adri'));

    let created = true;
    await act(async () => {
      created = await result.current.createNewGame();
    });

    expect(created).toBe(false);
    expect(result.current.error).toBe('Cannot create game');
    expect(result.current.loading).toBe(false);
  });

  test('refreshes and resigns the current game only when a game exists', async () => {
    createGame.mockResolvedValue(buildGame());
    getGame.mockResolvedValue(buildGame({ next_player: 1 }));
    resignGame.mockResolvedValue(buildGame({ game_over: true, winner: 1, completion_reason: 'resignation' }));
    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.refreshCurrentGame();
      await result.current.resignCurrentGame();
    });

    expect(getGame).not.toHaveBeenCalled();
    expect(resignGame).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.createNewGame();
    });

    await act(async () => {
      await result.current.refreshCurrentGame();
    });

    expect(getGame).toHaveBeenCalledWith('game-1', 'adri', undefined);
    expect(result.current.statusText).toBe('Turno: Player 1 (R)');

    await act(async () => {
      await result.current.resignCurrentGame();
    });

    expect(resignGame).toHaveBeenCalledWith('game-1', 'adri', undefined);
    expect(result.current.hasActiveGameInProgress).toBe(false);
    expect(gameSessionStore.load('adri')).toBeNull();
  });

  test('plays a move only when the human can act and the hook is not loading', async () => {
    createGame.mockResolvedValue(buildGame());
    playMove.mockResolvedValue(buildGame({ next_player: 1 }));
    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.playCell({ x: 1, y: 0, z: -1 });
    });
    expect(playMove).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.createNewGame();
    });

    await act(async () => {
      await result.current.playCell({ x: 1, y: 0, z: -1 });
    });
    expect(playMove).toHaveBeenCalledWith(
      'game-1',
      { coords: { x: 1, y: 0, z: -1 } },
      'adri',
    );
  });

  test('requests a hint when a game is active and the human can play', async () => {
    createGame.mockResolvedValue(buildGame());
    getHint.mockResolvedValue({ api_version: 'v1', game_id: 'game-1', coords: { x: 1, y: 0, z: -1 } });
    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.createNewGame();
    });

    await act(async () => {
      await result.current.requestHint();
    });

    expect(getHint).toHaveBeenCalledWith('game-1');
    expect(result.current.hintCoords).toEqual({ x: 1, y: 0, z: -1 });
  });

  test('passes the turn only when the human can act and the hook is not loading', async () => {
    createGame.mockResolvedValue(buildGame());
    passTurnGame.mockResolvedValue(buildGame({ next_player: 1 }));
    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.passCurrentTurn();
    });
    expect(passTurnGame).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.createNewGame();
    });

    await act(async () => {
      await result.current.passCurrentTurn();
    });
    expect(passTurnGame).toHaveBeenCalledWith('game-1', 'adri', undefined);
  });

  test('does not pass the turn while a request is already loading', async () => {
    let resolveRequest: ((value: ReturnType<typeof buildGame>) => void) | null = null;
    createGame.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { result } = renderHook(() => useGamey('adri'));

    act(() => {
      void result.current.createNewGame();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      await result.current.passCurrentTurn();
    });

    expect(passTurnGame).not.toHaveBeenCalled();

    await act(async () => {
      resolveRequest?.(buildGame());
    });
  });

  test('exposes loading during an in-flight request', async () => {
    let resolveRequest: ((value: ReturnType<typeof buildGame>) => void) | null = null;
    createGame.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { result } = renderHook(() => useGamey('adri'));

    act(() => {
      void result.current.createNewGame();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveRequest?.(buildGame());
    });

    expect(result.current.loading).toBe(false);
  });

  test('starts and cancels online matchmaking flow', async () => {
    enqueueMatchmaking.mockResolvedValue({
      api_version: '1.0.0',
      ticket_id: 'ticket-1',
      status: 'waiting',
      poll_after_ms: 5_000,
      position: 1,
      game_id: null,
      player_id: null,
      player_token: null,
    });
    cancelMatchmakingTicket.mockResolvedValue({
      api_version: '1.0.0',
      ticket_id: 'ticket-1',
      status: 'cancelled',
      poll_after_ms: null,
      position: null,
      game_id: null,
      player_id: null,
      player_token: null,
    });

    const { result } = renderHook(() => useGamey('adri'));

    await act(async () => {
      await result.current.startMatchmaking();
    });

    expect(enqueueMatchmaking).toHaveBeenCalledWith(7, 'adri');
    expect(gameSessionStore.load('adri')).toEqual({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'online_waiting',
      userId: 'adri',
      ticketId: 'ticket-1',
      boardSize: 7,
    });
    expect(result.current.matchmakingStatus).toBe('waiting');
    expect(result.current.matchmakingTicketId).toBe('ticket-1');

    await act(async () => {
      await result.current.cancelCurrentMatchmaking();
    });

    expect(cancelMatchmakingTicket).toHaveBeenCalledWith('ticket-1');
    expect(gameSessionStore.load('adri')).toBeNull();
    expect(result.current.matchmakingStatus).toBe('cancelled');
  });

  test('restores a waiting online matchmaking session from localStorage', async () => {
    gameSessionStore.save({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'online_waiting',
      userId: 'adri',
      ticketId: 'ticket-restore',
      boardSize: 9,
    });
    getMatchmakingTicket.mockResolvedValue({
      api_version: '1.0.0',
      ticket_id: 'ticket-restore',
      status: 'waiting',
      poll_after_ms: 5_000,
      position: 2,
      game_id: null,
      player_id: null,
      player_token: null,
    });

    const { result } = renderHook(() => useGamey('adri'));

    await waitFor(() => {
      expect(getMatchmakingTicket).toHaveBeenCalledWith('ticket-restore');
      expect(result.current.restoringSession).toBe(false);
    });

    expect(result.current.boardSize).toBe(9);
    expect(result.current.matchmakingStatus).toBe('waiting');
    expect(result.current.matchmakingTicketId).toBe('ticket-restore');
  });

  test('restores an active online game and marks it for automatic opening', async () => {
    gameSessionStore.save({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'online_active',
      userId: 'adri',
      gameId: 'game-restore',
      myPlayerId: 1,
      playerToken: 'ptk-42',
    });
    getGame.mockResolvedValue(
      buildGame({
        game_id: 'game-restore',
        mode: 'human_vs_human',
        bot_id: null,
        next_player: 1,
      }),
    );
    playMove.mockResolvedValue(
      buildGame({
        game_id: 'game-restore',
        mode: 'human_vs_human',
        bot_id: null,
        next_player: 0,
      }),
    );

    const { result } = renderHook(() => useGamey('adri'));

    await waitFor(() => {
      expect(getGame).toHaveBeenCalledWith('game-restore', 'adri', 'ptk-42');
      expect(result.current.restoringSession).toBe(false);
    });

    expect(result.current.game?.game_id).toBe('game-restore');
    expect(result.current.myPlayerId).toBe(1);
    expect(result.current.gameIdPendingAutomaticOpen).toBe('game-restore');

    act(() => {
      result.current.acknowledgeAutomaticGameOpen();
    });

    expect(result.current.gameIdPendingAutomaticOpen).toBeNull();

    await act(async () => {
      await result.current.playCell({ x: 1, y: 0, z: -1 });
    });

    expect(playMove).toHaveBeenCalledWith(
      'game-restore',
      { coords: { x: 1, y: 0, z: -1 }, player_token: 'ptk-42' },
      'adri',
    );
  });

  test('restores an active local game and marks it for automatic opening', async () => {
    gameSessionStore.save({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'local_active',
      userId: 'adri',
      gameId: 'local-restore',
    });
    getGame.mockResolvedValue(
      buildGame({
        game_id: 'local-restore',
        mode: 'human_vs_bot',
      }),
    );

    const { result } = renderHook(() => useGamey('adri'));

    await waitFor(() => {
      expect(getGame).toHaveBeenCalledWith('local-restore', 'adri');
      expect(result.current.restoringSession).toBe(false);
    });

    expect(result.current.game?.game_id).toBe('local-restore');
    expect(result.current.gameIdPendingAutomaticOpen).toBe('local-restore');
    expect(result.current.hasActiveGameInProgress).toBe(true);
  });
});
