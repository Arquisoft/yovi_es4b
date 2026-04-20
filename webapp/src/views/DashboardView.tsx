import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import type { GameMode } from '../gameyApi';
import { uiSx } from '../theme';
import ConfigView from './ConfigView';
import type { BotDifficulty } from '../stats/types';

type Props = Readonly<{
  boardSize: number;
  mode: GameMode;
  botDifficulty: BotDifficulty;
  loading: boolean;
  hasActiveGameInProgress: boolean;
  setMode: (mode: GameMode) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  updateBoardSize: (size: number) => void;
  createNewGame: () => void | Promise<void>;
  resumeActiveGame: () => void | Promise<void>;
  matchmakingTicketId: string | null;
  matchmakingStatus: 'idle' | 'waiting' | 'matched' | 'cancelled';
  startMatchmaking: () => void | Promise<void>;
  cancelCurrentMatchmaking: () => void | Promise<void>;
}>;

type AnimatedWaitingTextProps = Readonly<{
  label: string;
}>;

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
): string | null {
  if (matchmakingStatus === 'matched') {
    return 'Rival encontrado. Cargando partida...';
  }

  if (matchmakingStatus === 'cancelled') {
    return 'Busqueda cancelada.';
  }

  return null;
}

function AnimatedWaitingText({ label }: AnimatedWaitingTextProps) {
  const [dotCount, setDotCount] = React.useState(3);

  React.useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setDotCount((current) => (current + 1) % 4);
    }, 350);

    return () => globalThis.clearInterval(intervalId);
  }, []);

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline' }}>
      <Box component="span">{label}</Box>
      <Box component="span" sx={{ display: 'inline-block', minWidth: '3ch', textAlign: 'left' }}>
        {'.'.repeat(dotCount)}
      </Box>
    </Box>
  );
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

      <Paper sx={[uiSx.dashboardCard, { minHeight: 0, height: 'auto', gap: 1 }]}>
        <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
          Partida online
        </Typography>
        <Box sx={{ ...uiSx.onlineActionsRow, mt: 1 }}>
          <Button
            variant="outlined"
            sx={uiSx.onlinePrimaryButton}
            onClick={startMatchmaking}
            disabled={loading || waiting || hasActiveGameInProgress}
          >
            Buscar rival
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
            {waiting ? <AnimatedWaitingText label="Buscando" /> : statusText}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default DashboardView;
