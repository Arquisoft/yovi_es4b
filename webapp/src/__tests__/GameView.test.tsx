import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import type React from 'react';
import GameView from '../views/GameView';
import type { GameStateResponse } from '../gameyApi';

vi.mock('../components/board/TriangularBoard', () => ({
  default: (props: {
    humanSymbol: string | null;
    size: number;
    canPlayCell: boolean;
    loading: boolean;
    winningCellKeys?: Set<string>;
  }) => (
    <div data-testid="triangular-board-mock">
      {JSON.stringify({
        humanSymbol: props.humanSymbol,
        size: props.size,
        canPlayCell: props.canPlayCell,
        loading: props.loading,
        winningCellKeysSize: props.winningCellKeys?.size ?? 0,
      })}
    </div>
  ),
}));

function buildProps(overrides: Partial<React.ComponentProps<typeof GameView>> = {}): React.ComponentProps<typeof GameView> {
  return {
    game: buildGame(),
    board: [],
    canPlayCell: true,
    loading: false,
    resignCurrentGame: vi.fn(),
    passCurrentTurn: vi.fn(),
    playCell: vi.fn(),
    ...overrides,
  };
}

function buildGame(overrides: Partial<GameStateResponse> = {}): GameStateResponse {
  return {
    api_version: '1.0.0',
    game_id: 'game-123',
    mode: 'human_vs_bot',
    bot_id: null,
    yen: {
      size: 7,
      turn: 0,
      players: ['B', 'R'],
      layout: 'B/R',
    },
    game_over: false,
    next_player: 0,
    winner: null,
    ...overrides,
  };
}

