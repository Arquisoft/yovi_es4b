import React from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { uiSx } from '../theme';
import { botHistoryLabels, type MatchHistoryItem } from '../stats/types';

type Props = {
  matches: MatchHistoryItem[];
  onViewMoreMatches: () => void;
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  if (mode === 'human_vs_bot') return 'Bot';
  if (mode === 'human_vs_human') return 'Humano';
  return '-';
}

function resultLabel(result: MatchHistoryItem['result']) {
  return result === 'win' ? 'Victoria' : 'Derrota';
}

const MatchHistoryPreviewCardView: React.FC<Props> = ({ matches, onViewMoreMatches }) => {
  const visibleMatches = matches.slice(0, 3);

  return (
    <Paper sx={uiSx.dashboardHistoryCard}>
      <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
        Historial de partidas
      </Typography>
      <Box sx={uiSx.dashboardCardHint}>Tus ultimas partidas registradas.</Box>

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
            {visibleMatches.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>Todavia no hay partidas registradas.</TableCell>
              </TableRow>
            )}
            {visibleMatches.map((match) => (
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

      <Box sx={uiSx.historyFooter}>
        <Button variant="text" onClick={onViewMoreMatches}>
          Ver mas partidas
        </Button>
      </Box>
    </Paper>
  );
};

export default MatchHistoryPreviewCardView;
