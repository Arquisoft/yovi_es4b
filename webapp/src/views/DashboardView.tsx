import React from 'react';
import { Box } from '@mui/material';
import type { GameMode } from '../gameyApi';
import { uiSx } from '../theme';
import ConfigView from './ConfigView';
import MatchHistoryPreviewCardView from './MatchHistoryPreviewCardView';
import PlayerStatsCardView from './PlayerStatsCardView';
import type { BotDifficulty, MatchHistoryItem, PlayerStatsSummary } from '../stats/types';

type Props = {
  boardSize: number;
  mode: GameMode;
  botDifficulty: BotDifficulty;
  loading: boolean;
  setMode: (mode: GameMode) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  updateBoardSize: (size: number) => void;
  createNewGame: () => void;
  playerStats: PlayerStatsSummary;
  matches: MatchHistoryItem[];
  onViewMoreMatches: () => void;
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
  playerStats,
  matches,
  onViewMoreMatches,
}) => {
  return (
    <Box sx={uiSx.dashboardShell}>
      <Box sx={uiSx.dashboardTopRow}>
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

        <PlayerStatsCardView playerStats={playerStats} />
      </Box>

      <MatchHistoryPreviewCardView matches={matches} onViewMoreMatches={onViewMoreMatches} />
    </Box>
  );
};

export default DashboardView;
