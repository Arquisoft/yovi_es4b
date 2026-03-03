import React from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { uiSx } from '../theme';
import type { MatchHistoryItem } from './statsTypes';

type Props = {
  matches: MatchHistoryItem[];
  onViewMoreMatches: () => void;
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  return mode === 'human_vs_bot' ? 'Bot' : 'Humano';
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
  );
};

export default MatchHistoryPreviewCardView;
