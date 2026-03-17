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
  setMode: (mode: GameMode) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  updateBoardSize: (size: number) => void;
  createNewGame: () => void;
  matchmakingTicketId: string | null;
  matchmakingStatus: 'idle' | 'waiting' | 'matched' | 'cancelled';
  matchmakingPosition: number | null;
  startMatchmaking: () => void;
  cancelCurrentMatchmaking: () => void;
};

const DashboardView: React.FC<Props> = ({
  boardSize,
  mode,
  botDifficulty,
  loading,
  setMode,
  setBotDifficulty,
  updateBoardSize,
  createNewGame,
  matchmakingTicketId,
  matchmakingStatus,
  matchmakingPosition,
  startMatchmaking,
  cancelCurrentMatchmaking,
}) => {
  const waiting = matchmakingStatus === 'waiting';
  const canCancel = waiting && Boolean(matchmakingTicketId);
  const hasStatus = matchmakingStatus !== 'idle';

  const statusText =
    matchmakingStatus === 'waiting'
      ? `Buscando rival... ${
          matchmakingTicketId ? `Ticket ${matchmakingTicketId}` : ''
        }${matchmakingPosition ? ` - Posicion ${matchmakingPosition}` : ''}`
      : matchmakingStatus === 'matched'
        ? 'Rival encontrado. Cargando partida...'
        : 'Busqueda cancelada.';

  return (
    <Box sx={{ ...uiSx.dashboardShell, maxWidth: 760 }}>
      <ConfigView
        boardSize={boardSize}
        mode={mode}
        botDifficulty={botDifficulty}
        loading={loading}
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
            disabled={loading || waiting}
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
