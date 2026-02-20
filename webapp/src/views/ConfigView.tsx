import React from 'react';
import type { GameMode } from '../gameyApi';

type Props = {
  boardSize: number;
  mode: GameMode;
  loading: boolean;
  setMode: (m: GameMode) => void;
  updateBoardSize: (n: number) => void;
  createNewGame: () => void;
  onBack: () => void;
};

const ConfigView: React.FC<Props> = ({
  boardSize,
  mode,
  loading,
  setMode,
  updateBoardSize,
  createNewGame,
  onBack,
}) => {
  return (
    <div className="app">
      <h2>Configurar nueva partida</h2>

      <section className="panel">
        <div className="controls">
          <label htmlFor="size-input">Tamaño</label>
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

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={createNewGame} disabled={loading}>
              {loading ? 'Cargando...' : 'Crear partida'}
            </button>
            <button type="button" onClick={onBack}>
              Volver
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ConfigView;