describe('GameView', () => {
  test('auto-passes the turn when the fallback local countdown reaches zero', () => {
    vi.useFakeTimers();

    const passCurrentTurn = vi.fn();
    render(
      <GameView
        {...buildProps({
          game: buildGame({
            mode: 'human_vs_human',
            next_player: 0,
          }),
          passCurrentTurn,
        })}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(30_250);
    });

    expect(passCurrentTurn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test('shows empty-state message when there is no active game', () => {
    render(<GameView {...buildProps({ game: null })} />);

    expect(screen.getByText(/no hay partida activa/i)).toBeInTheDocument();
  });

  test('renders game info and passes board props to TriangularBoard', () => {
    render(<GameView {...buildProps()} />);

    expect(screen.getByText(/partida game-123/i)).toBeInTheDocument();
    expect(screen.getByText(/^rival: bot$/i)).toBeInTheDocument();
    expect(screen.getByText(/tu turno/i)).toBeInTheDocument();
    expect(screen.getByText('00:30')).toBeInTheDocument();

    const boardProps = screen.getByTestId('triangular-board-mock');
    expect(boardProps).toHaveTextContent('"humanSymbol":"B"');
    expect(boardProps).toHaveTextContent('"size":7');
    expect(boardProps).toHaveTextContent('"canPlayCell":true');
    expect(boardProps).toHaveTextContent('"loading":false');
  });

  test('does not render status or bot helper phrases', () => {
    render(
      <GameView
        {...buildProps({
          game: buildGame({
            bot_id: 'minimax_bot',
          }),
        })}
      />,
    );

    expect(screen.queryByText(/turno:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^bot:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^rival: bot dificil$/i)).toBeInTheDocument();
  });

  test('passes null human symbol when players are missing', () => {
    render(
      <GameView
        {...buildProps({
          game: buildGame({
            yen: { size: 7, turn: 0, players: [], layout: 'B/R' },
          }),
        })}
      />,
    );

    expect(screen.getByTestId('triangular-board-mock')).toHaveTextContent('"humanSymbol":null');
  });

  test('calls resign and pass-turn actions from their buttons', () => {
    const props = buildProps();
    render(<GameView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /ceder turno/i }));
    fireEvent.click(screen.getByRole('button', { name: /rendirse/i }));

    expect(props.passCurrentTurn).toHaveBeenCalledTimes(1);
    expect(props.resignCurrentGame).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument();
  });

  test('disables action buttons when loading or game is over', () => {
    const { rerender } = render(<GameView {...buildProps({ loading: true, game: buildGame() })} />);

    expect(screen.getByRole('button', { name: /ceder turno/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();

    rerender(<GameView {...buildProps({ loading: false, game: buildGame({ game_over: true }) })} />);
    expect(screen.getByRole('button', { name: /ceder turno/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();
  });

  test('disables pass turn when the current user cannot act', () => {
    render(<GameView {...buildProps({ canPlayCell: false })} />);

    expect(screen.getByRole('button', { name: /ceder turno/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeEnabled();
  });

  test('shows victory state and highlights the winning connection component', () => {
    render(
      <GameView
        {...buildProps({
          game: buildGame({
            game_over: true,
            winner: 0,
            yen: {
              size: 3,
              turn: 0,
              players: ['B', 'R'],
              layout: 'B/BB/BBR',
            },
          }),
        })}
      />,
    );

    expect(screen.getByText(/^victoria$/i)).toBeInTheDocument();
    expect(screen.getByTestId('triangular-board-mock')).toHaveTextContent('"winningCellKeysSize":5');
  });

  test('shows defeat state when the opponent wins', () => {
    render(
      <GameView
        {...buildProps({
          game: buildGame({
            game_over: true,
            winner: 1,
            yen: {
              size: 3,
              turn: 1,
              players: ['B', 'R'],
              layout: 'R/RR/RRB',
            },
          }),
        })}
      />,
    );

    expect(screen.getByText(/^derrota$/i)).toBeInTheDocument();
  });

  test('uses myPlayerId to resolve winner and local symbol in online games', () => {
    render(
      <GameView
        {...buildProps({
          currentUserId: 'jose',
          myPlayerId: 1,
          game: buildGame({
            mode: 'human_vs_human',
            game_over: true,
            winner: 1,
            player0_user_id: 'fernando',
            player1_user_id: 'jose',
            yen: {
              size: 3,
              turn: 1,
              players: ['B', 'R'],
              layout: 'R/RR/RRB',
            },
          }),
        })}
      />,
    );

    expect(screen.getByText(/^victoria$/i)).toBeInTheDocument();
    expect(screen.getByText(/^rival: fernando$/i)).toBeInTheDocument();
    expect(screen.getByTestId('triangular-board-mock')).toHaveTextContent('"humanSymbol":"R"');
  });

  test('shows the opponent inactivity countdown while waiting for an online rival that stopped responding', () => {
    render(
      <GameView
        {...buildProps({
          currentUserId: 'jose',
          myPlayerId: 1,
          game: buildGame({
            mode: 'human_vs_human',
            next_player: 0,
            player0_user_id: 'fernando',
            player1_user_id: 'jose',
            opponent_inactivity_timeout_remaining_ms: 45_000,
            turn_timeout_remaining_ms: 42_000,
          }),
        })}
      />,
    );

    expect(screen.getByText(/rival desconectado/i)).toBeInTheDocument();
    expect(screen.getByText('00:45')).toBeInTheDocument();
    expect(screen.getByText(/ganaras por abandono/i)).toBeInTheDocument();
    expect(screen.queryByText(/turno del rival/i)).not.toBeInTheDocument();
  });

  test('shows the turn countdown while waiting for the rival move when they are still connected', () => {
    render(
      <GameView
        {...buildProps({
          currentUserId: 'jose',
          myPlayerId: 1,
          canPlayCell: false,
          game: buildGame({
            mode: 'human_vs_human',
            next_player: 0,
            player0_user_id: 'fernando',
            player1_user_id: 'jose',
            opponent_inactivity_timeout_remaining_ms: 59_000,
            turn_timeout_remaining_ms: 45_000,
          }),
        })}
      />,
    );

    expect(screen.getByText(/turno del rival/i)).toBeInTheDocument();
    expect(screen.getByText('00:45')).toBeInTheDocument();
    expect(screen.getByText(/cedera el turno automaticamente/i)).toBeInTheDocument();
  });

  test('shows the turn countdown during the local player turn in online games', () => {
    render(
      <GameView
        {...buildProps({
          currentUserId: 'jose',
          myPlayerId: 1,
          canPlayCell: true,
          game: buildGame({
            mode: 'human_vs_human',
            next_player: 1,
            player0_user_id: 'fernando',
            player1_user_id: 'jose',
            turn_timeout_remaining_ms: 48_000,
          }),
        })}
      />,
    );

    expect(screen.getByText(/tu turno/i)).toBeInTheDocument();
    expect(screen.getByText('00:48')).toBeInTheDocument();
    expect(screen.getByText(/cederas el turno automaticamente/i)).toBeInTheDocument();
  });

  test('shows a fallback countdown in local human-vs-human games', () => {
    render(
      <GameView
        {...buildProps({
          game: buildGame({
            mode: 'human_vs_human',
            next_player: 1,
          }),
        })}
      />,
    );

    expect(screen.getByText(/turno del jugador 2/i)).toBeInTheDocument();
    expect(screen.getByText('00:30')).toBeInTheDocument();
    expect(screen.getByText(/se cedera el turno automaticamente/i)).toBeInTheDocument();
  });

  test('hides the local countdown while waiting for the bot response', () => {
    render(
      <GameView
        {...buildProps({
          loading: true,
          game: buildGame({
            mode: 'human_vs_bot',
            bot_id: 'greedy_bot',
            next_player: 0,
          }),
        })}
      />,
    );

    expect(screen.queryByText(/tu turno/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^rival: bot intermedio$/i)).toBeInTheDocument();
  });

  test('resolves opponent by current user when myPlayerId is missing', () => {
    render(
      <GameView
        {...buildProps({
          currentUserId: 'fernando',
          myPlayerId: null,
          game: buildGame({
            mode: 'human_vs_human',
            player0_user_id: 'fernando',
            player1_user_id: 'jose',
          }),
        })}
      />,
    );

    expect(screen.getByText(/^rival: jose$/i)).toBeInTheDocument();
  });
});
