import React from 'react';
import { cellClassName } from '../gameyUi';

type Props = {
  game: any | null;
  board: any[];
  statusText: string;
  canPlayCell: boolean;
  loading: boolean;
  refreshCurrentGame: () => void;
  resignCurrentGame: () => void;
  playCell: (coords: any) => Promise<void> | void;
  onBack: () => void;
};

const GameView: React.FC<Props> = ({
  game,
  board,
  statusText,
  canPlayCell,
  loading,
  refreshCurrentGame,
  resignCurrentGame,
  playCell,
  onBack,
}) => {
  if (!game) return <div>No hay partida activa.</div>;

  return (
    <div className="app">
      <h2>Partida {game.game_id}</h2>
      <p className="status-text">{statusText}</p>

      <div className="actions" style={{ marginBottom: 8 }}>
        <button type="button" onClick={refreshCurrentGame} disabled={loading}>
          Refrescar
        </button>
        <button type="button" onClick={resignCurrentGame} disabled={loading || game.game_over}>
          Rendirse
        </button>
        <button type="button" onClick={onBack}>
          Volver a configuracion
        </button>
      </div>

      <div className="board">
        {board.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="board-row"
            style={{ marginLeft: `${(game.yen.size - rowIndex - 1) * 16}px` }}
          >
            {row.map((cell: any) => {
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
    </div>
  );
};

export default GameView;
