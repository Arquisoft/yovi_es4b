import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import App from '../App';
import { mapDifficultyToBotId } from '../stats/types';

const { createNewGameSpy, setModeSpy, logoutSpy } = vi.hoisted(() => ({
  createNewGameSpy: vi.fn(),
  setModeSpy: vi.fn(),
  logoutSpy: vi.fn(),
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
    const [game, setGame] = React.useState<any>(null);

    const setMode = (nextMode: 'human_vs_bot' | 'human_vs_human') => {
      setModeSpy(nextMode);
      setModeState(nextMode);
    };

    const createNewGame = async (next?: { mode?: 'human_vs_bot' | 'human_vs_human'; botId?: string }) => {
      createNewGameSpy(next);
      const selectedMode = next?.mode ?? mode;
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
      game,
      error: null,
      loading: false,
      board: [],
      canPlayCell: true,
      statusText: 'Turno',
      setMode,
      updateBoardSize: vi.fn(),
      createNewGame,
      refreshCurrentGame: vi.fn(),
      resignCurrentGame: vi.fn(),
      playCell: vi.fn(),
    };
  },
}));

describe('App sidebar actions', () => {
  beforeEach(() => {
    createNewGameSpy.mockClear();
    setModeSpy.mockClear();
    logoutSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('clicking "Facil" creates a human_vs_bot game and opens game view', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sidebar = screen.getByRole('complementary');

    await user.hover(within(sidebar).getByRole('button', { name: /jugar/i }));
    await user.click(within(sidebar).getByRole('button', { name: /facil/i }));

    await waitFor(() => {
      expect(createNewGameSpy).toHaveBeenCalledWith({ mode: 'human_vs_bot', botId: mapDifficultyToBotId('easy') });
      expect(screen.getByText(/partida bot-game/i)).toBeInTheDocument();
    });
  });

  test('clicking "Contra humano" creates a human_vs_human game and opens game view', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sidebar = screen.getByRole('complementary');

    await user.hover(within(sidebar).getByRole('button', { name: /jugar/i }));
    await user.click(within(sidebar).getByRole('button', { name: /contra humano/i }));

    await waitFor(() => {
      expect(createNewGameSpy).toHaveBeenCalledWith({ mode: 'human_vs_human' });
      expect(screen.getByText(/partida human-game/i)).toBeInTheDocument();
    });
  });

  test('clicking "Estadisticas" opens the history view', async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /estadisticas/i }));

    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();
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
