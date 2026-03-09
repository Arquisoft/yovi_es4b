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
  }) => (
    <div data-testid="triangular-board-mock">
      {JSON.stringify({
        humanSymbol: props.humanSymbol,
        size: props.size,
        canPlayCell: props.canPlayCell,
        loading: props.loading,
      })}
    </div>
  ),
}));

function buildProps(overrides: Partial<React.ComponentProps<typeof GameView>> = {}): React.ComponentProps<typeof GameView> {
  return {
    game: buildGame(),
    board: [],
    statusText: 'Turno: Player 0 (B)',
    canPlayCell: true,
    loading: false,
    refreshCurrentGame: vi.fn(),
    resignCurrentGame: vi.fn(),
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
    expect(screen.getByText(/turno: player 0 \(b\)/i)).toBeInTheDocument();

    const boardProps = screen.getByTestId('triangular-board-mock');
    expect(boardProps).toHaveTextContent('"humanSymbol":"B"');
    expect(boardProps).toHaveTextContent('"size":7');
    expect(boardProps).toHaveTextContent('"canPlayCell":true');
    expect(boardProps).toHaveTextContent('"loading":false');
  });

  test('renders bot label using mapped difficulty name and raw fallback id', () => {
    const { rerender } = render(
      <GameView
        {...buildProps({
          game: buildGame({
            bot_id: 'minimax_bot',
          }),
        })}
      />,
    );

    expect(screen.getByText(/bot: dificil/i)).toBeInTheDocument();

    rerender(
      <GameView
        {...buildProps({
          game: buildGame({
            bot_id: 'custom_bot',
          }),
        })}
      />,
    );

    expect(screen.getByText(/bot: custom_bot/i)).toBeInTheDocument();
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

  test('calls refresh, resign and back actions from buttons', () => {
    const props = buildProps();
    render(<GameView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /refrescar/i }));
    fireEvent.click(screen.getByRole('button', { name: /rendirse/i }));
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(props.refreshCurrentGame).toHaveBeenCalledTimes(1);
    expect(props.resignCurrentGame).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  test('disables action buttons when loading or game is over', () => {
    const { rerender } = render(<GameView {...buildProps({ loading: true, game: buildGame() })} />);

    expect(screen.getByRole('button', { name: /refrescar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();

    rerender(<GameView {...buildProps({ loading: false, game: buildGame({ game_over: true }) })} />);
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();
  });

  test('keeps refresh enabled when the game is over but not loading', () => {
    render(
      <GameView
        {...buildProps({
          loading: false,
          game: buildGame({ game_over: true }),
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /refrescar/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();
  });
});
