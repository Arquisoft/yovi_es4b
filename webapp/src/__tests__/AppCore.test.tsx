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
  game: any | null;
  error: string | null;
  loading: boolean;
  board: any[];
  canPlayCell: boolean;
  statusText: string;
  setMode: (mode: 'human_vs_bot' | 'human_vs_human') => void;
  updateBoardSize: (size: number) => void;
  createNewGame: (next?: { mode?: 'human_vs_bot' | 'human_vs_human'; botId?: string }) => Promise<boolean>;
  refreshCurrentGame: () => void;
  resignCurrentGame: () => void;
  playCell: (coords: any) => void;
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
    game: {
      game_id: 'app-game',
      game_over: false,
      yen: { players: ['B'], size: 7 },
    },
    error: null,
    loading: false,
    board: [],
    canPlayCell: true,
    statusText: 'Turno',
    setMode: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn().mockResolvedValue(true),
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: vi.fn(),
    playCell: vi.fn(),
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
});
