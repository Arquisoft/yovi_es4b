import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { uiSx } from '../theme';
import type { PlayerStatsSummary } from '../stats/types';

type Props = {
  playerStats: PlayerStatsSummary;
};

const PlayerStatsCardView: React.FC<Props> = ({ playerStats }) => {
  return (
    <Paper sx={uiSx.dashboardCard}>
      <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
        Estadisticas del jugador
      </Typography>
      <Box sx={uiSx.dashboardCardHint}>Resumen real de tu actividad reciente.</Box>

      <Box sx={uiSx.statsRows}>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Partidas jugadas</Typography>
          <Typography>{playerStats.totalGames}</Typography>
        </Box>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Victorias</Typography>
          <Typography>{playerStats.victories}</Typography>
        </Box>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Derrotas</Typography>
          <Typography>{playerStats.defeats}</Typography>
        </Box>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Actualizado</Typography>
          <Typography>{playerStats.updatedAt ? new Date(playerStats.updatedAt).toLocaleDateString() : 'Sin partidas'}</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default PlayerStatsCardView;
