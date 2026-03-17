import React from 'react';
import { Box } from '@mui/material';
import type { BoardCell } from '../../gameyUi';
import { toCoordsKey } from '../../gameyUi';
import { uiSx } from '../../theme';
import { BOARD_CELL_UI, buildFallbackRow, getBoardCellColor, isBoardCellPlayable } from './triangularBoardUi';

type PieceOwner = 'human' | 'opponent' | 'empty';

type Props = {
  board: BoardCell[][];
  playCell: (coords: { x: number; y: number; z: number }) => Promise<void> | void;
  canPlayCell: boolean;
  loading: boolean;
  humanSymbol: string | null;
  size: number;
  winningCellKeys?: Set<string>;
};

const CellView: React.FC<{
  color?: string;
  onClick?: () => void;
  clickable?: boolean;
  highlighted?: boolean;
  muted?: boolean;
  owner?: PieceOwner;
  testId?: string;
}> = ({
  color = BOARD_CELL_UI.colors.empty,
  onClick,
  clickable = false,
  highlighted = false,
  muted = false,
  owner = 'empty',
  testId,
}) => {
  return (
    <Box
      data-testid={testId}
      data-winning-cell={highlighted ? 'true' : undefined}
      data-muted-cell={muted ? 'true' : undefined}
      data-piece-owner={owner}
      onClick={clickable ? onClick : undefined}
      sx={uiSx.boardHex(color, clickable, highlighted, muted, owner)}
    />
  );
};

const TriangularBoard: React.FC<Props> = ({
  board,
  playCell,
  canPlayCell,
  loading,
  humanSymbol,
  size,
  winningCellKeys = new Set<string>(),
}) => {
  const rows = board;
  const hasWinningHighlight = winningCellKeys.size > 0;

  return (
    <Box sx={uiSx.boardContainer}>
      {Array.from({ length: size }).map((_, rowIndex) => {
        const row = rows[rowIndex] ?? buildFallbackRow(rowIndex);
        const firstCell = row[0];
        const fallbackRowKey = `${firstCell.coords.x}-${firstCell.coords.y}-${firstCell.coords.z}`;
        const rowKey = `row-${firstCell.key ?? fallbackRowKey}`;

        return (
          <Box key={rowKey} sx={uiSx.boardRow(size, rowIndex)}>
            {row.map((cell) => {
              const color = getBoardCellColor(cell.symbol, humanSymbol);
              const clickable = isBoardCellPlayable(cell.symbol, canPlayCell, loading);
              const cellKey = cell.key ?? `${cell.coords.x}-${cell.coords.y}-${cell.coords.z}`;
              const coordsKey = toCoordsKey(cell.coords);
              const isHighlighted = winningCellKeys.has(coordsKey);
              const isOccupied = cell.symbol !== BOARD_CELL_UI.emptySymbol;
              const owner: PieceOwner = !isOccupied
                ? 'empty'
                : humanSymbol && cell.symbol === humanSymbol
                  ? 'human'
                  : 'opponent';
              const isMuted = hasWinningHighlight && isOccupied && !isHighlighted;
              const handleClick = () => {
                if (!clickable) return;
                playCell(cell.coords);
              };

              return (
                <CellView
                  key={cellKey}
                  testId={`hex-${cellKey}`}
                  clickable={clickable}
                  color={color}
                  highlighted={isHighlighted}
                  muted={isMuted}
                  owner={owner}
                  onClick={handleClick}
                />
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

export default TriangularBoard;
