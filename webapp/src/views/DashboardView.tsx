import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import type { GameMode } from '../gameyApi';
import { uiSx } from '../theme';
import ConfigView from './ConfigView';
import type { BotDifficulty } from '../stats/types';

type Props = {
  boardSize: number;
  mode: GameMode;
  botDifficulty: BotDifficulty;
  loading: boolean;
  hasActiveGameInProgress: boolean;
  setMode: (mode: GameMode) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  updateBoardSize: (size: number) => void;
  createNewGame: () => void;
  resumeActiveGame: () => void;
  matchmakingTicketId: string | null;
  matchmakingStatus: 'idle' | 'waiting' | 'matched' | 'cancelled';
  matchmakingPosition: number | null;
  startMatchmaking: () => void;
  cancelCurrentMatchmaking: () => void;
};

function getGameConfigurationLockMessage(
  hasActiveGameInProgress: boolean,
  waiting: boolean,
): string | null {
  if (hasActiveGameInProgress) {
    return 'Tienes una partida activa. Retomala antes de iniciar otra.';
  }

  if (waiting) {
    return 'Cancela la busqueda actual antes de crear una nueva partida.';
  }

  return null;
}

function getMatchmakingStatusText(
  matchmakingStatus: Props['matchmakingStatus'],
  matchmakingTicketId: string | null,
  matchmakingPosition: number | null,
): string {
  if (matchmakingStatus === 'waiting') {
    const ticketText = matchmakingTicketId ? `Ticket ${matchmakingTicketId}` : '';
    const positionText = matchmakingPosition ? ` - Posicion ${matchmakingPosition}` : '';
    return `Buscando rival... ${ticketText}${positionText}`;
  }

  if (matchmakingStatus === 'matched') {
    return 'Rival encontrado. Cargando partida...';
  }

  return 'Busqueda cancelada.';
}

const DashboardView: React.FC<Props> = ({
  boardSize,
  mode,
  botDifficulty,
  loading,
  hasActiveGameInProgress,
  setMode,
  setBotDifficulty,
  updateBoardSize,
  createNewGame,
  resumeActiveGame,
  matchmakingTicketId,
  matchmakingStatus,
  matchmakingPosition,
  startMatchmaking,
  cancelCurrentMatchmaking,
}) => {
  const waiting = matchmakingStatus === 'waiting';
  const canCancel = waiting && Boolean(matchmakingTicketId);
  const hasStatus = matchmakingStatus !== 'idle';
  const isGameConfigurationLocked = waiting || hasActiveGameInProgress;
  const gameConfigurationLockMessage = getGameConfigurationLockMessage(
    hasActiveGameInProgress,
    waiting,
  );
  const statusText = getMatchmakingStatusText(
    matchmakingStatus,
    matchmakingTicketId,
    matchmakingPosition,
  );

  return (
    <Box sx={{ ...uiSx.dashboardShell, maxWidth: 760 }}>
      {hasActiveGameInProgress && (
        <Paper sx={uiSx.activeGameCard}>
          <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
            Partida en curso
          </Typography>
          <Box sx={uiSx.dashboardCardHint}>
            Ya tienes una partida activa. Si has salido de la vista de juego, puedes retomarla desde aqui.
          </Box>

          <Box sx={uiSx.onlineActionsRow}>
            <Button
              sx={uiSx.activeGameResumeButton}
              onClick={resumeActiveGame}
              disabled={loading}
            >
              Volver a la partida
            </Button>
          </Box>
        </Paper>
      )}

      <ConfigView
        boardSize={boardSize}
        mode={mode}
        botDifficulty={botDifficulty}
        loading={loading}
        isGameConfigurationLocked={isGameConfigurationLocked}
        gameConfigurationLockMessage={gameConfigurationLockMessage}
        setMode={setMode}
        setBotDifficulty={setBotDifficulty}
        updateBoardSize={updateBoardSize}
        createNewGame={createNewGame}
      />

      <Paper sx={uiSx.dashboardCard}>
        <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
          Jugar online
        </Typography>
        <Box sx={uiSx.dashboardCardHint}>
          Emparejamiento automatico para partidas humano vs humano.
        </Box>

        <Box sx={uiSx.onlineActionsRow}>
          <Button
            variant="outlined"
            sx={uiSx.onlinePrimaryButton}
            onClick={startMatchmaking}
            disabled={loading || waiting || hasActiveGameInProgress}
          >
            {waiting ? 'Buscando...' : 'Buscar rival'}
          </Button>
          <Button
            variant="outlined"
            sx={uiSx.onlineSecondaryButton}
            onClick={cancelCurrentMatchmaking}
            disabled={loading || !canCancel}
          >
            Cancelar busqueda
          </Button>
        </Box>

        {hasStatus && (
          <Box sx={uiSx.onlineStatusBadge(waiting)}>
            {statusText}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default DashboardView;
