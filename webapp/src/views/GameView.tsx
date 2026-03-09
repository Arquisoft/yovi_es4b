import React from 'react';
import { Box, Typography, Button } from '@mui/material';
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

{game.bot_id && (
  <Typography variant="body2" color="text.secondary">
    Bot: {
      {
        random_bot: 'muy fácil',
        biased_random_bot: 'fácil',
        greedy_bot: 'medio',
        minimax_bot: 'difícil',
      }[game.bot_id as string] || game.bot_id
    }
  </Typography>
)}

      <Typography variant="body2" color="text.secondary">
        {statusText}
      </Typography>

      <Box sx={uiSx.gameBoardStage}>
        <Box sx={uiSx.gameBoardBase} />
        <TriangularBoard
          board={board}
          humanSymbol={humanSymbol}
          canPlayCell={canPlayCell}
          loading={loading}
          playCell={playCell}
          size={game.yen.size}
        />
      </Box>

      <Box sx={uiSx.gameActionsBox}>
        <Box sx={uiSx.centeredRow}>
          <Button onClick={refreshCurrentGame} disabled={loading}>
            Refrescar
          </Button>

          <Button color="error" onClick={resignCurrentGame} disabled={loading || game.game_over}>
            Rendirse
          </Button>

          <Button onClick={onBack}>
            Volver
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default GameView;
