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

type CountdownCardProps = Readonly<{
  tone: CountdownTone;
  label: string;
  hint: string;
  remainingMs: number;
  totalMs: number;
}>;

type Props = Readonly<{
  game: GameStateResponse | null;
  board: BoardCell[][];
  canPlayCell: boolean;
  loading: boolean;
  hintCoordinates: Coordinates | null;
  hintLoading: boolean;
  myPlayerId?: number | null;
  currentUserId?: string | null;
  resignCurrentGame: () => void;
  passCurrentTurn: () => void;
  playCell: (coords: Coordinates) => Promise<void> | void;
  requestHint: () => Promise<boolean> | void;
}>;

type PlayerContext = Readonly<{
  resolvedHumanPlayerId: number;
  humanSymbol: string | null;
  player0UserId: string | null;
  player1UserId: string | null;
  currentIsPlayer0: boolean;
  currentIsPlayer1: boolean;
  resolvedOnlinePlayerId: number | null;
}>;

type OpponentDisplay = Readonly<{
  shouldShowOpponent: boolean;
  opponentLabel: string | null;
}>;

type HintDisplay = Readonly<{
  hintCellKey: string | null;
  hintText: string | null;
}>;

type OutcomeDisplay = Readonly<{
  winningCellKeys: Set<string>;
  outcomeTitle: string;
  outcomeDetail: string | null;
  outcomeBannerTone: GameOutcomeBannerTone;
}>;

type TurnCountdownPresentation = Readonly<{
  label: string;
  hint: string;
  tone: CountdownTone;
}>;

type AutoPassEffectParams = Readonly<{
  game: GameStateResponse | null;
  displayedFallbackTurnTimeoutRemainingMs: number | null;
  loading: boolean;
  canPlayCell: boolean;
  passCurrentTurn: () => void | Promise<void>;
}>;

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

  const label = botHistoryLabels[botId] ?? botId.replace(/_bot$/i, '').replaceAll('_', ' ');
  return `Bot ${label}`.trim();
}

function isGuestSessionIdentity(userId: string | null): boolean {
  return Boolean(userId && /^guest-[a-z0-9-]+$/i.test(userId));
}

function formatHumanOpponentLabel(userId: string | null): string {
  if (!userId) {
    return 'desconocido';
  }

  return isGuestSessionIdentity(userId) ? 'Invitado' : userId;
}

function normalizeUserId(userId: string | null | undefined): string | null {
  const normalizedUserId = userId?.trim();
  return normalizedUserId || null;
}

function normalizeComparableUserId(userId: string | null | undefined): string | null {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId ? normalizedUserId.toLowerCase() : null;
}

function getResolvedOnlinePlayerId(
  myPlayerId: number | null,
  currentIsPlayer0: boolean,
  currentIsPlayer1: boolean,
): number | null {
  if (myPlayerId !== null) {
    return myPlayerId;
  }

  if (currentIsPlayer0) {
    return 0;
  }

  if (currentIsPlayer1) {
    return 1;
  }

  return null;
}

function getHumanSymbol(game: GameStateResponse, resolvedHumanPlayerId: number): string | null {
  return game.yen?.players?.[resolvedHumanPlayerId] ?? game.yen?.players?.[0] ?? null;
}

function getPlayerContext(
  game: GameStateResponse,
  currentUserId: string | null,
  myPlayerId: number | null,
): PlayerContext {
  const resolvedHumanPlayerId = myPlayerId ?? 0;
  const player0UserId = normalizeUserId(game.player0_user_id);
  const player1UserId = normalizeUserId(game.player1_user_id);
  const normalizedCurrentUser = normalizeComparableUserId(currentUserId);
  const currentIsPlayer0 = normalizedCurrentUser !== null && player0UserId?.toLowerCase() === normalizedCurrentUser;
  const currentIsPlayer1 = normalizedCurrentUser !== null && player1UserId?.toLowerCase() === normalizedCurrentUser;

  return {
    resolvedHumanPlayerId,
    humanSymbol: getHumanSymbol(game, resolvedHumanPlayerId),
    player0UserId,
    player1UserId,
    currentIsPlayer0,
    currentIsPlayer1,
    resolvedOnlinePlayerId: getResolvedOnlinePlayerId(myPlayerId, currentIsPlayer0, currentIsPlayer1),
  };
}

