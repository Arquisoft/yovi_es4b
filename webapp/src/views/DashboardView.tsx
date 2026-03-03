import React from 'react';
import { Box, Button, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import type { GameMode } from '../gameyApi';
import { uiSx } from '../theme';
import type { MatchHistoryItem, PlayerStatsSummary } from './statsTypes';

type Props = {
  boardSize: number;
  mode: GameMode;
  loading: boolean;
  setMode: (mode: GameMode) => void;
  updateBoardSize: (size: number) => void;
  createNewGame: () => void;
  playerStats: PlayerStatsSummary;
  matches: MatchHistoryItem[];
  onViewMoreMatches: () => void;
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  return mode === 'human_vs_bot' ? 'Bot' : 'Humano';
}

function resultLabel(result: MatchHistoryItem['result']) {
  return result === 'win' ? 'Victoria' : 'Derrota';
}

const DashboardView: React.FC<Props> = ({
  boardSize,
  mode,
  loading,
  setMode,
  updateBoardSize,
  createNewGame,
  playerStats,
  matches,
  onViewMoreMatches,
}) => {
  const visibleMatches = matches.slice(0, 3);

  return (
    <Box sx={uiSx.dashboardShell}>
      <Box sx={uiSx.dashboardTopRow}>
        <Paper sx={uiSx.dashboardCard}>
          <Typography variant="h6">Configurar partida</Typography>
          <Box sx={uiSx.dashboardCardHint}>Elige parametros y crea una nueva partida.</Box>

          <Box sx={uiSx.dashboardConfigControls}>
            <TextField
              id="size-input"
              label="Tamano"
              type="number"
              value={boardSize}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                updateBoardSize(Number.isNaN(next) ? 1 : next);
              }}
            />

            <TextField
              id="mode-select"
              select
              label="Modo"
              value={mode}
              onChange={(event) => setMode(event.target.value as GameMode)}
            >
              <MenuItem value="human_vs_bot">Human vs Bot</MenuItem>
              <MenuItem value="human_vs_human">Human vs Human</MenuItem>
            </TextField>

            <Button onClick={createNewGame} disabled={loading}>
              {loading ? 'Cargando...' : 'Crear partida'}
            </Button>
          </Box>
        </Paper>

        <Paper sx={uiSx.dashboardCard}>
          <Typography variant="h6">Estadisticas del jugador</Typography>
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
      </Box>

      <Paper sx={uiSx.dashboardHistoryCard}>
        <Typography variant="h6">Historial de partidas</Typography>
        <Box sx={uiSx.dashboardCardHint}>Vista ejemplo de `player_matches`.</Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Partida</TableCell>
                <TableCell>Resultado</TableCell>
                <TableCell>Modo</TableCell>
                <TableCell>Ganador</TableCell>
                <TableCell>Fecha</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleMatches.map((match) => (
                <TableRow key={`${match.gameId}-${match.endedAt}`}>
                  <TableCell>{match.gameId}</TableCell>
                  <TableCell>{resultLabel(match.result)}</TableCell>
                  <TableCell>{modeLabel(match.mode)}</TableCell>
                  <TableCell>{match.winnerId}</TableCell>
                  <TableCell>{new Date(match.endedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={uiSx.historyFooter}>
          <Button variant="text" onClick={onViewMoreMatches}>
            Ver mas partidas
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default DashboardView;
