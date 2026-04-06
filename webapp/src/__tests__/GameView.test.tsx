import { fireEvent, render, screen } from '@testing-library/react';
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
    hintCoords: null,
    loading: false,
    resignCurrentGame: vi.fn(),
    requestHint: vi.fn(),
    playCell: vi.fn(),
    onBack: vi.fn(),
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
  test('shows empty-state message when there is no active game', () => {
    render(<GameView {...buildProps({ game: null })} />);

    expect(screen.getByText(/no hay partida activa/i)).toBeInTheDocument();
  });

  test('renders game info and passes board props to TriangularBoard', () => {
    render(<GameView {...buildProps()} />);

    expect(screen.getByText(/partida game-123/i)).toBeInTheDocument();

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

  test('calls resign, hint and back actions from buttons', () => {
    const requestHint = vi.fn();
    const props = buildProps({ requestHint });
    render(<GameView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /rendirse/i }));
    fireEvent.click(screen.getByRole('button', { name: /solicitar pista/i }));
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(props.resignCurrentGame).toHaveBeenCalledTimes(1);
    expect(requestHint).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  test('disables action buttons when loading or game is over', () => {
    const { rerender } = render(<GameView {...buildProps({ loading: true, game: buildGame() })} />);

    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();

    rerender(<GameView {...buildProps({ loading: false, game: buildGame({ game_over: true }) })} />);
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();
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

  test('shows hint text when hint coordinates are available', () => {
    render(
      <GameView
        {...buildProps({
          hintCoords: { x: 1, y: 1, z: -2 },
        })}
      />,
    );

    expect(screen.getByText(/sugerencia:/i)).toBeInTheDocument();
    expect(screen.getByText(/1, 1, -2/)).toBeInTheDocument();
  });
});
