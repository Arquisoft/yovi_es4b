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
  const [matchmakingTicketId, setMatchmakingTicketId] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus | 'idle'>('idle');
  const [matchmakingPosition, setMatchmakingPosition] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [myPlayerToken, setMyPlayerToken] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

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

  function clearPollingTimer() {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function resetMatchmakingState(clearPlayerIdentity = true) {
    clearPollingTimer();
    setMatchmakingTicketId(null);
    setMatchmakingStatus('idle');
    setMatchmakingPosition(null);
    if (clearPlayerIdentity) {
      setMyPlayerId(null);
      setMyPlayerToken(null);
    }
  }

  useEffect(
    () => () => {
      clearPollingTimer();
    },
    [],
  );

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
    resetMatchmakingState();
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
    await runRequest(resignGame(game.game_id, myPlayerToken ?? undefined));
  }

  async function playCell(coords: Coordinates) {
    if (!game || !canPlayCell || loading) {
      return;
    }
    await runRequest(
      playMove(game.game_id, {
        coords,
        ...(myPlayerToken ? { player_token: myPlayerToken } : {}),
      }),
    );
  }

  function scheduleTicketPoll(ticketId: string, delayMs: number) {
    clearPollingTimer();
    pollTimerRef.current = window.setTimeout(() => {
      void pollMatchmakingTicket(ticketId);
    }, delayMs);
  }

  async function pollMatchmakingTicket(ticketId: string) {
    try {
      const ticket = await getMatchmakingTicket(ticketId);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);

      if (ticket.status === 'waiting') {
        scheduleTicketPoll(ticketId, ticket.poll_after_ms ?? 1_000);
        return;
      }

      clearPollingTimer();

      if (
        ticket.status === 'matched' &&
        ticket.game_id &&
        ticket.player_id !== null &&
        ticket.player_token
      ) {
        setMyPlayerId(ticket.player_id);
        setMyPlayerToken(ticket.player_token);
        const nextGame = await getGame(ticket.game_id);
        setGame(nextGame);
      }
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
      clearPollingTimer();
      setMatchmakingStatus('idle');
    }
  }

  async function startMatchmaking() {
    if (loading || matchmakingStatus === 'waiting') {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setGame(null);
      setMyPlayerId(null);
      setMyPlayerToken(null);
      const ticket = await enqueueMatchmaking(boardSize);
      setMatchmakingTicketId(ticket.ticket_id);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);
      if (ticket.status === 'waiting') {
        scheduleTicketPoll(ticket.ticket_id, ticket.poll_after_ms ?? 1_000);
      }
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function cancelCurrentMatchmaking() {
    if (!matchmakingTicketId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await cancelMatchmakingTicket(matchmakingTicketId);
      resetMatchmakingState();
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
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
    matchmakingTicketId,
    matchmakingStatus,
    matchmakingPosition,
    myPlayerId,
    setMode,
    updateBoardSize,
    createNewGame,
    startMatchmaking,
    cancelCurrentMatchmaking,
    refreshCurrentGame,
    resignCurrentGame,
    playCell,
  };
}
