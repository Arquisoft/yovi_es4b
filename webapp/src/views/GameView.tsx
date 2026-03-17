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
  myPlayerId?: number | null;
  currentUserId?: string | null;
  resignCurrentGame: () => void;
  playCell: (coords: Coordinates) => Promise<void> | void;
  onBack: () => void;
};

const GameView: React.FC<Props> = ({
  game,
  board,
  canPlayCell,
  loading,
  myPlayerId = null,
  currentUserId = null,
  resignCurrentGame,
  playCell,
  onBack,
}) => {
  if (!game) return <div>No hay partida activa.</div>;

  const resolvedHumanPlayerId = myPlayerId ?? 0;
  const humanSymbol = game.yen?.players?.[resolvedHumanPlayerId] ?? game.yen?.players?.[0] ?? null;
  const hasWinner = game.game_over && game.winner !== null;
  const winningCellKeys = hasWinner ? findWinningConnectionCellKeys(game) : new Set<string>();
  const isHumanWinner = hasWinner && game.winner === resolvedHumanPlayerId;
  const outcomeTitle = !hasWinner ? 'Partida finalizada' : isHumanWinner ? 'Victoria' : 'Derrota';
  const player0UserId = game.player0_user_id?.trim() || null;
  const player1UserId = game.player1_user_id?.trim() || null;
  const normalizedCurrentUser = currentUserId?.trim().toLowerCase() || null;
  const currentIsPlayer0 = normalizedCurrentUser !== null && player0UserId?.toLowerCase() === normalizedCurrentUser;
  const currentIsPlayer1 = normalizedCurrentUser !== null && player1UserId?.toLowerCase() === normalizedCurrentUser;
  const rawOpponentUserId = currentIsPlayer0
    ? player1UserId
    : currentIsPlayer1
      ? player0UserId
      : resolvedHumanPlayerId === 0
        ? player1UserId
        : player0UserId;
  const shouldShowOpponent = player0UserId !== null || player1UserId !== null;
  const opponentUserId = rawOpponentUserId || (player1UserId ?? player0UserId);
  const opponentLabel = opponentUserId ?? 'desconocido';

  return (
    <Box sx={uiSx.centeredColumn}>
      {game.game_over && (
        <Box sx={uiSx.gameOutcomeBanner(isHumanWinner)}>
          <Typography sx={uiSx.gameOutcomeTitle}>{outcomeTitle}</Typography>
        </Box>
      )}

      {shouldShowOpponent && (
        <Typography variant="subtitle1">Rival: {opponentLabel}</Typography>
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
          size={game.yen.size}
          winningCellKeys={winningCellKeys}
        />
      </Box>

      <Box sx={uiSx.gameActionsBox}>
        <Box sx={uiSx.centeredRow}>
          <Button variant="outlined" sx={uiSx.gameResignButton} onClick={resignCurrentGame} disabled={loading || game.game_over}>
            Rendirse
          </Button>

          <Button sx={uiSx.gameBackButton} onClick={onBack}>Volver</Button>
        </Box>
      </Box>
    </Box>
  );
};

export default GameView;
