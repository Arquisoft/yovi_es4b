import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import TriangularBoard from '../components/board/TriangularBoard';
import type { Coordinates, GameStateResponse } from '../gameyApi';
import type { BoardCell } from '../gameyUi';
import { findWinningConnectionCellKeys } from '../gameyUi';
import { uiSx } from '../theme';

const OPPONENT_INACTIVITY_COUNTDOWN_VISIBILITY_THRESHOLD_MS = 55_000;
const OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS = 60_000;
const TURN_TIMEOUT_TOTAL_MS = 60_000;

type GameOutcomeBannerTone = 'accent' | 'success' | 'danger';
type CountdownTone = 'turn' | 'disconnect';

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

function useSynchronizedCountdown(gameId: string | undefined, remainingMs: number | null): number | null {
  const [displayedRemainingMs, setDisplayedRemainingMs] = React.useState<number | null>(remainingMs);

  React.useEffect(() => {
    if (typeof remainingMs !== 'number') {
      setDisplayedRemainingMs(null);
      return;
    }

    const synchronizedAt = Date.now();
    setDisplayedRemainingMs(remainingMs);

    const intervalId = window.setInterval(() => {
      const elapsedSinceSynchronization = Date.now() - synchronizedAt;
      setDisplayedRemainingMs(Math.max(0, remainingMs - elapsedSinceSynchronization));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameId, remainingMs]);

  return displayedRemainingMs;
}

type CountdownCardProps = {
  tone: CountdownTone;
  label: string;
  hint: string;
  remainingMs: number;
  totalMs: number;
};

function formatCountdownLabel(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const CountdownCard: React.FC<CountdownCardProps> = ({ tone, label, hint, remainingMs, totalMs }) => {
  const progressPercent = (remainingMs / totalMs) * 100;

  return (
    <Box sx={uiSx.gameCountdownCard(tone)}>
      <Typography sx={uiSx.gameCountdownLabel}>{label}</Typography>
      <Typography sx={uiSx.gameCountdownValue}>{formatCountdownLabel(remainingMs)}</Typography>
      <Box sx={uiSx.gameCountdownTrack}>
        <Box sx={uiSx.gameCountdownFill(progressPercent, tone)} />
      </Box>
      <Typography variant="body2" sx={uiSx.gameCountdownHint}>
        {hint}
      </Typography>
    </Box>
  );
};

type Props = {
  game: GameStateResponse | null;
  board: BoardCell[][];
  canPlayCell: boolean;
  loading: boolean;
  myPlayerId?: number | null;
  currentUserId?: string | null;
  resignCurrentGame: () => void;
  passCurrentTurn: () => void;
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
  passCurrentTurn,
  playCell,
}) => {
  const displayedOpponentInactivityTimeoutRemainingMs = useSynchronizedCountdown(
    game?.game_id,
    game?.opponent_inactivity_timeout_remaining_ms ?? null,
  );
  const displayedTurnTimeoutRemainingMs = useSynchronizedCountdown(
    game?.game_id,
    game?.turn_timeout_remaining_ms ?? null,
  );

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
  const resolvedOnlinePlayerId =
    myPlayerId ?? (currentIsPlayer0 ? 0 : currentIsPlayer1 ? 1 : null);
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
    resolvedOnlinePlayerId !== null &&
    game.next_player !== null &&
    game.next_player !== resolvedOnlinePlayerId;
  const shouldShowOpponentInactivityCountdown =
    isWaitingForOnlineOpponentMove &&
    typeof displayedOpponentInactivityTimeoutRemainingMs === 'number' &&
    displayedOpponentInactivityTimeoutRemainingMs <=
      OPPONENT_INACTIVITY_COUNTDOWN_VISIBILITY_THRESHOLD_MS;
  const shouldShowTurnCountdown =
    !game.game_over &&
    resolvedOnlinePlayerId !== null &&
    typeof displayedTurnTimeoutRemainingMs === 'number' &&
    !shouldShowOpponentInactivityCountdown;
  const outcomeBannerTone = getOutcomeBannerTone(game, isHumanWinner);
  const isLocalPlayersTurn =
    resolvedOnlinePlayerId !== null &&
    game.next_player !== null &&
    game.next_player === resolvedOnlinePlayerId;
  const turnCountdownLabel = isLocalPlayersTurn ? 'Tu turno' : 'Turno del rival';
  const turnCountdownHint = canPlayCell
    ? 'Si llega a cero, cederas el turno automaticamente.'
    : 'Si llega a cero, el rival cedera el turno automaticamente.';

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
        <CountdownCard
          tone="disconnect"
          label="Rival desconectado"
          remainingMs={displayedOpponentInactivityTimeoutRemainingMs}
          totalMs={OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS}
          hint="Si no vuelve antes de que llegue a cero, ganaras por abandono."
        />
      )}

      {shouldShowTurnCountdown && (
        <CountdownCard
          tone="turn"
          label={turnCountdownLabel}
          remainingMs={displayedTurnTimeoutRemainingMs}
          totalMs={TURN_TIMEOUT_TOTAL_MS}
          hint={turnCountdownHint}
        />
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
          <Button
            variant="outlined"
            sx={uiSx.gamePassTurnButton}
            onClick={passCurrentTurn}
            disabled={loading || game.game_over || !canPlayCell}
          >
            Ceder turno
          </Button>
          <Button variant="outlined" sx={uiSx.gameResignButton} onClick={resignCurrentGame} disabled={loading || game.game_over}>
            Rendirse
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default GameView;
