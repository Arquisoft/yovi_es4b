import React from 'react';
import { cellClassName } from '../gameyUi';
import { Box, Typography, Button, Paper } from '@mui/material';

type Props = {
  game: any | null;
  board: any[];
  statusText: string;
  canPlayCell: boolean;
  loading: boolean;
  refreshCurrentGame: () => void;
  resignCurrentGame: () => void;
  playCell: (coords: any) => Promise<void> | void;
  onBack: () => void;
};

const cellSize = 40; // px

const GameView: React.FC<Props> = ({
  game,
  board,
  statusText,
  canPlayCell,
  loading,
  refreshCurrentGame,
  resignCurrentGame,
  playCell,
  onBack,
}) => {
  if (!game) return <div>No hay partida activa.</div>;

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <Typography variant="h5">Partida {game.game_id}</Typography>
      <Typography variant="body2" color="text.secondary">{statusText}</Typography>

      <Paper sx={{ p: 2, width: '100%', maxWidth: 760 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, justifyContent: 'center' }}>
          <Button variant="outlined" onClick={refreshCurrentGame} disabled={loading}>Refrescar</Button>
          <Button variant="contained" color="error" onClick={resignCurrentGame} disabled={loading || game.game_over}>Rendirse</Button>
          <Button variant="text" onClick={onBack}>Volver a configuración</Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          {board.map((row, rowIndex) => (
            <Box
              key={`row-${rowIndex}`}
              sx={{ display: 'flex', gap: 1, ml: `${(game.yen.size - rowIndex - 1) * 16}px` }}
            >
              {row.map((cell: any) => {
                const isEmpty = cell.symbol === '.';
                const color = cell.symbol === 'B' ? 'primary' : cell.symbol === 'R' ? 'error' : undefined;
                return (
                  <Button
                    key={cell.key}
                    variant={isEmpty ? 'outlined' : 'contained'}
                    color={color as any}
                    disabled={!isEmpty || !canPlayCell || loading}
                    onClick={() => void playCell(cell.coords)}
                    sx={{ minWidth: cellSize, minHeight: cellSize, borderRadius: 1 }}
                    title={`${cell.coords.x},${cell.coords.y},${cell.coords.z}`}
                  >
                    {isEmpty ? '.' : cell.symbol}
                  </Button>
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default GameView;
