import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import App from '../App';

type AuthMock = {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  loading: boolean;
  login: (token: string, username: string) => void;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
};

type GameyMock = {
  boardSize: number;
  mode: 'human_vs_bot' | 'human_vs_human';
  botDifficulty: 'very_easy' | 'easy' | 'medium' | 'hard';
  game: { game_id: string; game_over: boolean; yen: { players: string[]; size: number } } | null;
  error: string | null;
  loading: boolean;
  restoringSession: boolean;
  hasActiveGameInProgress: boolean;
  gameIdPendingAutomaticOpen: string | null;
  board: unknown[];
  canPlayCell: boolean;
  statusText: string;
  myPlayerId: number | null;
  matchmakingTicketId: string | null;
  matchmakingStatus: 'idle' | 'waiting' | 'matched' | 'cancelled';
  matchmakingPosition: number | null;
  setMode: (mode: 'human_vs_bot' | 'human_vs_human') => void;
  setBotDifficulty: (difficulty: 'very_easy' | 'easy' | 'medium' | 'hard') => void;
  updateBoardSize: (size: number) => void;
  createNewGame: (next?: { mode?: 'human_vs_bot' | 'human_vs_human'; botId?: string }) => Promise<boolean>;
  startMatchmaking: () => void;
  cancelCurrentMatchmaking: () => void;
  refreshCurrentGame: () => void;
  resignCurrentGame: () => void;
  playCell: (coords: unknown) => void;
  acknowledgeAutomaticGameOpen: () => void;
};

let authState: AuthMock;
let gameyState: GameyMock;

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../useGamey', () => ({
  useGamey: () => gameyState,
}));

function buildAuth(overrides: Partial<AuthMock> = {}): AuthMock {
  return {
    isAuthenticated: true,
    token: 'fake-token',
    username: 'adri',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    getAuthHeader: () => ({}),
    ...overrides,
  };
}

function buildGamey(overrides: Partial<GameyMock> = {}): GameyMock {
  return {
    boardSize: 7,
    mode: 'human_vs_bot',
    botDifficulty: 'easy',
    game: {
      game_id: 'app-game',
      game_over: false,
      yen: { players: ['B'], size: 7 },
    },
    error: null,
    loading: false,
    restoringSession: false,
    hasActiveGameInProgress: false,
    gameIdPendingAutomaticOpen: null,
    board: [],
    canPlayCell: true,
    statusText: 'Turno',
    myPlayerId: null,
    matchmakingTicketId: null,
    matchmakingStatus: 'idle',
    matchmakingPosition: null,
    setMode: vi.fn(),
    setBotDifficulty: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn().mockResolvedValue(true),
    startMatchmaking: vi.fn(),
    cancelCurrentMatchmaking: vi.fn(),
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: vi.fn(),
    playCell: vi.fn(),
    acknowledgeAutomaticGameOpen: vi.fn(),
    ...overrides,
  };
}

describe('App core flows', () => {
  beforeEach(() => {
    authState = buildAuth();
    gameyState = buildGamey();
  });

  test('renders nothing while auth is loading', () => {
    authState = buildAuth({ loading: true });

    const { container } = render(<App />);

    expect(container).toBeEmptyDOMElement();
  });

  test('shows login view when user is not authenticated', () => {
    authState = buildAuth({ isAuthenticated: false, token: null, username: null });

    render(<App />);

    expect(screen.getByText(/welcome to gamey/i)).toBeInTheDocument();
  });

  test('shows global error alert when game hook returns an error', () => {
    gameyState = buildGamey({ error: 'Boom game error' });

    render(<App />);

    expect(screen.getByText(/boom game error/i)).toBeInTheDocument();
  });

  test('creates game from dashboard and navigates to game view', async () => {
    const createNewGame = vi.fn().mockResolvedValue(true);
    gameyState = buildGamey({ createNewGame });

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /crear partida/i }));

    await waitFor(() => {
      expect(createNewGame).toHaveBeenCalledWith();
      expect(screen.getByText(/partida app-game/i)).toBeInTheDocument();
    });
  });

  test('opens the game view when restoring an online game', async () => {
    gameyState = buildGamey({ gameIdPendingAutomaticOpen: 'app-game' });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/partida app-game/i)).toBeInTheDocument();
    });

    expect(gameyState.acknowledgeAutomaticGameOpen).toHaveBeenCalledTimes(1);
  });

  test('shows a resume button in play menu when there is an active game', async () => {
    gameyState = buildGamey({ hasActiveGameInProgress: true });

    render(<App />);
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: /volver a la partida/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /volver a la partida/i }));

    await waitFor(() => {
      expect(screen.getByText(/partida app-game/i)).toBeInTheDocument();
    });
  });
});
