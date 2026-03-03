import './App.css';
import { useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { useGamey } from './useGamey';
import { useAuth } from './hooks/useAuth';
import LoginView from './views/LoginView';
import ConfigView from './views/ConfigView';
import GameView from './views/GameView';
import { uiSx } from './theme';

function App() {
  const auth = useAuth();

  const {
    boardSize,
    mode,
    game,
    error,
    loading,
    board,
    canPlayCell,
    statusText,
    setMode,
    updateBoardSize,
    createNewGame,
    refreshCurrentGame,
    resignCurrentGame,
    playCell,
  } = useGamey(auth.username ?? undefined);

  const [view, setView] = useState<'login' | 'config' | 'game'>('config');

  async function handleCreateNewGame() {
    const created = await createNewGame();

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
          <LoginView onNext={() => {}} onAuth={auth.login} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={uiSx.appShell}>
      <Box sx={uiSx.appHeader}>
        <Box sx={uiSx.appHeaderUserRow}>
          <Typography component="h1" sx={uiSx.appHeaderTitleSecondary}>
            GAME Y
          </Typography>

          <Box sx={uiSx.appHeaderActions}>
            <Typography variant="body1">Hello, {auth.username}!</Typography>
            <Button variant="outlined" size="small" onClick={auth.logout}>
              Logout
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={uiSx.appRoot}>
        {error && (
          <Alert severity="error" sx={uiSx.errorText}>
            {error}
          </Alert>
        )}

        {view === 'login' && <LoginView onNext={() => setView('config')} onAuth={auth.login} />}

        {view === 'config' && (
          <ConfigView
            boardSize={boardSize}
            mode={mode}
            loading={loading}
            setMode={setMode}
            updateBoardSize={updateBoardSize}
            createNewGame={handleCreateNewGame}
            onBack={() => setView('login')}
          />
        )}

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
            onBack={() => setView('config')}
          />
        )}
      </Box>
    </Box>
  );
}

export default App;

