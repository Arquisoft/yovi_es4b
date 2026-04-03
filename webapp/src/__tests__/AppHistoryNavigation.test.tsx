import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../App';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    token: 'fake-token',
    username: 'adri',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    getAuthHeader: () => ({}),
  }),
}));

vi.mock('../useGamey', () => ({
  useGamey: () => ({
    boardSize: 7,
    mode: 'human_vs_bot' as const,
    botDifficulty: 'easy' as const,
    game: null,
    error: null,
    loading: false,
    board: [],
    canPlayCell: true,
    statusText: '',
    setMode: vi.fn(),
    setBotDifficulty: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn(),
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: vi.fn(),
    playCell: vi.fn(),
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
    reload: vi.fn(),
  }),
}));

describe('App history navigation', () => {
  test('opens full history from "Ver mas partidas" and returns to dashboard', async () => {
    render(<App />);
    const user = userEvent.setup();

    expect(screen.getByText(/historial de partidas/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ver mas partidas/i }));
    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /volver al inicio/i }));
    expect(screen.getByText(/historial de partidas/i)).toBeInTheDocument();
  });
});
