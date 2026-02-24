import React from 'react';
import { Box } from "@mui/material";
import type { BoardCell } from '../gameyUi';

type Props = {
  board: BoardCell[][];
  playCell: (coords: { x: number; y: number; z: number }) => Promise<void> | void;
  canPlayCell: boolean;
  loading: boolean;
  humanSymbol: string | null;
  size: number;
};

const Hex: React.FC<{
  color?: string;
  onClick?: () => void;
  clickable?: boolean;
}> = ({ color = "#e8e2d6", onClick, clickable = false }) => {
  return (
    <Box
      onClick={clickable ? onClick : undefined}
      sx={{
        width: 48,
        height: 56,
        backgroundColor: color,
        margin: "4px",
        clipPath: `polygon(
          50% 0%, 
          100% 25%, 
          100% 75%, 
          50% 100%, 
          0% 75%, 
          0% 25%
        )`,
        transition: "0.12s",
        display: 'inline-block',
        '&:hover': clickable ? { filter: 'brightness(0.92)', cursor: 'pointer' } : {},
      }}
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
}) => {
  const rows = board && board.length ? board : [];

  function cellColor(symbol: string | undefined) {
    if (!symbol || symbol === '.' ) return '#e8e2d6';
    if (humanSymbol && symbol === humanSymbol) return '#4caf50';
    // other player / bot
    return '#ff5252';
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 2,
      }}
    >
      {Array.from({ length: size }).map((_, rowIndex) => {
        const row = rows[rowIndex] ?? Array.from({ length: rowIndex + 1 }).map((_, col) => ({ key: `${rowIndex}-${col}`, symbol: '.', coords: { x: 0, y: 0, z: 0 } }));
        return (
          <Box
            key={rowIndex}
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: "-14px",
              ml: `${(size - (rowIndex + 1))}px`,
            }}
          >
            {row.map((cell, colIndex) => {
              const color = cellColor(cell.symbol);
              const clickable = canPlayCell && !loading && (cell.symbol === '.' || cell.symbol === undefined);
              const handleClick = () => {
                if (!clickable) return;
                playCell(cell.coords);
              };

              return (
                <Hex
                  key={cell.key ?? `${rowIndex}-${colIndex}`}
                  color={color}
                  onClick={handleClick}
                  clickable={clickable}
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