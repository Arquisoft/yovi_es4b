import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import App from '../App';

const { loginSpy, createNewGameSpy, statsState } = vi.hoisted(() => ({
  loginSpy: vi.fn(),
  createNewGameSpy: vi.fn(),
  statsState: {
    error: null as string | null,
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => {
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);

    return {
      isAuthenticated,
      token: isAuthenticated ? 'fake-token' : null,
      username: isAuthenticated ? 'adri' : null,
      loading: false,
      login: (token: string, username: string) => {
        loginSpy(token, username);
        setIsAuthenticated(true);
      },
      logout: vi.fn(),
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
    error: statsState.error,
    refreshStats: vi.fn(),
  }),
}));

vi.mock('../useGamey', () => ({
  useGamey: () => {
    const [game, setGame] = React.useState<{ game_id: string; game_over: boolean; yen: { players: string[]; size: number } } | null>(null);

    const createNewGame = vi.fn(async () => {
      createNewGameSpy();
      setGame({
        game_id: 'app-game',
        game_over: false,
        yen: { players: ['B'], size: 7 },
      });
      return true;
    });

    return {
      boardSize: 7,
      mode: 'human_vs_bot' as const,
      botDifficulty: 'easy' as const,
      game,
      error: null,
      loading: false,
      board: [],
      canPlayCell: true,
      statusText: 'Turno',
      setMode: vi.fn(),
      setBotDifficulty: vi.fn(),
      updateBoardSize: vi.fn(),
      createNewGame,
      refreshCurrentGame: vi.fn(),
      resignCurrentGame: vi.fn(),
      playCell: vi.fn(),
    };
  },
}));

vi.mock('../views/LoginView', () => ({
  default: ({ onNext, onAuth }: { onNext: () => void; onAuth: (token: string, username: string) => void }) => (
    <button
      onClick={() => {
        onAuth('token-1', 'adri');
        onNext();
      }}
    >
      Mock Login View
    </button>
  ),
}));

describe('App additional flows', () => {
  beforeEach(() => {
    loginSpy.mockReset();
    createNewGameSpy.mockReset();
    statsState.error = null;
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('logs in from the unauthenticated view and shows the dashboard', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /mock login view/i }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('token-1', 'adri');
      expect(screen.getByText(/hello,/i)).toBeInTheDocument();
      expect(screen.getByText(/configurar partida/i)).toBeInTheDocument();
    });
  });

  test('returns to the dashboard when clicking the header from the game view', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /mock login view/i }));
    await waitFor(() => expect(screen.getByText(/configurar partida/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /crear partida/i }));
    await waitFor(() => expect(screen.getByText(/partida app-game/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^game y$/i }));

    await waitFor(() => {
      expect(screen.getByText(/configurar partida/i)).toBeInTheDocument();
    });
  });

  test('shows stats warning alert when stats hook returns an error', async () => {
    statsState.error = 'Stats warning';

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /mock login view/i }));

    await waitFor(() => {
      expect(screen.getByText(/stats warning/i)).toBeInTheDocument();
    });
  });
});
