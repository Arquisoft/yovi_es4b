import { useMemo, useState } from 'react';
import {
  createGame,
  getGame,
  playMove,
  resignGame,
  type Coordinates,
  type GameMode,
  type GameStateResponse,
} from './gameyApi';
import { canHumanPlay, gameStatusText, toBoardCells } from './gameyUi';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export function useGamey() {
  const [boardSize, setBoardSize] = useState(7);
  const [mode, setMode] = useState<GameMode>('human_vs_bot');
  const [game, setGame] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const board = useMemo(() => (game ? toBoardCells(game) : []), [game]);
  const canPlayCell = useMemo(() => (game ? canHumanPlay(game) : false), [game]);
  const statusText = useMemo(() => (game ? gameStatusText(game) : ''), [game]);

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

  function updateBoardSize(value: number) {
    setBoardSize(Math.max(1, value));
  }

  async function createNewGame() {
    await runRequest(createGame({ size: boardSize, mode }));
  }

  async function refreshCurrentGame() {
    if (!game) {
      return;
    }
    await runRequest(getGame(game.game_id));
  }

  async function resignCurrentGame() {
    if (!game) {
      return;
    }
    await runRequest(resignGame(game.game_id));
  }

  async function playCell(coords: Coordinates) {
    if (!game || !canPlayCell || loading) {
      return;
    }
    await runRequest(playMove(game.game_id, { coords }));
  }

  return {
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
  };
}
