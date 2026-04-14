import { render, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../App';

const { refreshStatsSpy } = vi.hoisted(() => ({
  refreshStatsSpy: vi.fn().mockResolvedValue(undefined),
}));

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

vi.mock('../useStats', () => ({
  useStats: () => ({
    playerStats: {
      totalGames: 1,
      victories: 1,
      defeats: 0,
      updatedAt: '2026-03-10T11:00:00.000Z',
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
      game_id: 'finished-game',
      game_over: true,
      winner: 0,
      yen: { players: ['B', 'R'], size: 7, layout: 'B/R', turn: 0 },
    },
    error: null,
    loading: false,
    restoringSession: false,
    hasActiveGameInProgress: false,
    gameIdPendingAutomaticOpen: null,
    board: [],
    canPlayCell: false,
    statusText: 'Partida finalizada',
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

describe('App stats sync', () => {
  test('refreshes stats automatically when loading a finished game', async () => {
    render(<App />);

    await waitFor(() => {
      expect(refreshStatsSpy).toHaveBeenCalledTimes(1);
    });
  });
});

