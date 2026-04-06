import './App.css';
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { useGamey } from './useGamey';
import { useStats } from './useStats';
import { useAuth } from './hooks/useAuth';
import LoginView from './views/LoginView';
import GameView from './views/GameView';
import SidebarView from './views/SidebarView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import HelpView from './views/HelpView';
import { uiSx } from './theme';

function App() {
  const auth = useAuth();
  const stats = useStats(auth.username ?? undefined);
  const { refreshStats } = stats;
  const lastSyncedFinishedGameRef = useRef<string | null>(null);

  const {
    boardSize,
    mode,
    botDifficulty,
    game,
    error,
    loading,
    board,
    canPlayCell,
    hintCoords,
    setMode,
    setBotDifficulty,
    updateBoardSize,
    createNewGame,
    resignCurrentGame,
    requestHint,
    playCell,
  } = useGamey(auth.username ?? undefined);

  const [view, setView] = useState<'login' | 'dashboard' | 'history' | 'game' | 'help'>('dashboard');

  async function handleCreateNewGame() {
    const created = await createNewGame();
    if (created) {
      setView('game');
    }
  }

  function handleOpenPlay() {
    setView('dashboard');
  }

  function handleOpenStats() {
    setView('history');
    void refreshStats();
  }

  useEffect(() => {
    if (!game || !game.game_over) {
      return;
    }

    const finishedGameKey = `${game.game_id}:${game.winner ?? 'none'}`;
    if (lastSyncedFinishedGameRef.current === finishedGameKey) {
      return;
    }

    lastSyncedFinishedGameRef.current = finishedGameKey;
    void refreshStats();
  }, [game, refreshStats]);

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
          onOpenPlay={handleOpenPlay}
          onOpenStats={handleOpenStats}
          onOpenHelp={() => setView('help')}
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
            />
          )}

          {view === 'history' && (
            <HistoryView
              playerStats={stats.playerStats}
              matches={stats.matches}
            />
          )}

          {view === 'help' && <HelpView />}

          {view === 'game' && (
            <GameView
              game={game}
              board={board}
              canPlayCell={canPlayCell}
              loading={loading}
              hintCoords={hintCoords}
              resignCurrentGame={resignCurrentGame}
              requestHint={requestHint}
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
