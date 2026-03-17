import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelMatchmakingTicket,
  createGame,
  enqueueMatchmaking,
  getGame,
  getMatchmakingTicket,
  playMove,
  resignGame,
  type Coordinates,
  type GameMode,
  type GameStateResponse,
  type MatchmakingStatus,
} from './gameyApi';
import { canHumanPlay, gameStatusText, toBoardCells } from './gameyUi';
import { mapDifficultyToBotId, type BotDifficulty } from './stats/types';

const DEFAULT_POLL_DELAY_MS = 1_000;
const ONLINE_SYNC_DELAY_MS = 1_200;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export function useGamey(userId?: string) {
  const [boardSize, setBoardSize] = useState(7);
  const [mode, setMode] = useState<GameMode>('human_vs_bot');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('easy');
  const [game, setGame] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchmakingTicketId, setMatchmakingTicketId] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus | 'idle'>('idle');
  const [matchmakingPosition, setMatchmakingPosition] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [myPlayerToken, setMyPlayerToken] = useState<string | null>(null);

  const ticketPollTimerRef = useRef<number | null>(null);
  const onlineSyncTimerRef = useRef<number | null>(null);

  const board = useMemo(() => (game ? toBoardCells(game) : []), [game]);
  const canPlayCell = useMemo(() => {
    if (!game || game.game_over) {
      return false;
    }
    if (myPlayerId !== null) {
      return game.next_player === myPlayerId;
    }
    return canHumanPlay(game);
  }, [game, myPlayerId]);
  const statusText = useMemo(() => {
    if (!game) {
      return '';
    }
    const text = gameStatusText(game);
    return myPlayerId === null ? text : `${text} | Tu jugador: ${myPlayerId}`;
  }, [game, myPlayerId]);

  function clearTicketPollingTimer() {
    if (ticketPollTimerRef.current !== null) {
      window.clearTimeout(ticketPollTimerRef.current);
      ticketPollTimerRef.current = null;
    }
  }

  function clearOnlineSyncTimer() {
    if (onlineSyncTimerRef.current !== null) {
      window.clearInterval(onlineSyncTimerRef.current);
      onlineSyncTimerRef.current = null;
    }
  }

  function resetMatchmakingState(clearIdentity = true) {
    clearTicketPollingTimer();
    setMatchmakingTicketId(null);
    setMatchmakingStatus('idle');
    setMatchmakingPosition(null);
    if (clearIdentity) {
      setMyPlayerId(null);
      setMyPlayerToken(null);
      clearOnlineSyncTimer();
    }
  }

  useEffect(
    () => () => {
      clearTicketPollingTimer();
      clearOnlineSyncTimer();
    },
    [],
  );

  useEffect(() => {
    clearOnlineSyncTimer();

    if (!game || game.game_over || myPlayerId === null) {
      return;
    }

    onlineSyncTimerRef.current = window.setInterval(() => {
      void getGame(game.game_id)
        .then((nextGame) => {
          setGame(nextGame);
        })
        .catch((syncError: unknown) => {
          setError(toErrorMessage(syncError));
        });
    }, ONLINE_SYNC_DELAY_MS);

    return () => {
      clearOnlineSyncTimer();
    };
  }, [game?.game_id, game?.game_over, myPlayerId]);

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
    resetMatchmakingState(true);

    const nextMode = next?.mode ?? mode;
    const nextSize = next?.size ?? boardSize;
    const nextBotId =
      nextMode === 'human_vs_bot'
        ? (next?.botId ?? mapDifficultyToBotId(botDifficulty))
        : undefined;

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
    await runRequest(resignGame(game.game_id, userId, myPlayerToken ?? undefined));
  }

  async function playCell(coords: Coordinates) {
    if (!game || !canPlayCell || loading) return;
    await runRequest(
      playMove(
        game.game_id,
        {
          coords,
          ...(myPlayerToken ? { player_token: myPlayerToken } : {}),
        },
        userId
      )
    );
  }

  function scheduleTicketPoll(ticketId: string, delayMs: number) {
    clearTicketPollingTimer();
    ticketPollTimerRef.current = window.setTimeout(() => {
      void pollMatchmakingTicket(ticketId);
    }, delayMs);
  }

  async function pollMatchmakingTicket(ticketId: string) {
    try {
      const ticket = await getMatchmakingTicket(ticketId);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);

      if (ticket.status === 'waiting') {
        scheduleTicketPoll(ticketId, ticket.poll_after_ms ?? DEFAULT_POLL_DELAY_MS);
        return;
      }

      clearTicketPollingTimer();

      if (
        ticket.status === 'matched' &&
        ticket.game_id &&
        ticket.player_id !== null &&
        ticket.player_token
      ) {
        setMyPlayerId(ticket.player_id);
        setMyPlayerToken(ticket.player_token);
        setMatchmakingTicketId(null);
        const nextGame = await getGame(ticket.game_id);
        setGame(nextGame);
      }
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
      clearTicketPollingTimer();
      setMatchmakingStatus('idle');
    }
  }

  async function startMatchmaking() {
    if (loading || matchmakingStatus === 'waiting') {
      return;
    }

    setLoading(true);
    setError(null);
    setGame(null);
    setMyPlayerId(null);
    setMyPlayerToken(null);
    clearOnlineSyncTimer();

    try {
      const ticket = await enqueueMatchmaking(boardSize, userId);
      setMatchmakingTicketId(ticket.ticket_id);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);
      if (ticket.status === 'waiting') {
        scheduleTicketPoll(ticket.ticket_id, ticket.poll_after_ms ?? DEFAULT_POLL_DELAY_MS);
      }
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
      setMatchmakingStatus('idle');
    } finally {
      setLoading(false);
    }
  }

  async function cancelCurrentMatchmaking() {
    if (!matchmakingTicketId || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await cancelMatchmakingTicket(matchmakingTicketId);
      clearTicketPollingTimer();
      setMatchmakingTicketId(null);
      setMatchmakingPosition(null);
      setMatchmakingStatus('cancelled');
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
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
    matchmakingTicketId,
    matchmakingStatus,
    matchmakingPosition,
    myPlayerId,
    setMode,
    setBotDifficulty,
    updateBoardSize,
    createNewGame,
    startMatchmaking,
    cancelCurrentMatchmaking,
    refreshCurrentGame,
    resignCurrentGame,
    playCell,
  };
}
