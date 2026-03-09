import './App.css';
import { useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { useGamey } from './useGamey';
import { useStats } from './useStats';
import { useAuth } from './hooks/useAuth';
import LoginView from './views/LoginView';
import GameView from './views/GameView';
import type { GameMode } from './gameyApi';
import SidebarView from './views/SidebarView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import { mapDifficultyToBotId, type BotDifficulty } from './stats/types';
import { uiSx } from './theme';

function App() {
  const auth = useAuth();
  const stats = useStats(auth.username ?? undefined);

  const {
    boardSize,
    mode,
    botDifficulty,
    game,
    error,
    loading,
    board,
    canPlayCell,
    statusText,
    setMode,
    setBotDifficulty,
    updateBoardSize,
    createNewGame,
    refreshCurrentGame,
    resignCurrentGame,
    playCell,
  } = useGamey(auth.username ?? undefined);

  const [view, setView] = useState<'login' | 'dashboard' | 'history' | 'game'>('dashboard');

  async function handleCreateNewGame() {
    const created = await createNewGame();
    if (created) {
      setView('game');
    }
  }

  async function handleSidebarPlay(nextMode: GameMode, difficulty?: BotDifficulty) {
    setMode(nextMode);
    if (nextMode === 'human_vs_bot' && difficulty) {
      setBotDifficulty(difficulty);
    }

    const created = await createNewGame({
      mode: nextMode,
      botId: nextMode === 'human_vs_bot' && difficulty ? mapDifficultyToBotId(difficulty) : undefined,
    });
    if (created) {
      setView('game');
    }
  }

  // If auth is still verifying the token, show nothing
  if (auth.loading) return null;

  // If not authenticated, always show login
  if (!auth.isAuthenticated) {
    return (
      <Box sx={uiSx.appShell}>
        <Box sx={uiSx.appHeader}>
          <Typography component="h1" sx={uiSx.appHeaderTitle}>
            GAME Y
          </Typography>
        </Box>

        <Box sx={uiSx.appRoot}>
          <LoginView onNext={() => setView('dashboard')} onAuth={auth.login} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={uiSx.appShell}>
      <Box sx={uiSx.appHeader}>
        <Box sx={uiSx.appHeaderUserRow}>
          <Typography component="button" type="button" sx={uiSx.appHeaderTitleLink} onClick={() => setView('dashboard')}>
            GAME Y
          </Typography>

          <Box sx={uiSx.appHeaderUserBadge}>
            <Typography component="span" sx={uiSx.appHeaderUserText}>
              Hello,
            </Typography>
            <Typography component="span" sx={uiSx.appHeaderUserName}>
              {auth.username}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={uiSx.appBody}>
        <SidebarView
          onPlayBot={(difficulty) => handleSidebarPlay('human_vs_bot', difficulty)}
          onPlayHuman={() => handleSidebarPlay('human_vs_human')}
          onOpenStats={() => setView('history')}
          onLogout={auth.logout}
        />

        <Box sx={uiSx.appMain}>
          {error && (
            <Alert severity="error" sx={uiSx.errorText}>
              {error}
            </Alert>
          )}

          {stats.error && (
            <Alert severity="warning" sx={uiSx.errorText}>
              {stats.error}
            </Alert>
          )}

          {view === 'login' && <LoginView onNext={() => setView('dashboard')} onAuth={auth.login} />}

          {view === 'dashboard' && (
            <DashboardView
              boardSize={boardSize}
              mode={mode}
              botDifficulty={botDifficulty}
              loading={loading}
              setMode={setMode}
              setBotDifficulty={setBotDifficulty}
              updateBoardSize={updateBoardSize}
              createNewGame={handleCreateNewGame}
              playerStats={stats.playerStats}
              matches={stats.matches}
              onViewMoreMatches={() => setView('history')}
            />
          )}

          {view === 'history' && <HistoryView matches={stats.matches} onBack={() => setView('dashboard')} />}

          {view === 'game' && (
            <GameView
              game={game}
              board={board}
              statusText={statusText}
              canPlayCell={canPlayCell}
              loading={loading}
              refreshCurrentGame={refreshCurrentGame}
              resignCurrentGame={resignCurrentGame}
              playCell={playCell}
              onBack={() => setView('dashboard')}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default App;
