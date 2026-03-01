import './App.css';
import { useEffect, useState } from 'react';
import { useGamey } from './useGamey';
import { useAuth } from './hooks/useAuth';
import LoginView from './views/LoginView';
import ConfigView from './views/ConfigView';
import GameView from './views/GameView';
import { Button, Typography, Box } from '@mui/material';

function App() {
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
  } = useGamey();

  const auth = useAuth();

  const [view, setView] = useState<'login' | 'config' | 'game'>('config');

  useEffect(() => {
    if (game) setView('game');
  }, [game]);

  // If auth is still verifying the token, show nothing
  if (auth.loading) return null;

  // If not authenticated, always show login
  if (!auth.isAuthenticated) {
    return (
      <div className="app">
        <h1>GameY Web</h1>
        <br />
        <LoginView
          onNext={() => {}}
          onAuth={(token, username) => auth.login(token, username)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
        <h1>GameY Web</h1>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body1">Hello, {auth.username}!</Typography>
          <Button variant="outlined" size="small" onClick={auth.logout}>
            Logout
          </Button>
        </Box>
      </Box>
      <br />

      {error && <p className="error-text">{error}</p>}

      {view === 'login' && (
        <LoginView
          onNext={() => setView('config')}
          onAuth={(token, username) => auth.login(token, username)}
        />
      )}

      {view === 'config' && (
        <ConfigView
          boardSize={boardSize}
          mode={mode}
          loading={loading}
          setMode={setMode}
          updateBoardSize={updateBoardSize}
          createNewGame={createNewGame}
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
    </div>
  );
}

export default App;