function getFallbackOpponentUserId(
  currentIsPlayer0: boolean,
  currentIsPlayer1: boolean,
  player0UserId: string | null,
  player1UserId: string | null,
): string | null {
  if (currentIsPlayer0) {
    return player1UserId;
  }

  if (currentIsPlayer1) {
    return player0UserId;
  }

  return null;
}

function getOpponentDisplay(game: GameStateResponse, playerContext: PlayerContext): OpponentDisplay {
  if (game.mode === 'human_vs_bot') {
    return {
      shouldShowOpponent: true,
      opponentLabel: getBotOpponentLabel(game.bot_id),
    };
  }

  const hasOnlineIdentities = playerContext.player0UserId !== null || playerContext.player1UserId !== null;
  if (playerContext.resolvedOnlinePlayerId === null || !hasOnlineIdentities) {
    return {
      shouldShowOpponent: false,
      opponentLabel: null,
    };
  }

  const rawOpponentUserId = resolveOpponentUserId(
    playerContext.currentIsPlayer0,
    playerContext.currentIsPlayer1,
    playerContext.resolvedHumanPlayerId,
    playerContext.player0UserId,
    playerContext.player1UserId,
  );
  const opponentUserId = rawOpponentUserId ?? getFallbackOpponentUserId(
    playerContext.currentIsPlayer0,
    playerContext.currentIsPlayer1,
    playerContext.player0UserId,
    playerContext.player1UserId,
  );

  return {
    shouldShowOpponent: true,
    opponentLabel: formatHumanOpponentLabel(opponentUserId),
  };
}

function getHintCellKey(hintCoordinates: Coordinates | null): string | null {
  if (!hintCoordinates) {
    return null;
  }

  return `${hintCoordinates.x}-${hintCoordinates.y}-${hintCoordinates.z}`;
}

function getHintDisplay(
  hintCoordinates: Coordinates | null,
  hintLoading: boolean,
): HintDisplay {
  const hintCellKey = getHintCellKey(hintCoordinates);

  if (hintLoading) {
    return {
      hintCellKey,
      hintText: 'Cargando pista...',
    };
  }

  if (hintCoordinates) {
    return {
      hintCellKey,
      hintText: 'Movimiento sugerido',
    };
  }

  return {
    hintCellKey,
    hintText: null,
  };
}

function getOutcomeDisplay(
  game: GameStateResponse,
  resolvedHumanPlayerId: number,
): OutcomeDisplay {
  const hasWinner = game.game_over && game.winner !== null;
  const isHumanWinner = hasWinner && game.winner === resolvedHumanPlayerId;

  return {
    winningCellKeys: hasWinner ? findWinningConnectionCellKeys(game) : new Set<string>(),
    outcomeTitle: getOutcomeTitle(hasWinner, isHumanWinner),
    outcomeDetail: getOutcomeDetail(game),
    outcomeBannerTone: getOutcomeBannerTone(game, isHumanWinner),
  };
}

function getFallbackTurnCountdownKey(
  game: GameStateResponse | null,
  loading: boolean,
): string | undefined {
  if (!game) {
    return undefined;
  }

  const loadingState = loading ? 'loading' : 'ready';
  return `${game.game_id}:${game.yen.layout}:${game.next_player ?? 'none'}:${loadingState}`;
}

function getFallbackTurnCountdownSeed(
  game: GameStateResponse | null,
  loading: boolean,
): number | null {
  if (!game || game.game_over || typeof game.turn_timeout_remaining_ms === 'number' || loading) {
    return null;
  }

  return LOCAL_TURN_TIMEOUT_TOTAL_MS;
}

