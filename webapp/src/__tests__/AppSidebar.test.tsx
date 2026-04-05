import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import App from '../App';

const { setModeSpy, setBotDifficultySpy, logoutSpy, refreshStatsSpy } = vi.hoisted(() => ({
  setModeSpy: vi.fn(),
  setBotDifficultySpy: vi.fn(),
  logoutSpy: vi.fn(),
  refreshStatsSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => {
    const [isAuthenticated, setIsAuthenticated] = React.useState(true);

    return {
      isAuthenticated,
      token: isAuthenticated ? 'fake-token' : null,
      username: isAuthenticated ? 'adri' : null,
      loading: false,
      login: vi.fn(),
      logout: () => {
        logoutSpy();
        setIsAuthenticated(false);
      },
      getAuthHeader: () => ({}),
    };
  },
}));

vi.mock('../useGamey', () => ({
  useGamey: () => {
    const [mode, setModeState] = React.useState<'human_vs_bot' | 'human_vs_human'>('human_vs_bot');
    const [botDifficulty, setBotDifficultyState] = React.useState<'very_easy' | 'easy' | 'medium' | 'hard'>('easy');
    const [game, setGame] = React.useState<{ game_id: string; game_over: boolean; yen: { players: string[]; size: number } } | null>(null);

    const setMode = (nextMode: 'human_vs_bot' | 'human_vs_human') => {
      setModeSpy(nextMode);
      setModeState(nextMode);
    };

    const setBotDifficulty = (nextDifficulty: 'very_easy' | 'easy' | 'medium' | 'hard') => {
      setBotDifficultySpy(nextDifficulty);
      setBotDifficultyState(nextDifficulty);
    };

    const createNewGame = async () => {
      const selectedMode = mode;
      setGame({
        game_id: selectedMode === 'human_vs_bot' ? 'bot-game' : 'human-game',
        game_over: false,
        yen: { players: ['x'], size: 7 },
      });
      return true;
    };

    return {
      boardSize: 7,
      mode,
      botDifficulty,
      game,
      error: null,
      loading: false,
      restoringSession: false,
      board: [],
      canPlayCell: true,
      statusText: 'Turno',
      myPlayerId: null,
      matchmakingTicketId: null,
      matchmakingStatus: 'idle' as const,
      matchmakingPosition: null,
      setMode,
      setBotDifficulty,
      updateBoardSize: vi.fn(),
      createNewGame,
      startMatchmaking: vi.fn(),
      cancelCurrentMatchmaking: vi.fn(),
      refreshCurrentGame: vi.fn(),
      resignCurrentGame: vi.fn(),
      playCell: vi.fn(),
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

describe('App sidebar actions', () => {
  beforeEach(() => {
    setModeSpy.mockClear();
    setBotDifficultySpy.mockClear();
    logoutSpy.mockClear();
    refreshStatsSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('clicking "Jugar" opens the main play dashboard', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /ayuda/i }));
    expect(screen.getByText(/reglas basicas/i)).toBeInTheDocument();

    const sidebar = screen.getByRole('complementary');
    await user.click(within(sidebar).getByRole('button', { name: /jugar/i }));

    await waitFor(() => {
      expect(screen.getByText(/configurar partida/i)).toBeInTheDocument();
    });
  });

  test('clicking "Estadisticas" opens the history view and refreshes stats', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /estadisticas/i }));

    expect(refreshStatsSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();
  });

  test('clicking "Ayuda" opens the help view', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /ayuda/i }));

    expect(screen.getByText(/reglas basicas/i)).toBeInTheDocument();
  });

  test('clicking "Logout" returns to login view', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/welcome to gamey/i)).toBeInTheDocument();
    });
  });
});
