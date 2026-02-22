import './App.css';
import { useEffect, useState } from 'react';
import { useGamey } from './useGamey';
import LoginView from './views/LoginView';
import ConfigView from './views/ConfigView';
import GameView from './views/GameView';

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
    <div className="app">
      <h1>GameY Web</h1>
      <br></br>

      {error && <p className="error-text">{error}</p>}

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
    </div>
  );
}

export default App;
