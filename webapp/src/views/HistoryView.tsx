import React from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { uiSx } from '../theme';
import { botHistoryLabels, type MatchHistoryItem } from '../stats/types';

type Props = {
  matches: MatchHistoryItem[];
  onBack: () => void;
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  if (mode === 'human_vs_bot') return 'Bot';
  if (mode === 'human_vs_human') return 'Humano';
  return '-';
}

function resultLabel(result: MatchHistoryItem['result']) {
  return result === 'win' ? 'Victoria' : 'Derrota';
}

const HistoryView: React.FC<Props> = ({ matches, onBack }) => {
  return (
    <Paper sx={uiSx.historyFullscreenCard}>
      <Box sx={uiSx.historyHeader}>
        <Typography variant="h5" sx={uiSx.dashboardCardTitle}>
          Historial completo
        </Typography>
        <Button onClick={onBack}>Volver al inicio</Button>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Partida</TableCell>
              <TableCell>Resultado</TableCell>
              <TableCell>Modo</TableCell>
              <TableCell>Bot</TableCell>
              <TableCell>Ganador</TableCell>
              <TableCell>Fecha</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>Todavia no hay partidas registradas.</TableCell>
              </TableRow>
            )}
            {matches.map((match) => (
              <TableRow key={`${match.gameId}-${match.endedAt}`}>
                <TableCell>{match.gameId}</TableCell>
                <TableCell>{resultLabel(match.result)}</TableCell>
                <TableCell>{modeLabel(match.mode)}</TableCell>
                <TableCell>{match.botId ? botHistoryLabels[match.botId] ?? match.botId : '-'}</TableCell>
                <TableCell>{match.winnerId ?? '-'}</TableCell>
                <TableCell>{new Date(match.endedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default HistoryView;
