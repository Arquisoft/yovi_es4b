import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../App';

const { createNewGameSpy, logoutSpy, refreshStatsSpy, resignCurrentGameSpy } = vi.hoisted(() => ({
  createNewGameSpy: vi.fn().mockResolvedValue(true),
  logoutSpy: vi.fn(),
  refreshStatsSpy: vi.fn().mockResolvedValue(undefined),
  resignCurrentGameSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    token: 'fake-token',
    username: 'adri',
    loading: false,
    login: vi.fn(),
    logout: logoutSpy,
    getAuthHeader: () => ({}),
  }),
}));

vi.mock('../useStats', () => ({
  useStats: () => ({
    playerStats: {
      totalGames: 0,
      victories: 0,
      defeats: 0,
      updatedAt: null,
    },
    matches: [],
    loading: false,
    error: null,
    refreshStats: refreshStatsSpy,
  }),
}));

vi.mock('../useGamey', () => ({
  useGamey: () => ({
    boardSize: 7,
    mode: 'human_vs_bot' as const,
    botDifficulty: 'easy' as const,
    game: {
      api_version: '1.0.0',
      game_id: 'active-game',
      mode: 'human_vs_bot' as const,
      bot_id: null,
      yen: {
        size: 7,
        turn: 0,
        players: ['B', 'R'],
        layout: './../.../..../...../....../.......',
      },
      game_over: false,
      next_player: 0,
      winner: null,
    },
    error: null,
    loading: false,
    board: [],
    canPlayCell: true,
    statusText: 'Turno',
    setMode: vi.fn(),
    setBotDifficulty: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: createNewGameSpy,
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: resignCurrentGameSpy,
    playCell: vi.fn(),
  }),
}));

describe('App game exit behavior', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createNewGameSpy.mockClear();
    logoutSpy.mockClear();
    refreshStatsSpy.mockClear();
    resignCurrentGameSpy.mockClear();

    fetchSpy = vi.fn().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('resigns an active game when navigating to stats, help and dashboard', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sidebar = screen.getByRole('complementary');

    await user.click(within(sidebar).getByRole('button', { name: /estadisticas/i }));
    await user.click(within(sidebar).getByRole('button', { name: /ayuda/i }));
    await user.click(screen.getByRole('button', { name: /^game y$/i }));

    expect(resignCurrentGameSpy).toHaveBeenCalledTimes(3);
    expect(refreshStatsSpy).toHaveBeenCalledTimes(1);
  });

  test('resigns an active game before logout', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sidebar = screen.getByRole('complementary');

    await user.click(within(sidebar).getByRole('button', { name: /logout/i }));

    expect(resignCurrentGameSpy).toHaveBeenCalledTimes(1);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  test('blocks popstate and f5 in game view and sends keepalive resign on beforeunload', async () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /crear partida/i }));
    await screen.findByText(/partida active-game/i);

    await waitFor(() => {
      expect(pushStateSpy).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(pushStateSpy).toHaveBeenCalledTimes(2);

    const keydownEvent = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });
    window.dispatchEvent(keydownEvent);
    expect(keydownEvent.defaultPrevented).toBe(true);

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent & {
      returnValue?: string;
    };
    Object.defineProperty(beforeUnloadEvent, 'returnValue', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    window.dispatchEvent(beforeUnloadEvent);

    expect(beforeUnloadEvent.defaultPrevented).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/games/active-game/resign'),
      expect.objectContaining({
        keepalive: true,
        method: 'POST',
      }),
    );

    const lastCall = fetchSpy.mock.calls.at(-1);
    const requestOptions = lastCall?.[1] as RequestInit;
    const requestHeaders = requestOptions.headers as Headers;
    expect(requestHeaders.get('x-user-id')).toBe('adri');
  });
});