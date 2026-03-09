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
  const sectionTitleSx = {
    fontSize: '0.76rem',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'text.secondary',
    fontWeight: 700,
  } as const;

  const toggleButtonSx = (active: boolean) =>
    ({
      minWidth: { xs: '100%', sm: 108 },
      height: 34,
      px: 1.4,
      borderRadius: 1.4,
      fontSize: '0.88rem',
      fontWeight: 700,
      color: active ? 'text.primary' : 'text.secondary',
      backgroundColor: active ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
      borderColor: active ? 'primary.light' : 'divider',
      '&:hover': {
        backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.12)',
        borderColor: active ? 'primary.light' : 'primary.main',
      },
    }) as const;

  const rowSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '112px 1fr' },
    gap: 1.1,
    alignItems: 'center',
  } as const;

  const rowDividerSx = {
    borderTop: '1px solid',
    borderColor: 'divider',
    opacity: 0.45,
    my: 0.4,
  } as const;

  return (
    <Paper sx={uiSx.dashboardCard}>
      <Typography variant="h6" sx={uiSx.dashboardCardTitle}>
        Configurar partida
      </Typography>
      <Box sx={uiSx.dashboardCardHint}>Elige parametros y crea una nueva partida.</Box>

      <Box sx={{ mt: 0.9, display: 'grid', gap: 1.35 }}>
        <Box sx={rowSx}>
          <Typography sx={sectionTitleSx}>Tamano</Typography>
          <TextField
            id="size-input"
            type="number"
            size="small"
            value={boardSize}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              updateBoardSize(Number.isNaN(next) ? 1 : next);
            }}
            sx={{ width: { xs: '100%', sm: 220 } }}
          />
        </Box>

        <Box sx={rowDividerSx} />

        <Box sx={{ ...rowSx, alignItems: 'start' }}>
          <Typography sx={sectionTitleSx}>Modo</Typography>
          <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1 }}>
            <Button
              variant="outlined"
              sx={toggleButtonSx(mode === 'human_vs_bot')}
              onClick={() => setMode('human_vs_bot')}
            >
              Human vs Bot
            </Button>
            <Button
              variant="outlined"
              sx={toggleButtonSx(mode === 'human_vs_human')}
              onClick={() => setMode('human_vs_human')}
            >
              Human vs Human
            </Button>
          </Box>
        </Box>

        <Box sx={rowDividerSx} />

        <Box sx={{ ...rowSx, alignItems: 'start' }}>
          <Typography sx={sectionTitleSx}>Bot</Typography>
          <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1 }}>
            {botDifficultyOptions.map((option) => (
              <Button
                key={option.value}
                variant="outlined"
                sx={toggleButtonSx(botDifficulty === option.value)}
                disabled={mode !== 'human_vs_bot'}
                onClick={() => setBotDifficulty(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', pt: 0.8, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={createNewGame} disabled={loading}>
          {loading ? 'Cargando...' : 'Crear partida'}
        </Button>
      </Box>
    </Paper>
  );
};

export default ConfigView;
