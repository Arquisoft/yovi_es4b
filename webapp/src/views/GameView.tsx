import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import TriangularBoard from '../components/board/TriangularBoard';
import type { Coordinates, GameStateResponse } from '../gameyApi';
import type { BoardCell } from '../gameyUi';
import { findWinningConnectionCellKeys } from '../gameyUi';
import { uiSx } from '../theme';

const OPPONENT_INACTIVITY_COUNTDOWN_VISIBILITY_THRESHOLD_MS = 55_000;
const OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS = 60_000;

type GameOutcomeBannerTone = 'accent' | 'success' | 'danger';

function getOutcomeTitle(hasWinner: boolean, isHumanWinner: boolean): string {
  if (!hasWinner) {
    return 'Partida finalizada';
  }

  return isHumanWinner ? 'Victoria' : 'Derrota';
}

function getOutcomeDetail(game: GameStateResponse): string | null {
  if (game.completion_reason === 'disconnect_timeout') {
    return 'La partida termino por abandono tras mas de un minuto sin conexion.';
  }

  if (game.completion_reason === 'resignation') {
    return 'La partida termino por rendicion.';
  }

  return null;
}

function resolveOpponentUserId(
  currentIsPlayer0: boolean,
  currentIsPlayer1: boolean,
  resolvedHumanPlayerId: number,
  player0UserId: string | null,
  player1UserId: string | null,
): string | null {
  if (currentIsPlayer0) {
    return player1UserId;
  }

  if (currentIsPlayer1) {
    return player0UserId;
  }

  return resolvedHumanPlayerId === 0 ? player1UserId : player0UserId;
}

function getOutcomeBannerTone(
  game: GameStateResponse,
  isHumanWinner: boolean,
): GameOutcomeBannerTone {
  if (game.completion_reason === 'disconnect_timeout') {
    return 'accent';
  }

  return isHumanWinner ? 'success' : 'danger';
}

type Props = {
  game: GameStateResponse | null;
  board: BoardCell[][];
  canPlayCell: boolean;
  loading: boolean;
  myPlayerId?: number | null;
  currentUserId?: string | null;
  resignCurrentGame: () => void;
  playCell: (coords: Coordinates) => Promise<void> | void;
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
}) => {
  const [displayedOpponentInactivityTimeoutRemainingMs, setDisplayedOpponentInactivityTimeoutRemainingMs] =
    React.useState<number | null>(game?.opponent_inactivity_timeout_remaining_ms ?? null);

  React.useEffect(() => {
    const nextRemainingMs = game?.opponent_inactivity_timeout_remaining_ms ?? null;
    if (typeof nextRemainingMs !== 'number') {
      setDisplayedOpponentInactivityTimeoutRemainingMs(null);
      return;
    }

    const synchronizedAt = Date.now();
    setDisplayedOpponentInactivityTimeoutRemainingMs(nextRemainingMs);

    const intervalId = window.setInterval(() => {
      const elapsedSinceSynchronization = Date.now() - synchronizedAt;
      setDisplayedOpponentInactivityTimeoutRemainingMs(
        Math.max(0, nextRemainingMs - elapsedSinceSynchronization),
      );
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [game?.game_id, game?.opponent_inactivity_timeout_remaining_ms]);

  if (!game) return <div>No hay partida activa.</div>;

  const resolvedHumanPlayerId = myPlayerId ?? 0;
  const humanSymbol = game.yen?.players?.[resolvedHumanPlayerId] ?? game.yen?.players?.[0] ?? null;
  const hasWinner = game.game_over && game.winner !== null;
  const winningCellKeys = hasWinner ? findWinningConnectionCellKeys(game) : new Set<string>();
  const isHumanWinner = hasWinner && game.winner === resolvedHumanPlayerId;
  const outcomeTitle = getOutcomeTitle(hasWinner, isHumanWinner);
  const outcomeDetail = getOutcomeDetail(game);
  const player0UserId = game.player0_user_id?.trim() || null;
  const player1UserId = game.player1_user_id?.trim() || null;
  const normalizedCurrentUser = currentUserId?.trim().toLowerCase() || null;
  const currentIsPlayer0 = normalizedCurrentUser !== null && player0UserId?.toLowerCase() === normalizedCurrentUser;
  const currentIsPlayer1 = normalizedCurrentUser !== null && player1UserId?.toLowerCase() === normalizedCurrentUser;
  const rawOpponentUserId = resolveOpponentUserId(
    currentIsPlayer0,
    currentIsPlayer1,
    resolvedHumanPlayerId,
    player0UserId,
    player1UserId,
  );
  const shouldShowOpponent = player0UserId !== null || player1UserId !== null;
  const opponentUserId = rawOpponentUserId || (player1UserId ?? player0UserId);
  const opponentLabel = opponentUserId ?? 'desconocido';
  const isWaitingForOnlineOpponentMove =
    !game.game_over &&
    myPlayerId !== null &&
    game.next_player !== null &&
    game.next_player !== myPlayerId;
  const shouldShowOpponentInactivityCountdown =
    isWaitingForOnlineOpponentMove &&
    typeof displayedOpponentInactivityTimeoutRemainingMs === 'number' &&
    displayedOpponentInactivityTimeoutRemainingMs <=
      OPPONENT_INACTIVITY_COUNTDOWN_VISIBILITY_THRESHOLD_MS;
  const inactivityCountdownProgressPercent =
    typeof displayedOpponentInactivityTimeoutRemainingMs === 'number'
      ? (displayedOpponentInactivityTimeoutRemainingMs / OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS) * 100
      : 0;
  const outcomeBannerTone = getOutcomeBannerTone(game, isHumanWinner);

  function formatCountdownLabel(remainingMs: number): string {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return (
    <Box sx={uiSx.centeredColumn}>
      {game.game_over && (
        <Box sx={uiSx.gameOutcomeBanner(outcomeBannerTone)}>
          <Typography sx={uiSx.gameOutcomeTitle}>{outcomeTitle}</Typography>
          {outcomeDetail && (
            <Typography variant="body2">{outcomeDetail}</Typography>
          )}
        </Box>
      )}

      {shouldShowOpponentInactivityCountdown && (
        <Box sx={uiSx.gameOpponentInactivityCountdownCard}>
          <Typography sx={uiSx.gameOpponentInactivityCountdownLabel}>
            Esperando al rival
          </Typography>
          <Typography sx={uiSx.gameOpponentInactivityCountdownValue}>
            {formatCountdownLabel(displayedOpponentInactivityTimeoutRemainingMs)}
          </Typography>
          <Box sx={uiSx.gameOpponentInactivityCountdownTrack}>
            <Box sx={uiSx.gameOpponentInactivityCountdownFill(inactivityCountdownProgressPercent)} />
          </Box>
          <Typography variant="body2" sx={uiSx.gameOpponentInactivityCountdownHint}>
            Si no vuelve antes de que llegue a cero, ganaras por abandono.
          </Typography>
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
        </Box>
      </Box>
    </Box>
  );
};

export default GameView;
