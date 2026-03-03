import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import TriangularBoard from '../views/TriangularBoard';
import type { BoardCell } from '../gameyUi';

function buildBoard(): BoardCell[][] {
  return [
    [
      { key: '0-0', symbol: '.', coords: { x: 2, y: 0, z: -2 } },
    ],
    [
      { key: '1-0', symbol: '.', coords: { x: 1, y: 0, z: -1 } },
      { key: '1-1', symbol: 'B', coords: { x: 1, y: 1, z: -2 } },
    ],
  ];
}

describe('TriangularBoard', () => {
  test('renders fallback triangular rows when board is empty', () => {
    render(
      <TriangularBoard
        board={[]}
        playCell={vi.fn()}
        canPlayCell={true}
        loading={false}
        humanSymbol={'B'}
        size={3}
      />,
    );

    expect(screen.getAllByTestId(/hex-/i)).toHaveLength(6);
  });

  test('calls playCell when clicking an empty playable cell', async () => {
    const playCell = vi.fn();
    const user = userEvent.setup();

    render(
      <TriangularBoard
        board={buildBoard()}
        playCell={playCell}
        canPlayCell={true}
        loading={false}
        humanSymbol={'B'}
        size={2}
      />,
    );

    await user.click(screen.getByTestId('hex-0-0'));

    expect(playCell).toHaveBeenCalledWith({ x: 2, y: 0, z: -2 });
  });

  test('does not call playCell when cell is occupied or board is not playable', async () => {
    const playCell = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <TriangularBoard
        board={buildBoard()}
        playCell={playCell}
        canPlayCell={true}
        loading={false}
        humanSymbol={'B'}
        size={2}
      />,
    );

    await user.click(screen.getByTestId('hex-1-1'));
    expect(playCell).not.toHaveBeenCalled();

    rerender(
      <TriangularBoard
        board={buildBoard()}
        playCell={playCell}
        canPlayCell={false}
        loading={false}
        humanSymbol={'B'}
        size={2}
      />,
    );

    await user.click(screen.getByTestId('hex-0-0'));
    expect(playCell).not.toHaveBeenCalled();
  });
});
