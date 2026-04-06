import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import TriangularBoard from '../components/board/TriangularBoard';
import type { Coordinates, GameStateResponse } from '../gameyApi';
import type { BoardCell } from '../gameyUi';
import { findWinningConnectionCellKeys } from '../gameyUi';
import { uiSx } from '../theme';

type Props = {
  game: GameStateResponse | null;
  board: BoardCell[][];
  canPlayCell: boolean;
  loading: boolean;
  hintCoords: Coordinates | null;
  resignCurrentGame: () => void;
  requestHint: () => Promise<boolean> | void;
  playCell: (coords: Coordinates) => Promise<void> | void;
  onBack: () => void;
};

const GameView: React.FC<Props> = ({
  game,
  board,
  canPlayCell,
  loading,
  hintCoords,
  resignCurrentGame,
  requestHint,
  playCell,
  onBack,
}) => {
  if (!game) return <div>No hay partida activa.</div>;

  const humanSymbol = game.yen?.players?.[0] ?? null;
  const hasWinner = game.game_over && game.winner !== null;
  const winningCellKeys = hasWinner ? findWinningConnectionCellKeys(game) : new Set<string>();
  const isHumanWinner = hasWinner && game.winner === 0;
  const outcomeTitle = !hasWinner ? 'Partida finalizada' : isHumanWinner ? 'Victoria' : 'Derrota';

  const canRequestHint = !loading && !game.game_over && canPlayCell;

  return (
    <Box sx={uiSx.centeredColumn}>
      {game.game_over && (
        <Box sx={uiSx.gameOutcomeBanner(isHumanWinner)}>
          <Typography sx={uiSx.gameOutcomeTitle}>{outcomeTitle}</Typography>
        </Box>
      )}

      <Typography variant="h5">Partida {game.game_id}</Typography>

      <Box sx={uiSx.gameBoardStage}>
        <Box sx={uiSx.gameBoardBase} />
        <TriangularBoard
          board={board}
          humanSymbol={humanSymbol}
          canPlayCell={canPlayCell}
          loading={loading}
          playCell={playCell}
          hintCoords={hintCoords}
          size={game.yen.size}
          winningCellKeys={winningCellKeys}
        />
      </Box>

      <Box sx={uiSx.gameActionsBox}>
        <Box sx={uiSx.centeredRow}>
          <Button
            variant="outlined"
            sx={uiSx.gameResignButton}
            onClick={resignCurrentGame}
            disabled={loading || game.game_over}
          >
            Rendirse
          </Button>

          <Button
            variant="contained"
            sx={uiSx.gameHintButton}
            onClick={requestHint}
            disabled={!canRequestHint}
          >
            Solicitar pista
          </Button>

          <Button sx={uiSx.gameBackButton} onClick={onBack}>Volver</Button>
        </Box>

        {hintCoords && (
          <Typography sx={uiSx.gameHintText}>
            Sugerencia: coloca en ({hintCoords.x}, {hintCoords.y}, {hintCoords.z})
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default GameView;
