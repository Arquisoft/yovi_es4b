import React from 'react';
import type { GameMode } from '../gameyApi';
import { Box, Paper, TextField, MenuItem, Button, Typography } from '@mui/material';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', width: '100%' }}>
      <Typography variant="h5">Configurar nueva partida</Typography>

      <Paper sx={{ p: 3, width: '100%', maxWidth: 640 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            id="size-input"
            label="Tamaño"
            type="number"
            value={boardSize}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              updateBoardSize(Number.isNaN(next) ? 1 : next);
            }}
            size="small"
            variant="filled"
          />

          <TextField
            id="mode-select"
            select
            label="Modo"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameMode)}
            size="small"
            variant="filled"
          >
            <MenuItem value="human_vs_bot">Human vs Bot</MenuItem>
            <MenuItem value="human_vs_human">Human vs Human</MenuItem>
          </TextField>

          <Box sx={{ display: 'flex', gap: 1 }}>
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
