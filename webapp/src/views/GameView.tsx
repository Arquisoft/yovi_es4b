import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

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

  const humanSymbol = game.yen?.players?.[0] ?? null;

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
                let color: any = undefined;
                if (!isEmpty) {
                  // color green for cells owned by the local player (player 0), red for opponent
                  color = cell.symbol === humanSymbol ? 'success' : 'error';
                }

                return (
                  <Button
                    key={cell.key}
                    variant={isEmpty ? 'outlined' : 'contained'}
                    color={color}
                    // only disable empty cells when the player cannot play or loading
                    disabled={isEmpty ? (!canPlayCell || loading) : false}
                    onClick={isEmpty ? () => void playCell(cell.coords) : undefined}
                    sx={{ minWidth: cellSize, minHeight: cellSize, borderRadius: 1, p: 0 }}
                    title={`${cell.coords.x},${cell.coords.y},${cell.coords.z}`}
                  >
                    {isEmpty ? null : <FiberManualRecordIcon fontSize="small" />}
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
