import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import TriangularBoard from './TriangularBoard';
import { uiSx } from '../theme';

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
    <Box sx={uiSx.centeredColumn}>
      <Typography variant="h5">Partida {game.game_id}</Typography>

      <Typography variant="body2" color="text.secondary">
        {statusText}
      </Typography>

      <Paper sx={uiSx.panel(760)}>
        <Box sx={[uiSx.centeredRow, { mb: 2 }]}>
          <Button variant="outlined" onClick={refreshCurrentGame} disabled={loading}>
            Refrescar
          </Button>

          <Button variant="contained" color="error" onClick={resignCurrentGame} disabled={loading || game.game_over}>
            Rendirse
          </Button>

          <Button variant="text" onClick={onBack}>
            Volver a configuracion
          </Button>
        </Box>

        <TriangularBoard
          board={board}
          humanSymbol={humanSymbol}
          canPlayCell={canPlayCell}
          loading={loading}
          playCell={playCell}
          size={game.yen.size}
        />
      </Paper>
    </Box>
  );
};

export default GameView;
