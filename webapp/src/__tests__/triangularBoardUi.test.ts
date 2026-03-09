import { describe, expect, test } from 'vitest';
import { buildFallbackRow, getBoardCellColor, isBoardCellPlayable } from '../views/triangularBoardUi';

describe('triangularBoardUi helpers', () => {
  test('returns correct color for empty, human, and opponent cells', () => {
    const emptyColor = getBoardCellColor('.', 'B');
    const humanColor = getBoardCellColor('B', 'B');
    const opponentColor = getBoardCellColor('R', 'B');

    expect(emptyColor).not.toEqual(humanColor);
    expect(humanColor).not.toEqual(opponentColor);
    expect(emptyColor).not.toEqual(opponentColor);
  });

  test('marks cell as playable only when empty and player can act', () => {
    expect(isBoardCellPlayable('.', true, false)).toBe(true);
    expect(isBoardCellPlayable(undefined, true, false)).toBe(true);

    expect(isBoardCellPlayable('B', true, false)).toBe(false);
    expect(isBoardCellPlayable('.', false, false)).toBe(false);
    expect(isBoardCellPlayable('.', true, true)).toBe(false);
  });

  test('builds fallback rows with triangular shape and default coords', () => {
    const row0 = buildFallbackRow(0);
    const row2 = buildFallbackRow(2);

    expect(row0).toHaveLength(1);
    expect(row2).toHaveLength(3);

    for (const cell of row2) {
      expect(cell.symbol).toBe('.');
      expect(cell.coords).toEqual({ x: 0, y: 0, z: 0 });
    }
  });
});
