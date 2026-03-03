import React from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { uiSx } from '../theme';
import type { MatchHistoryItem } from './statsTypes';

type Props = {
  matches: MatchHistoryItem[];
  onBack: () => void;
};

function modeLabel(mode: MatchHistoryItem['mode']) {
  return mode === 'human_vs_bot' ? 'Bot' : 'Humano';
}

function resultLabel(result: MatchHistoryItem['result']) {
  return result === 'win' ? 'Victoria' : 'Derrota';
}

const HistoryView: React.FC<Props> = ({ matches, onBack }) => {
  return (
    <Paper sx={uiSx.historyFullscreenCard}>
      <Box sx={uiSx.historyHeader}>
        <Typography variant="h5">Historial completo</Typography>
        <Button onClick={onBack}>Volver al inicio</Button>
      </Box>

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
            {matches.map((match) => (
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
    </Paper>
  );
};

export default HistoryView;
