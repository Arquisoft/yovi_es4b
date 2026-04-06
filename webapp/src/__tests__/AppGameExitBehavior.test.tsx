import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import App from '../App';

const { logoutSpy, refreshStatsSpy, resignCurrentGameSpy } = vi.hoisted(() => ({
  logoutSpy: vi.fn(),
  refreshStatsSpy: vi.fn().mockResolvedValue(undefined),
  resignCurrentGameSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => {
    const [isAuthenticated, setIsAuthenticated] = React.useState(true);

    return {
      isAuthenticated,
      isGuest: false,
      hasSession: isAuthenticated,
      displayName: isAuthenticated ? 'adri' : null,
      token: isAuthenticated ? 'fake-token' : null,
      username: isAuthenticated ? 'adri' : null,
      loading: false,
      login: vi.fn(),
      logout: () => {
        logoutSpy();
        setIsAuthenticated(false);
      },
      continueAsGuest: vi.fn(),
      openLogin: vi.fn(),
      getAuthHeader: () => ({}),
    };
  },
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
    restoringSession: false,
    hasActiveGameInProgress: true,
    gameIdPendingAutomaticOpen: null,
    board: [],
    canPlayCell: true,
    statusText: 'Turno',
    myPlayerId: null,
    matchmakingTicketId: null,
    matchmakingStatus: 'idle' as const,
    matchmakingPosition: null,
    setMode: vi.fn(),
    setBotDifficulty: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn().mockResolvedValue(true),
    startMatchmaking: vi.fn(),
    cancelCurrentMatchmaking: vi.fn(),
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: resignCurrentGameSpy,
    passCurrentTurn: vi.fn(),
    playCell: vi.fn(),
    acknowledgeAutomaticGameOpen: vi.fn(),
  }),
}));

describe('App game exit behavior', () => {
  beforeEach(() => {
    logoutSpy.mockClear();
    refreshStatsSpy.mockClear();
    resignCurrentGameSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('keeps the active game available when navigating away from the board', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /volver a la partida/i }));
    await screen.findByText(/partida active-game/i);

    const sidebar = screen.getByRole('complementary');
    await user.click(within(sidebar).getByRole('button', { name: /estadisticas/i }));
    expect(refreshStatsSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();
    expect(resignCurrentGameSpy).not.toHaveBeenCalled();

    await user.click(within(sidebar).getByRole('button', { name: /ayuda/i }));
    expect(screen.getByText(/reglas basicas/i)).toBeInTheDocument();
    expect(resignCurrentGameSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^game y$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver a la partida/i })).toBeInTheDocument();
    });

    expect(resignCurrentGameSpy).not.toHaveBeenCalled();
  });

  test('logs out without resigning the active game', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sidebar = screen.getByRole('complementary');

    await user.click(within(sidebar).getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/welcome to gamey/i)).toBeInTheDocument();
    });

    expect(resignCurrentGameSpy).not.toHaveBeenCalled();
  });
});
