import React from 'react';
import type { GameMode } from '../gameyApi';
import { Box, Paper, TextField, MenuItem, Button, Typography } from '@mui/material';
import { uiSx } from '../theme';

type Props = {
  boardSize: number;
  mode: GameMode;
  loading: boolean;
  setMode: (m: GameMode) => void;
  updateBoardSize: (n: number) => void;
  createNewGame: () => void;
  onBack: () => void;
};

const ConfigView: React.FC<Props> = ({
  boardSize,
  mode,
  loading,
  setMode,
  updateBoardSize,
  createNewGame,
  onBack,
}) => {
  return (
    <Box sx={uiSx.centeredColumn}>
      <Typography variant="h5">Configurar nueva partida</Typography>

      <Paper sx={uiSx.panel(640)}>
        <Box sx={uiSx.configRow}>
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

          <Box sx={uiSx.centeredRow}>
            <Button variant="contained" onClick={createNewGame} disabled={loading}>
              {loading ? 'Cargando...' : 'Crear partida'}
            </Button>
            <Button variant="outlined" onClick={onBack}>
              Volver
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ConfigView;
