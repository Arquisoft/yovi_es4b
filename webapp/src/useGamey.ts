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
import { mapDifficultyToBotId, type BotDifficulty } from './views/statsTypes';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export function useGamey(userId?: string) {
  const [boardSize, setBoardSize] = useState(7);
  const [mode, setMode] = useState<GameMode>('human_vs_bot'); // modo inicial
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('easy'); // dificultad inicial
  const [game, setGame] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const board = useMemo(() => (game ? toBoardCells(game) : []), [game]);
  const canPlayCell = useMemo(() => (game ? canHumanPlay(game) : false), [game]);
  const statusText = useMemo(() => (game ? gameStatusText(game) : ''), [game]);

  async function runRequest(request: Promise<GameStateResponse>): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const nextGame = await request;
      setGame(nextGame);
      return true;
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
      return false;
    } finally {
      setLoading(false);
    }
  }

  function updateBoardSize(value: number) {
    setBoardSize(Math.max(1, value));
  }

  async function createNewGame(
    next?: { mode?: GameMode; size?: number; botId?: string }
  ) {
    const nextMode = next?.mode ?? mode;
    const nextSize = next?.size ?? boardSize;
    const nextBotId = next?.botId ?? mapDifficultyToBotId(botDifficulty);

    // `createGame` ahora solo necesita mode + bot_id opcional
    return runRequest(
      createGame(
        {
          size: nextSize,
          mode: nextMode,
          ...(nextBotId ? { bot_id: nextBotId } : {}),
        },
        userId
      )
    );
  }

  async function refreshCurrentGame() {
    if (!game) return;
    await runRequest(getGame(game.game_id));
  }

  async function resignCurrentGame() {
    if (!game) return;
    await runRequest(resignGame(game.game_id, userId));
  }

  async function playCell(coords: Coordinates) {
    if (!game || !canPlayCell || loading) return;
    await runRequest(playMove(game.game_id, { coords }, userId));
  }

  return {
    boardSize,
    mode,
    botDifficulty,
    game,
    error,
    loading,
    board,
    canPlayCell,
    statusText,
    setMode,
    setBotDifficulty,
    updateBoardSize,
    createNewGame,
    refreshCurrentGame,
    resignCurrentGame,
    playCell,
  };
}