function buildCurrentTurnKey(game: GameStateResponse | null): string | null {
  if (!game) {
    return null;
  }

  return `${game.game_id}:${game.yen.turn}:${game.next_player ?? 'none'}`;
}

function shouldAutoPassExpiredTurn(
  game: GameStateResponse | null,
  displayedFallbackTurnTimeoutRemainingMs: number | null,
  loading: boolean,
  canPlayCell: boolean,
): boolean {
  return Boolean(
    game &&
    !game.game_over &&
    typeof displayedFallbackTurnTimeoutRemainingMs === 'number' &&
    displayedFallbackTurnTimeoutRemainingMs <= 0 &&
    !loading &&
    canPlayCell,
  );
}

function useAutoPassExpiredTurn({
  game,
  displayedFallbackTurnTimeoutRemainingMs,
  loading,
  canPlayCell,
  passCurrentTurn,
}: AutoPassEffectParams): void {
  const lastAutoPassTurnKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!shouldAutoPassExpiredTurn(game, displayedFallbackTurnTimeoutRemainingMs, loading, canPlayCell)) {
      return;
    }

    const currentTurnKey = buildCurrentTurnKey(game);
    if (!currentTurnKey || lastAutoPassTurnKeyRef.current === currentTurnKey) {
      return;
    }

    lastAutoPassTurnKeyRef.current = currentTurnKey;
    passCurrentTurn();
  }, [
    canPlayCell,
    displayedFallbackTurnTimeoutRemainingMs,
    game,
    loading,
    passCurrentTurn,
  ]);
}

function isWaitingForOnlineOpponentMove(
  game: GameStateResponse,
  resolvedOnlinePlayerId: number | null,
): boolean {
  return (
    !game.game_over &&
    resolvedOnlinePlayerId !== null &&
    game.next_player !== null &&
    game.next_player !== resolvedOnlinePlayerId
  );
}

function shouldShowOpponentInactivityCountdown(
  waitingForOnlineOpponentMove: boolean,
  displayedOpponentInactivityTimeoutRemainingMs: number | null,
): boolean {
  return (
    waitingForOnlineOpponentMove &&
    typeof displayedOpponentInactivityTimeoutRemainingMs === 'number' &&
    displayedOpponentInactivityTimeoutRemainingMs <=
      OPPONENT_INACTIVITY_COUNTDOWN_VISIBILITY_THRESHOLD_MS
  );
}

function getTurnCountdownRemainingMs(
  game: GameStateResponse,
  showOpponentInactivityCountdown: boolean,
  displayedServerTurnTimeoutRemainingMs: number | null,
  displayedFallbackTurnTimeoutRemainingMs: number | null,
): number | null {
  if (game.game_over || showOpponentInactivityCountdown) {
    return null;
  }

  if (typeof displayedServerTurnTimeoutRemainingMs === 'number') {
    return displayedServerTurnTimeoutRemainingMs;
  }

  if (typeof displayedFallbackTurnTimeoutRemainingMs !== 'number') {
    return null;
  }

  if (game.mode === 'human_vs_bot' && game.next_player !== 0) {
    return null;
  }

  return displayedFallbackTurnTimeoutRemainingMs;
}

function getHumanVsBotTurnCountdownPresentation(isHumanTurn: boolean): TurnCountdownPresentation {
  if (isHumanTurn) {
    return {
      label: 'Tu turno',
      hint: 'Si llega a cero, cederas el turno automaticamente.',
      tone: 'self',
    };
  }

  return {
    label: 'Turno del bot',
    hint: 'Esperando el movimiento del bot.',
    tone: 'opponent',
  };
}

