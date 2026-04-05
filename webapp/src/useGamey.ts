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
  type MatchmakingTicketResponse,
} from './gameyApi';
import { canHumanPlay, gameStatusText, toBoardCells } from './gameyUi';
import {
  ONLINE_SESSION_VERSION,
  onlineSessionStore,
  type PersistedOnlineSession,
} from './onlineSessionStore';
import { mapDifficultyToBotId, type BotDifficulty } from './stats/types';

const DEFAULT_POLL_DELAY_MS = 1_000;
const ONLINE_SYNC_DELAY_MS = 1_200;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

function hasMatchedTicketDetails(
  ticket: MatchmakingTicketResponse,
): ticket is MatchmakingTicketResponse & {
  game_id: string;
  player_id: number;
  player_token: string;
} {
  return (
    ticket.status === 'matched' &&
    typeof ticket.game_id === 'string' &&
    ticket.player_id !== null &&
    typeof ticket.player_token === 'string'
  );
}

function isMissingOnlineSessionError(message: string): boolean {
  return message.startsWith('Ticket not found:') || message.startsWith('Game not found:');
}

export function useGamey(userId?: string) {
  const [boardSize, setBoardSize] = useState(7);
  const [mode, setMode] = useState<GameMode>('human_vs_bot');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('easy');
  const [game, setGame] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(() => {
    const normalizedUserId = userId?.trim();
    return Boolean(normalizedUserId && onlineSessionStore.load(normalizedUserId));
  });
  const [matchmakingTicketId, setMatchmakingTicketId] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus | 'idle'>('idle');
  const [matchmakingPosition, setMatchmakingPosition] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [myPlayerToken, setMyPlayerToken] = useState<string | null>(null);

  const ticketPollTimerRef = useRef<number | null>(null);
  const onlineSyncTimerRef = useRef<number | null>(null);
  const previousUserIdRef = useRef<string | undefined>(undefined);

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

  function persistWaitingSession(ticketId: string, size: number, targetUserId = userId) {
    if (!targetUserId || targetUserId.trim().length === 0) {
      return;
    }

    onlineSessionStore.save({
      version: ONLINE_SESSION_VERSION,
      kind: 'waiting',
      userId: targetUserId,
      ticketId,
      boardSize: size,
    });
  }

  function persistActiveSession(
    gameId: string,
    playerId: number,
    playerToken: string,
    targetUserId = userId,
  ) {
    if (!targetUserId || targetUserId.trim().length === 0) {
      return;
    }

    onlineSessionStore.save({
      version: ONLINE_SESSION_VERSION,
      kind: 'active',
      userId: targetUserId,
      gameId,
      myPlayerId: playerId,
      playerToken,
    });
  }

  function clearPersistedOnlineSession(targetUserId = userId) {
    if (!targetUserId || targetUserId.trim().length === 0) {
      return;
    }

    onlineSessionStore.clear(targetUserId);
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

  function resetRuntimeState() {
    resetMatchmakingState(true);
    setGame(null);
    setError(null);
    setLoading(false);
  }

  async function loadOnlineGame(
    gameId: string,
    playerId: number,
    playerToken: string,
    announceMatch = false,
    targetUserId = userId,
  ) {
    clearTicketPollingTimer();
    setMatchmakingTicketId(null);
    setMatchmakingPosition(null);
    setMatchmakingStatus(announceMatch ? 'matched' : 'idle');
    persistActiveSession(gameId, playerId, playerToken, targetUserId);

    const nextGame = await getGame(gameId);

    setBoardSize(nextGame.yen.size);
    setMyPlayerId(playerId);
    setMyPlayerToken(playerToken);
    setGame(nextGame);
    setMatchmakingStatus('idle');

    return nextGame;
  }

  async function restorePersistedSession(
    session: PersistedOnlineSession,
    cancelledRef: { cancelled: boolean },
    targetUserId: string,
  ) {
    if (session.kind === 'waiting') {
      setBoardSize(Math.max(1, session.boardSize));

      const ticket = await getMatchmakingTicket(session.ticketId);
      if (cancelledRef.cancelled) {
        return;
      }

      if (ticket.status === 'waiting') {
        setMatchmakingTicketId(ticket.ticket_id);
        setMatchmakingStatus('waiting');
        setMatchmakingPosition(ticket.position);
        scheduleTicketPoll(ticket.ticket_id, ticket.poll_after_ms ?? DEFAULT_POLL_DELAY_MS);
        return;
      }

      if (hasMatchedTicketDetails(ticket)) {
        await loadOnlineGame(
          ticket.game_id,
          ticket.player_id,
          ticket.player_token,
          false,
          targetUserId,
        );
        return;
      }

      clearPersistedOnlineSession(targetUserId);
      return;
    }

    await loadOnlineGame(
      session.gameId,
      session.myPlayerId,
      session.playerToken,
      false,
      targetUserId,
    );
  }

  useEffect(
    () => () => {
      clearTicketPollingTimer();
      clearOnlineSyncTimer();
    },
    [],
  );

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;

    if (previousUserId && previousUserId !== userId) {
      onlineSessionStore.clear(previousUserId);
    }

    resetRuntimeState();

    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
      setRestoringSession(false);
      return;
    }

    const persistedSession = onlineSessionStore.load(normalizedUserId);
    if (!persistedSession) {
      setRestoringSession(false);
      return;
    }

    const cancelledRef = { cancelled: false };
    setRestoringSession(true);

    void restorePersistedSession(persistedSession, cancelledRef, normalizedUserId)
      .catch((restoreError: unknown) => {
        if (cancelledRef.cancelled) {
          return;
        }

        const message = toErrorMessage(restoreError);
        setError(message);
        if (isMissingOnlineSessionError(message)) {
          clearPersistedOnlineSession(normalizedUserId);
        }
      })
      .finally(() => {
        if (!cancelledRef.cancelled) {
          setRestoringSession(false);
        }
      });

    return () => {
      cancelledRef.cancelled = true;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [game, myPlayerId]);

  async function runRequest(request: Promise<GameStateResponse>): Promise<boolean> {
    setLoading(true);
    setError(null);
    try {
      const nextGame = await request;
      setGame(nextGame);
      setBoardSize(nextGame.yen.size);
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
    clearPersistedOnlineSession();
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

      if (hasMatchedTicketDetails(ticket)) {
        await loadOnlineGame(
          ticket.game_id,
          ticket.player_id,
          ticket.player_token,
          true,
        );
        return;
      }

      clearPersistedOnlineSession();
      setMatchmakingTicketId(null);
      setMatchmakingPosition(null);
      setMatchmakingStatus('idle');
    } catch (requestError: unknown) {
      const message = toErrorMessage(requestError);
      setError(message);
      clearTicketPollingTimer();
      setMatchmakingStatus('idle');
      if (isMissingOnlineSessionError(message)) {
        clearPersistedOnlineSession();
      }
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
    setMatchmakingTicketId(null);
    setMatchmakingPosition(null);
    setMatchmakingStatus('idle');
    clearOnlineSyncTimer();
    clearTicketPollingTimer();
    clearPersistedOnlineSession();

    try {
      const ticket = await enqueueMatchmaking(boardSize, userId);
      setMatchmakingTicketId(ticket.ticket_id);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);

      if (ticket.status === 'waiting') {
        persistWaitingSession(ticket.ticket_id, boardSize);
        scheduleTicketPoll(ticket.ticket_id, ticket.poll_after_ms ?? DEFAULT_POLL_DELAY_MS);
        return;
      }

      if (hasMatchedTicketDetails(ticket)) {
        await loadOnlineGame(
          ticket.game_id,
          ticket.player_id,
          ticket.player_token,
          true,
        );
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
      clearPersistedOnlineSession();
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
    restoringSession,
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
