import './App.css';
import RegisterForm from './RegisterForm';
import type { GameMode } from './gameyApi';
import { cellClassName } from './gameyUi';
import { useGamey } from './useGamey';

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

  return (
    <div className="app">
      <h1>GameY Web</h1>
      <p className="subtitle">Crear partida y jugar desde el navegador</p>

      <section className="panel">
        <h2>Nueva partida</h2>
        <div className="controls">
          <label htmlFor="size-input">Tamano</label>
          <input
            id="size-input"
            type="number"
            min={1}
            value={boardSize}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              updateBoardSize(Number.isNaN(next) ? 1 : next);
            }}
          />

          <label htmlFor="mode-select">Modo</label>
          <select
            id="mode-select"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameMode)}
          >
            <option value="human_vs_bot">Human vs Bot</option>
            <option value="human_vs_human">Human vs Human</option>
          </select>

          <button type="button" onClick={createNewGame} disabled={loading}>
            {loading ? 'Cargando...' : 'Crear partida'}
          </button>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      {game && (
        <section className="panel">
          <h2>Partida {game.game_id}</h2>
          <p className="status-text">{statusText}</p>

          <div className="actions">
            <button type="button" onClick={refreshCurrentGame} disabled={loading}>
              Refrescar
            </button>
            <button type="button" onClick={resignCurrentGame} disabled={loading || game.game_over}>
              Rendirse
            </button>
          </div>

          <div className="board">
            {board.map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="board-row"
                style={{ marginLeft: `${(game.yen.size - rowIndex - 1) * 16}px` }}
              >
                {row.map((cell) => {
                  const isEmpty = cell.symbol === '.';
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={cellClassName(cell.symbol)}
                      disabled={!isEmpty || !canPlayCell || loading}
                      title={`${cell.coords.x},${cell.coords.y},${cell.coords.z}`}
                      onClick={() => void playCell(cell.coords)}
                    >
                      {isEmpty ? '.' : cell.symbol}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Registro</h2>
        <RegisterForm />
      </section>
    </div>
  );
}

export default App;