function getOnlineTurnCountdownPresentation(isLocalPlayersTurn: boolean): TurnCountdownPresentation {
  if (isLocalPlayersTurn) {
    return {
      label: 'Tu turno',
      hint: 'Si llega a cero, cederas el turno automaticamente.',
      tone: 'self',
    };
  }

  return {
    label: 'Turno del rival',
    hint: 'Si llega a cero, el rival cedera el turno automaticamente.',
    tone: 'opponent',
  };
}

function getLocalTurnCountdownPresentation(game: GameStateResponse): TurnCountdownPresentation {
  const currentPlayerNumber = (game.next_player ?? 0) + 1;

  return {
    label: `Turno del jugador ${currentPlayerNumber}`,
    hint: 'Si llega a cero, se cedera el turno automaticamente.',
    tone: (game.next_player ?? 0) === 0 ? 'self' : 'opponent',
  };
}

function getTurnCountdownPresentation(
  game: GameStateResponse,
  resolvedOnlinePlayerId: number | null,
): TurnCountdownPresentation {
  if (game.mode === 'human_vs_bot') {
    return getHumanVsBotTurnCountdownPresentation(game.next_player === 0);
  }

  if (resolvedOnlinePlayerId !== null) {
    return getOnlineTurnCountdownPresentation(game.next_player === resolvedOnlinePlayerId);
  }

  return getLocalTurnCountdownPresentation(game);
}

function getTurnCountdownTotalMs(displayedServerTurnTimeoutRemainingMs: number | null): number {
  if (displayedServerTurnTimeoutRemainingMs === null) {
    return LOCAL_TURN_TIMEOUT_TOTAL_MS;
  }

  return ONLINE_TURN_TIMEOUT_TOTAL_MS;
}

function getActiveCountdownCardProps(
  game: GameStateResponse,
  resolvedOnlinePlayerId: number | null,
  displayedOpponentInactivityTimeoutRemainingMs: number | null,
  displayedServerTurnTimeoutRemainingMs: number | null,
  displayedFallbackTurnTimeoutRemainingMs: number | null,
): CountdownCardProps | null {
  const waitingForOnlineOpponentMove = isWaitingForOnlineOpponentMove(game, resolvedOnlinePlayerId);
  const showOpponentInactivityCountdown = shouldShowOpponentInactivityCountdown(
    waitingForOnlineOpponentMove,
    displayedOpponentInactivityTimeoutRemainingMs,
  );

  if (showOpponentInactivityCountdown && typeof displayedOpponentInactivityTimeoutRemainingMs === 'number') {
    return {
      tone: 'disconnect',
      label: 'Rival desconectado',
      remainingMs: displayedOpponentInactivityTimeoutRemainingMs,
      totalMs: OPPONENT_INACTIVITY_TIMEOUT_TOTAL_MS,
      hint: 'Si no vuelve antes de que llegue a cero, ganaras por abandono.',
    };
  }

  const turnCountdownRemainingMs = getTurnCountdownRemainingMs(
    game,
    showOpponentInactivityCountdown,
    displayedServerTurnTimeoutRemainingMs,
    displayedFallbackTurnTimeoutRemainingMs,
  );
  if (turnCountdownRemainingMs === null) {
    return null;
  }

  const turnCountdownPresentation = getTurnCountdownPresentation(game, resolvedOnlinePlayerId);
  return {
    ...turnCountdownPresentation,
    remainingMs: turnCountdownRemainingMs,
    totalMs: getTurnCountdownTotalMs(displayedServerTurnTimeoutRemainingMs),
  };
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

    const intervalId = globalThis.setInterval(() => {
      const elapsedSinceSynchronization = Date.now() - synchronizedAt;
      setDisplayedRemainingMs(Math.max(0, remainingMs - elapsedSinceSynchronization));
    }, 250);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [syncKey, remainingMs]);

  return displayedRemainingMs;
}

