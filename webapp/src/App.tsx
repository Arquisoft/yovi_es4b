import { useMemo, useState } from 'react';
import './App.css';
import RegisterForm from './RegisterForm';
import {
  createGame,
  getGame,
  playMove,
  resignGame,
  type Coordinates,
  type GameMode,
  type GameStateResponse,
} from './gameyApi';

interface BoardCell {
  key: string;
  symbol: string;
  coords: Coordinates;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

function playerName(game: GameStateResponse, playerId: number): string {
  const symbol = game.yen.players[playerId] ?? '?';
  return `Player ${playerId} (${symbol})`;
}

function toBoardCells(game: GameStateResponse): BoardCell[][] {
  const rows = game.yen.layout.split('/');
  const size = game.yen.size;

  return rows.map((row, rowIndex) =>
    Array.from(row).map((symbol, columnIndex) => {
      const x = size - 1 - rowIndex;
      const y = columnIndex;
      const z = rowIndex - columnIndex;
      const coords = { x, y, z };
      return {
        key: `${rowIndex}-${columnIndex}`,
        symbol,
        coords,
      };
    }),
  );
}

function App() {
  const [boardSize, setBoardSize] = useState(7);
  const [mode, setMode] = useState<GameMode>('human_vs_bot');
  const [game, setGame] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const board = useMemo(() => (game ? toBoardCells(game) : []), [game]);

  const canPlayCell =
    game !== null &&
    !game.game_over &&
    (game.mode === 'human_vs_human' || game.next_player === 0);

  async function runRequest(request: Promise<GameStateResponse>) {
    setLoading(true);
    setError(null);
    try {
      const nextGame = await request;
      setGame(nextGame);
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGame() {
    await runRequest(createGame({ size: boardSize, mode }));
  }

  async function handleRefreshGame() {
    if (!game) {
      return;
    }
    await runRequest(getGame(game.game_id));
  }

  async function handleResignGame() {
    if (!game) {
      return;
    }
    await runRequest(resignGame(game.game_id));
  }

  async function handlePlayMove(coords: Coordinates) {
    if (!game || !canPlayCell || loading) {
      return;
    }
    await runRequest(playMove(game.game_id, { coords }));
  }

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
              setBoardSize(Number.isNaN(next) ? 1 : Math.max(1, next));
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

          <button type="button" onClick={handleCreateGame} disabled={loading}>
            {loading ? 'Cargando...' : 'Crear partida'}
          </button>
        </div>
      </section>

      {error && <p className="error-text">{error}</p>}

      {game && (
        <section className="panel">
          <h2>Partida {game.game_id}</h2>
          <p className="status-text">
            {game.game_over
              ? `Partida finalizada. Ganador: ${
                  game.winner === null ? 'desconocido' : playerName(game, game.winner)
                }`
              : `Turno: ${
                  game.next_player === null ? 'desconocido' : playerName(game, game.next_player)
                }`}
          </p>

          <div className="actions">
            <button type="button" onClick={handleRefreshGame} disabled={loading}>
              Refrescar
            </button>
            <button type="button" onClick={handleResignGame} disabled={loading || game.game_over}>
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
                  const className =
                    cell.symbol === 'B' ? 'cell cell-b' : cell.symbol === 'R' ? 'cell cell-r' : 'cell cell-empty';
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={className}
                      disabled={!isEmpty || !canPlayCell || loading}
                      title={`${cell.coords.x},${cell.coords.y},${cell.coords.z}`}
                      onClick={() => void handlePlayMove(cell.coords)}
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
