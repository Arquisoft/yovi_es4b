import React from 'react';
import { Box } from '@mui/material';
import type { GameMode } from '../gameyApi';
import { uiSx } from '../theme';
import ConfigView from './ConfigView';
import type { BotDifficulty } from '../stats/types';

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

const DashboardView: React.FC<Props> = ({
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
    <Box sx={{ ...uiSx.dashboardShell, maxWidth: 760 }}>
      <ConfigView
        boardSize={boardSize}
        mode={mode}
        botDifficulty={botDifficulty}
        loading={loading}
        setMode={setMode}
        setBotDifficulty={setBotDifficulty}
        updateBoardSize={updateBoardSize}
        createNewGame={createNewGame}
      />
    </Box>
  );
};

export default DashboardView;