function formatCountdownLabel(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const CountdownCard: React.FC<CountdownCardProps> = ({
  tone,
  label,
  hint,
  remainingMs,
  totalMs,
}) => {
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

const GameView: React.FC<Props> = ({
  game,
  board,
  canPlayCell,
  loading,
  hintCoordinates,
  hintLoading,
  myPlayerId = null,
  currentUserId = null,
  resignCurrentGame,
  passCurrentTurn,
  playCell,
  requestHint,
}) => {
  const displayedOpponentInactivityTimeoutRemainingMs = useSynchronizedCountdown(
    game?.game_id,
    game?.opponent_inactivity_timeout_remaining_ms ?? null,
  );
  const displayedServerTurnTimeoutRemainingMs = useSynchronizedCountdown(
    game?.game_id,
    game?.turn_timeout_remaining_ms ?? null,
  );
  const fallbackTurnCountdownKey = getFallbackTurnCountdownKey(game, loading);
  const displayedFallbackTurnTimeoutRemainingMs = useSynchronizedCountdown(
    fallbackTurnCountdownKey,
    getFallbackTurnCountdownSeed(game, loading),
  );

  useAutoPassExpiredTurn({
    game,
    displayedFallbackTurnTimeoutRemainingMs,
    loading,
    canPlayCell,
    passCurrentTurn,
  });

  const handleRequestHint = React.useCallback(() => {
    return requestHint();
  }, [requestHint]);

  if (!game) {
    return <div>No hay partida activa.</div>;
  }

  const playerContext = getPlayerContext(game, currentUserId, myPlayerId);
  const opponentDisplay = getOpponentDisplay(game, playerContext);
  const hintDisplay = getHintDisplay(hintCoordinates, hintLoading);
  const outcomeDisplay = getOutcomeDisplay(game, playerContext.resolvedHumanPlayerId);
  const activeCountdownCardProps = getActiveCountdownCardProps(
    game,
    playerContext.resolvedOnlinePlayerId,
    displayedOpponentInactivityTimeoutRemainingMs,
    displayedServerTurnTimeoutRemainingMs,
    displayedFallbackTurnTimeoutRemainingMs,
  );

  return (
    <Box sx={uiSx.centeredColumn}>
      {game.game_over && (
        <Box sx={uiSx.gameOutcomeBanner(outcomeDisplay.outcomeBannerTone)}>
          <Typography sx={uiSx.gameOutcomeTitle}>{outcomeDisplay.outcomeTitle}</Typography>
          {outcomeDisplay.outcomeDetail && (
            <Typography variant="body2">{outcomeDisplay.outcomeDetail}</Typography>
          )}
        </Box>
      )}

      {!game.game_over && (
        <Box sx={uiSx.gameCountdownSlot}>
          {activeCountdownCardProps ? <CountdownCard {...activeCountdownCardProps} /> : null}
        </Box>
      )}

      {opponentDisplay.shouldShowOpponent && opponentDisplay.opponentLabel && (
        <Typography variant="subtitle1">Rival: {opponentDisplay.opponentLabel}</Typography>
      )}
      <Typography variant="h5">Partida {game.game_id}</Typography>

      <Box sx={uiSx.gameBoardStage}>
        <Box sx={uiSx.gameBoardBase} />
        <TriangularBoard
          board={board}
          humanSymbol={playerContext.humanSymbol}
          canPlayCell={canPlayCell}
          loading={loading}
          playCell={playCell}
          size={game.yen.size}
          winningCellKeys={outcomeDisplay.winningCellKeys}
          hintCellKey={hintDisplay.hintCellKey}
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
          <Button
            variant="outlined"
            sx={uiSx.gameHintButton}
            onClick={handleRequestHint}
            disabled={hintLoading || loading || game.game_over || !canPlayCell}
          >
            Pista
          </Button>
          <Button
            variant="outlined"
            sx={uiSx.gameResignButton}
            onClick={resignCurrentGame}
            disabled={loading || game.game_over}
          >
            Rendirse
          </Button>
        </Box>
        {hintDisplay.hintText ? (
          <Typography variant="body2" sx={uiSx.gameHintText}>
            {hintDisplay.hintText}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export default GameView;
