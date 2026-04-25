import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../App';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isGuest: false,
    hasSession: true,
    displayName: 'adri',
    sessionUserId: 'adri',
    token: 'fake-token',
    username: 'adri',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    continueAsGuest: vi.fn(),
    openLogin: vi.fn(),
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
    restoringSession: false,
    hasActiveGameInProgress: false,
    gameIdPendingAutomaticOpen: null,
    board: [],
    canPlayCell: true,
    statusText: '',
    myPlayerId: null,
    matchmakingTicketId: null,
    matchmakingStatus: 'idle' as const,
    matchmakingPosition: null,
    setMode: vi.fn(),
    setBotDifficulty: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn(),
    startMatchmaking: vi.fn(),
    cancelCurrentMatchmaking: vi.fn(),
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: vi.fn(),
    passCurrentTurn: vi.fn(),
    playCell: vi.fn(),
    acknowledgeAutomaticGameOpen: vi.fn(),
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
    historyFilters: {
      result: 'all',
      mode: 'all',
      bot: 'all',
      winner: 'all',
      dateSort: 'recent_first',
    },
    setHistoryFilters: vi.fn(),
    refreshStats: vi.fn(),
  }),
}));

describe('App history navigation', () => {
  test('opens stats view from sidebar and returns to dashboard', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sidebar = screen.getByRole('complementary');

    expect(screen.getByText(/configurar partida/i)).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('button', { name: /estadisticas/i }));
    expect(await screen.findByRole('heading', { name: /estadisticas/i })).toBeInTheDocument();
    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('button', { name: /jugar/i }));
    expect(await screen.findByText(/configurar partida/i)).toBeInTheDocument();
  });
});
