import React from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import type { GameMode } from '../gameyApi';
import { uiSx } from '../theme';
import { botDifficultyOptions, type BotDifficulty } from './statsTypes';

type Props = {
  boardSize: number;
  mode: GameMode;
  botDifficulty: BotDifficulty;
  loading: boolean;
  setMode: (mode: GameMode) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  updateBoardSize: (size: number) => void;
  createNewGame: () => void;
};

const ConfigView: React.FC<Props> = ({
  boardSize,
  mode,
  botDifficulty,
  loading,
  setMode,
  setBotDifficulty,
  updateBoardSize,
  createNewGame,
}) => {
  return (
    <Paper sx={uiSx.dashboardCard}>
      <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
        Configurar partida
      </Typography>
      <Box sx={uiSx.dashboardCardHint}>Elige parametros y crea una nueva partida.</Box>

      <Box sx={uiSx.configGrid}>
        <Box sx={uiSx.configRow}>
          <Typography sx={uiSx.configSectionTitle}>Tamano</Typography>
          <TextField
            id="size-input"
            type="number"
            size="small"
            value={boardSize}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              updateBoardSize(Number.isNaN(next) ? 1 : next);
            }}
            sx={uiSx.configSizeInput}
          />
        </Box>

        <Box sx={uiSx.configRowDivider} />

        <Box sx={uiSx.configRowStart}>
          <Typography sx={uiSx.configSectionTitle}>Modo</Typography>
          <Box sx={uiSx.configOptionGroup}>
            <Button
              variant="outlined"
              sx={uiSx.configToggleButton(mode === 'human_vs_bot')}
              onClick={() => setMode('human_vs_bot')}
            >
              Human vs Bot
            </Button>
            <Button
              variant="outlined"
              sx={uiSx.configToggleButton(mode === 'human_vs_human')}
              onClick={() => setMode('human_vs_human')}
            >
              Human vs Humano
            </Button>
          </Box>
        </Box>

        <Box sx={uiSx.configRowDivider} />

        <Box sx={uiSx.configRowStart}>
          <Typography sx={uiSx.configSectionTitle}>Bot</Typography>
          <Box sx={uiSx.configOptionGroup}>
            {botDifficultyOptions.map((option) => (
              <Button
                key={option.value}
                variant="outlined"
                sx={uiSx.configToggleButton(mode === 'human_vs_bot' && botDifficulty === option.value)}
                disabled={mode !== 'human_vs_bot'}
                onClick={() => setBotDifficulty(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={uiSx.configActions}>
        <Button onClick={createNewGame} disabled={loading}>
          {loading ? 'Cargando...' : 'Crear partida'}
        </Button>
      </Box>
    </Paper>
  );
};

export default ConfigView;
