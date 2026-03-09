import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import type React from 'react';
import GameView from '../views/GameView';

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
    game: {
      game_id: 'game-123',
      game_over: false,
      yen: { players: ['B'], size: 7 },
    },
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

  test('calls refresh, resign and back actions from buttons', async () => {
    const props = buildProps();
    render(<GameView {...props} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /refrescar/i }));
    await user.click(screen.getByRole('button', { name: /rendirse/i }));
    await user.click(screen.getByRole('button', { name: /volver/i }));

    expect(props.refreshCurrentGame).toHaveBeenCalledTimes(1);
    expect(props.resignCurrentGame).toHaveBeenCalledTimes(1);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  test('disables action buttons when loading or game is over', () => {
    const { rerender } = render(<GameView {...buildProps({ loading: true, game: { game_id: 'game-123', game_over: false, yen: { players: ['B'], size: 7 } } })} />);

    expect(screen.getByRole('button', { name: /refrescar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();

    rerender(<GameView {...buildProps({ loading: false, game: { game_id: 'game-123', game_over: true, yen: { players: ['B'], size: 7 } } })} />);
    expect(screen.getByRole('button', { name: /rendirse/i })).toBeDisabled();
  });
});
