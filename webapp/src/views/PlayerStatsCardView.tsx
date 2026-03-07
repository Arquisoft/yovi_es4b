import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { uiSx } from '../theme';
import type { PlayerStatsSummary } from './statsTypes';

type Props = {
  playerStats: PlayerStatsSummary;
};

const PlayerStatsCardView: React.FC<Props> = ({ playerStats }) => {
  return (
    <Paper sx={uiSx.dashboardCard}>
      <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
        Estadisticas del jugador
      </Typography>
      <Box sx={uiSx.dashboardCardHint}>Vista ejemplo de `player_stats` (sin integrar backend aun).</Box>

      <Box sx={uiSx.statsRows}>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Juegos jugados</Typography>
          <Typography>{playerStats.totalGames}</Typography>
        </Box>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Ganadas</Typography>
          <Typography>{playerStats.victories}</Typography>
        </Box>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Derrotas</Typography>
          <Typography>{playerStats.defeats}</Typography>
        </Box>
        <Box sx={uiSx.statsRow}>
          <Typography color="text.secondary">Actualizado</Typography>
          <Typography>{new Date(playerStats.updatedAt).toLocaleDateString()}</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default PlayerStatsCardView;
