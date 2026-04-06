import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import TriangularBoard from '../components/board/TriangularBoard';
import type { Coordinates, GameStateResponse } from '../gameyApi';
import type { BoardCell } from '../gameyUi';
import { findWinningConnectionCellKeys } from '../gameyUi';
import { botHistoryLabels } from '../stats/types';
import { uiSx } from '../theme';

const OPPONENT_INACTIVITY_COUNTDOWN_VISIBILITY_THRESHOLD_MS = 55_000;
const OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS = 60_000;
const ONLINE_TURN_TIMEOUT_TOTAL_MS = 60_000;
const LOCAL_TURN_TIMEOUT_TOTAL_MS = 30_000;

type GameOutcomeBannerTone = 'accent' | 'success' | 'danger';
type CountdownTone = 'self' | 'opponent' | 'disconnect';

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

function getBotOpponentLabel(botId: string | null): string {
  if (!botId) {
    return 'Bot';
  }

  const label = botHistoryLabels[botId] ?? botId.replace(/_bot$/i, '').replace(/_/g, ' ');
  return `Bot ${label}`.trim();
}

function useSynchronizedCountdown(syncKey: string | undefined, remainingMs: number | null): number | null {
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
  }, [syncKey, remainingMs]);

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
  const lastAutoPassTurnKeyRef = React.useRef<string | null>(null);
  const displayedOpponentInactivityTimeoutRemainingMs = useSynchronizedCountdown(
    game?.game_id,
    game?.opponent_inactivity_timeout_remaining_ms ?? null,
  );
  const displayedServerTurnTimeoutRemainingMs = useSynchronizedCountdown(
    game?.game_id,
    game?.turn_timeout_remaining_ms ?? null,
  );
  const fallbackTurnCountdownKey = game
    ? `${game.game_id}:${game.yen.layout}:${game.next_player ?? 'none'}:${loading ? 'loading' : 'ready'}`
    : undefined;
  const displayedFallbackTurnTimeoutRemainingMs = useSynchronizedCountdown(
    fallbackTurnCountdownKey,
    game && !game.game_over && game.turn_timeout_remaining_ms == null && !loading
      ? LOCAL_TURN_TIMEOUT_TOTAL_MS
      : null,
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
  const shouldShowOpponent =
    game.mode === 'human_vs_bot'
      ? true
      : resolvedOnlinePlayerId !== null && (player0UserId !== null || player1UserId !== null);
  const opponentUserId = rawOpponentUserId
    ?? (currentIsPlayer0 ? player1UserId : currentIsPlayer1 ? player0UserId : null);
  const opponentLabel = game.mode === 'human_vs_bot'
    ? getBotOpponentLabel(game.bot_id)
    : opponentUserId ?? 'desconocido';
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
    !shouldShowOpponentInactivityCountdown &&
    (
      typeof displayedServerTurnTimeoutRemainingMs === 'number' ||
      (
        typeof displayedFallbackTurnTimeoutRemainingMs === 'number' &&
        (game.mode !== 'human_vs_bot' || game.next_player === 0)
      )
    );
  const outcomeBannerTone = getOutcomeBannerTone(game, isHumanWinner);
  const isLocalPlayersTurn =
    resolvedOnlinePlayerId !== null &&
    game.next_player !== null &&
    game.next_player === resolvedOnlinePlayerId;
  const displayedTurnTimeoutRemainingMs =
    displayedServerTurnTimeoutRemainingMs ?? displayedFallbackTurnTimeoutRemainingMs;
  const turnCountdownRemainingMs =
    shouldShowTurnCountdown && displayedTurnTimeoutRemainingMs !== null
      ? displayedTurnTimeoutRemainingMs
      : null;

  let turnCountdownLabel = 'Turno';
  let turnCountdownHint = 'Si llega a cero, se cedera el turno automaticamente.';
  let turnCountdownTone: CountdownTone = 'self';

  if (game.mode === 'human_vs_bot') {
    const isHumanTurn = game.next_player === 0;
    turnCountdownLabel = isHumanTurn ? 'Tu turno' : 'Turno del bot';
    turnCountdownHint = isHumanTurn
      ? 'Si llega a cero, cederas el turno automaticamente.'
      : 'Esperando el movimiento del bot.';
    turnCountdownTone = isHumanTurn ? 'self' : 'opponent';
  } else if (resolvedOnlinePlayerId !== null) {
    turnCountdownLabel = isLocalPlayersTurn ? 'Tu turno' : 'Turno del rival';
    turnCountdownHint = isLocalPlayersTurn
      ? 'Si llega a cero, cederas el turno automaticamente.'
      : 'Si llega a cero, el rival cedera el turno automaticamente.';
    turnCountdownTone = isLocalPlayersTurn ? 'self' : 'opponent';
  } else {
    const currentPlayerNumber = (game.next_player ?? 0) + 1;
    turnCountdownLabel = `Turno del jugador ${currentPlayerNumber}`;
    turnCountdownHint = 'Si llega a cero, se cedera el turno automaticamente.';
    turnCountdownTone = (game.next_player ?? 0) === 0 ? 'self' : 'opponent';
  }

  const activeCountdownCard = shouldShowOpponentInactivityCountdown ? (
    <CountdownCard
      tone="disconnect"
      label="Rival desconectado"
      remainingMs={displayedOpponentInactivityTimeoutRemainingMs}
      totalMs={OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS}
      hint="Si no vuelve antes de que llegue a cero, ganaras por abandono."
    />
  ) : turnCountdownRemainingMs !== null ? (
    <CountdownCard
      tone={turnCountdownTone}
      label={turnCountdownLabel}
      remainingMs={turnCountdownRemainingMs}
      totalMs={displayedServerTurnTimeoutRemainingMs !== null ? ONLINE_TURN_TIMEOUT_TOTAL_MS : LOCAL_TURN_TIMEOUT_TOTAL_MS}
      hint={turnCountdownHint}
    />
  ) : null;

  React.useEffect(() => {
    if (
      !game ||
      game.game_over ||
      typeof displayedFallbackTurnTimeoutRemainingMs !== 'number' ||
      displayedFallbackTurnTimeoutRemainingMs > 0 ||
      loading ||
      !canPlayCell
    ) {
      return;
    }

    const currentTurnKey = `${game.game_id}:${game.yen.turn}:${game.next_player ?? 'none'}`;
    if (lastAutoPassTurnKeyRef.current === currentTurnKey) {
      return;
    }

    lastAutoPassTurnKeyRef.current = currentTurnKey;
    void passCurrentTurn();
  }, [
    canPlayCell,
    displayedFallbackTurnTimeoutRemainingMs,
    game,
    loading,
    passCurrentTurn,
  ]);

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

      {!game.game_over && (
        <Box sx={uiSx.gameCountdownSlot}>
          {activeCountdownCard}
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
