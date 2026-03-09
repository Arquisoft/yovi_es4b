import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import TriangularBoard from '../components/board/TriangularBoard';
import type { Coordinates, GameStateResponse } from '../gameyApi';
import type { BoardCell } from '../gameyUi';
import { uiSx } from '../theme';

type Props = {
  game: GameStateResponse | null;
  board: BoardCell[][];
  statusText: string;
  canPlayCell: boolean;
  loading: boolean;
  refreshCurrentGame: () => void;
  resignCurrentGame: () => void;
  playCell: (coords: Coordinates) => Promise<void> | void;
  onBack: () => void;
};

const botLabels: Record<string, string> = {
  random_bot: 'muy facil',
  biased_random_bot: 'facil',
  greedy_bot: 'medio',
  minimax_bot: 'dificil',
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
          Bot: {botLabels[game.bot_id as string] ?? game.bot_id}
        </Typography>
      )}

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

          <Button onClick={onBack}>Volver</Button>
        </Box>
      </Box>
    </Box>
  );
};

export default GameView;
