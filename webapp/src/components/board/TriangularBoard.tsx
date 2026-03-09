import React from 'react';
import { Box } from '@mui/material';
import type { BoardCell } from '../../gameyUi';
import { uiSx } from '../../theme';
import { BOARD_CELL_UI, buildFallbackRow, getBoardCellColor, isBoardCellPlayable } from './triangularBoardUi';

type Props = {
  board: BoardCell[][];
  playCell: (coords: { x: number; y: number; z: number }) => Promise<void> | void;
  canPlayCell: boolean;
  loading: boolean;
  humanSymbol: string | null;
  size: number;
};

const CellView: React.FC<{
  color?: string;
  onClick?: () => void;
  clickable?: boolean;
}> = ({ color = BOARD_CELL_UI.colors.empty, onClick, clickable = false }) => {
  return <Box onClick={clickable ? onClick : undefined} sx={uiSx.boardHex(color, clickable)} />;
};

const TriangularBoard: React.FC<Props> = ({ board, playCell, canPlayCell, loading, humanSymbol, size }) => {
  const rows = board && board.length ? board : [];

  return (
    <Box sx={uiSx.boardContainer}>
      {Array.from({ length: size }).map((_, rowIndex) => {
        const row = rows[rowIndex] ?? buildFallbackRow(rowIndex);

        return (
          <Box key={rowIndex} sx={uiSx.boardRow(size, rowIndex)}>
            {row.map((cell, colIndex) => {
              const color = getBoardCellColor(cell.symbol, humanSymbol);
              const clickable = isBoardCellPlayable(cell.symbol, canPlayCell, loading);
              const handleClick = () => {
                if (!clickable) return;
                playCell(cell.coords);
              };

              return (
                <CellView
                  key={cell.key ?? `${rowIndex}-${colIndex}`}
                  clickable={clickable}
                  color={color}
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
