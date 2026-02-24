import './App.css';
import { useEffect, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { useGamey } from './useGamey';
import LoginView from './views/LoginView';
import ConfigView from './views/ConfigView';
import GameView from './views/GameView';
import { uiSx } from './theme';

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

  const [view, setView] = useState<'login' | 'config' | 'game'>('login');

  useEffect(() => {
    if (game) setView('game');
  }, [game]);

  return (
    <Box sx={uiSx.appShell}>
      <Box sx={uiSx.appHeader}>
        <Typography component="h1" sx={uiSx.appHeaderTitle}>
          GAME Y
        </Typography>
      </Box>

      <Box sx={uiSx.appRoot}>
        {error && (
          <Alert severity="error" sx={uiSx.errorText}>
            {error}
          </Alert>
        )}

        {view === 'login' && <LoginView onNext={() => setView('config')} />}

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
      </Box>
    </Box>
  );
}

export default App;
