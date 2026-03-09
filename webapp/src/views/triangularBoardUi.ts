import type { BoardCell } from '../gameyUi';
import { uiColors } from '../theme';

export const BOARD_CELL_UI = {
  emptySymbol: '.',
  colors: {
    empty: uiColors.board.empty,
    human: uiColors.board.human,
    opponent: uiColors.board.opponent,
  },
} as const;

export function getBoardCellColor(symbol: string | undefined, humanSymbol: string | null): string {
  if (!symbol || symbol === BOARD_CELL_UI.emptySymbol) return BOARD_CELL_UI.colors.empty;
  if (humanSymbol && symbol === humanSymbol) return BOARD_CELL_UI.colors.human;
  return BOARD_CELL_UI.colors.opponent;
}

export function isBoardCellPlayable(symbol: string | undefined, canPlayCell: boolean, loading: boolean): boolean {
  const isEmpty = symbol === BOARD_CELL_UI.emptySymbol || symbol === undefined;
  return canPlayCell && !loading && isEmpty;
}

export function buildFallbackRow(rowIndex: number): BoardCell[] {
  return Array.from({ length: rowIndex + 1 }).map((_, col) => ({
    key: `${rowIndex}-${col}`,
    symbol: BOARD_CELL_UI.emptySymbol,
    coords: { x: 0, y: 0, z: 0 },
  }));
}
