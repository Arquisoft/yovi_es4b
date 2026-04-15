import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelMatchmakingTicket,
  createGame,
  enqueueMatchmaking,
  getBotHint,
  getGame,
  getMatchmakingTicket,
  playMove,
  passTurnGame,
  resignGame,
  type Coordinates,
  type GameMode,
  type GameStateResponse,
  type MatchmakingStatus,
  type MatchmakingTicketResponse,
} from './gameyApi';
import {
  GAME_SESSION_STORE_VERSION,
  gameSessionStore,
  type PersistedGameSession,
} from './gameSessionStore';
import { canHumanPlay, gameStatusText, toBoardCells } from './gameyUi';
import { mapDifficultyToBotId, type BotDifficulty } from './stats/types';

const DEFAULT_MATCHMAKING_POLL_DELAY_MS = 1_000;
const ONLINE_GAME_SYNC_DELAY_MS = 1_200;
type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

type PersistedActiveGameDescriptor =
  | { kind: 'local' }
  | { kind: 'online'; myPlayerId: number; playerToken: string };

type LoadLocalGameOptions = {
  shouldAutomaticallyOpenGame?: boolean;
  targetUserId?: string;
};

type LoadOnlineGameOptions = LoadLocalGameOptions & {
  announceMatchFound?: boolean;
};

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

function isMissingPersistedGameSessionError(message: string): boolean {
  return message.startsWith('Ticket not found:') || message.startsWith('Game not found:');
}

function isPersistedActiveGameSession(
  persistedGameSession: PersistedGameSession | null,
): persistedGameSession is Extract<PersistedGameSession, { kind: 'local_active' | 'online_active' }> {
  return (
    persistedGameSession?.kind === 'local_active' ||
    persistedGameSession?.kind === 'online_active'
  );
}

export function useGamey(userId?: string) {
  const normalizedCurrentUserId = userId?.trim() || undefined;

  const [boardSize, setBoardSize] = useState(7);
  const [mode, setMode] = useState<GameMode>('human_vs_bot');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('easy');
  const [game, setGame] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(() => {
    return Boolean(normalizedCurrentUserId && gameSessionStore.load(normalizedCurrentUserId));
  });
  const [hasPersistedResumableGameSession, setHasPersistedResumableGameSession] = useState(() => {
    if (!normalizedCurrentUserId) {
      return false;
    }

    return isPersistedActiveGameSession(gameSessionStore.load(normalizedCurrentUserId));
  });
  const [gameIdPendingAutomaticOpen, setGameIdPendingAutomaticOpen] = useState<string | null>(null);
  const [matchmakingTicketId, setMatchmakingTicketId] = useState<string | null>(null);
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus | 'idle'>('idle');
  const [matchmakingPosition, setMatchmakingPosition] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [myPlayerToken, setMyPlayerToken] = useState<string | null>(null);
  const [hintCoordinates, setHintCoordinates] = useState<Coordinates | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const matchmakingTicketPollTimerIdRef = useRef<TimeoutHandle | null>(null);
  const onlineGameSynchronizationTimerIdRef = useRef<IntervalHandle | null>(null);
  const pollMatchmakingTicketRef = useRef<((ticketId: string) => Promise<void>) | null>(null);

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
  const hasActiveGameInProgress = Boolean(
    (game && !game.game_over) || hasPersistedResumableGameSession,
  );

  const acknowledgeAutomaticGameOpen = useCallback(() => {
    setGameIdPendingAutomaticOpen(null);
  }, []);

  const clearMatchmakingTicketPollTimer = useCallback(() => {
    if (matchmakingTicketPollTimerIdRef.current !== null) {
      globalThis.clearTimeout(matchmakingTicketPollTimerIdRef.current);
      matchmakingTicketPollTimerIdRef.current = null;
    }
  }, []);

  const clearOnlineGameSynchronizationTimer = useCallback(() => {
    if (onlineGameSynchronizationTimerIdRef.current !== null) {
      globalThis.clearInterval(onlineGameSynchronizationTimerIdRef.current);
      onlineGameSynchronizationTimerIdRef.current = null;
    }
  }, []);

  const persistWaitingOnlineMatchmakingSession = useCallback((
    ticketId: string,
    size: number,
    targetUserId = normalizedCurrentUserId,
  ) => {
    if (!targetUserId) {
      return;
    }

    gameSessionStore.save({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'online_waiting',
      userId: targetUserId,
      ticketId,
      boardSize: size,
    });
    setHasPersistedResumableGameSession(false);
  }, [normalizedCurrentUserId]);

  const persistActiveOnlineGameSession = useCallback((
    gameId: string,
    activePlayerId: number,
    activePlayerToken: string,
    targetUserId = normalizedCurrentUserId,
  ) => {
    if (!targetUserId) {
      return;
    }

    gameSessionStore.save({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'online_active',
      userId: targetUserId,
      gameId,
      myPlayerId: activePlayerId,
      playerToken: activePlayerToken,
    });
    setHasPersistedResumableGameSession(true);
  }, [normalizedCurrentUserId]);

  const persistActiveLocalGameSession = useCallback((
    gameId: string,
    targetUserId = normalizedCurrentUserId,
  ) => {
    if (!targetUserId) {
      return;
    }

    gameSessionStore.save({
      version: GAME_SESSION_STORE_VERSION,
      kind: 'local_active',
      userId: targetUserId,
      gameId,
    });
    setHasPersistedResumableGameSession(true);
  }, [normalizedCurrentUserId]);

  const clearPersistedGameSession = useCallback((targetUserId = normalizedCurrentUserId) => {
    if (!targetUserId) {
      return;
    }

    gameSessionStore.clear(targetUserId);
    setHasPersistedResumableGameSession(false);
  }, [normalizedCurrentUserId]);

  const loadPersistedGameSession = useCallback((targetUserId = normalizedCurrentUserId) => {
    if (!targetUserId) {
      return null;
    }

    return gameSessionStore.load(targetUserId);
  }, [normalizedCurrentUserId]);

  const synchronizePersistedSessionWithCurrentGame = useCallback((
    nextGame: GameStateResponse,
    persistedActiveGameDescriptor: PersistedActiveGameDescriptor,
    targetUserId = normalizedCurrentUserId,
  ) => {
    if (!targetUserId) {
      return;
    }

    if (nextGame.game_over) {
      clearPersistedGameSession(targetUserId);
      return;
    }

    if (persistedActiveGameDescriptor.kind === 'local') {
      persistActiveLocalGameSession(nextGame.game_id, targetUserId);
      return;
    }

    persistActiveOnlineGameSession(
      nextGame.game_id,
      persistedActiveGameDescriptor.myPlayerId,
      persistedActiveGameDescriptor.playerToken,
      targetUserId,
    );
  }, [
    clearPersistedGameSession,
    normalizedCurrentUserId,
    persistActiveLocalGameSession,
    persistActiveOnlineGameSession,
  ]);

  const markGameAsPendingAutomaticOpen = useCallback((
    gameId: string,
    shouldAutomaticallyOpenGame: boolean,
  ) => {
    if (shouldAutomaticallyOpenGame) {
      setGameIdPendingAutomaticOpen(gameId);
    }
  }, []);

  const resolveCurrentPersistedActiveGameDescriptor = useCallback((): PersistedActiveGameDescriptor => {
    if (myPlayerId !== null && myPlayerToken) {
      return {
        kind: 'online',
        myPlayerId,
        playerToken: myPlayerToken,
      };
    }

    return { kind: 'local' };
  }, [myPlayerId, myPlayerToken]);

  const resetMatchmakingState = useCallback((clearOnlineIdentity = true) => {
    clearMatchmakingTicketPollTimer();
    setMatchmakingTicketId(null);
    setMatchmakingStatus('idle');
    setMatchmakingPosition(null);

    if (clearOnlineIdentity) {
      setMyPlayerId(null);
      setMyPlayerToken(null);
      clearOnlineGameSynchronizationTimer();
    }
  }, [clearMatchmakingTicketPollTimer, clearOnlineGameSynchronizationTimer]);

  const resetRuntimeState = useCallback(() => {
    resetMatchmakingState(true);
    setGame(null);
    setError(null);
    setLoading(false);
    setGameIdPendingAutomaticOpen(null);
  }, [resetMatchmakingState]);

  const loadLocalGameFromServer = useCallback(async (
    gameId: string,
    {
      shouldAutomaticallyOpenGame = false,
      targetUserId = normalizedCurrentUserId,
    }: LoadLocalGameOptions = {},
  ) => {
    resetMatchmakingState(true);

    const nextGame = await getGame(gameId, targetUserId);
    setBoardSize(nextGame.yen.size);
    setGame(nextGame);
    synchronizePersistedSessionWithCurrentGame(nextGame, { kind: 'local' }, targetUserId);
    markGameAsPendingAutomaticOpen(nextGame.game_id, shouldAutomaticallyOpenGame);

    return nextGame;
  }, [
    markGameAsPendingAutomaticOpen,
    normalizedCurrentUserId,
    resetMatchmakingState,
    synchronizePersistedSessionWithCurrentGame,
  ]);

  const loadOnlineGameFromServer = useCallback(async (
    gameId: string,
    activePlayerId: number,
    activePlayerToken: string,
    {
      announceMatchFound = false,
      shouldAutomaticallyOpenGame = false,
      targetUserId = normalizedCurrentUserId,
    }: LoadOnlineGameOptions = {},
  ) => {
    clearMatchmakingTicketPollTimer();
    setMatchmakingTicketId(null);
    setMatchmakingPosition(null);
    setMatchmakingStatus(announceMatchFound ? 'matched' : 'idle');

    const nextGame = await getGame(gameId, targetUserId, activePlayerToken);
    setBoardSize(nextGame.yen.size);
    setMyPlayerId(activePlayerId);
    setMyPlayerToken(activePlayerToken);
    setGame(nextGame);
    setMatchmakingStatus('idle');
    synchronizePersistedSessionWithCurrentGame(
      nextGame,
      {
        kind: 'online',
        myPlayerId: activePlayerId,
        playerToken: activePlayerToken,
      },
      targetUserId,
    );
    markGameAsPendingAutomaticOpen(nextGame.game_id, shouldAutomaticallyOpenGame);

    return nextGame;
  }, [
    clearMatchmakingTicketPollTimer,
    markGameAsPendingAutomaticOpen,
    normalizedCurrentUserId,
    synchronizePersistedSessionWithCurrentGame,
  ]);

  const scheduleMatchmakingTicketPoll = useCallback((ticketId: string, delayMs: number) => {
    clearMatchmakingTicketPollTimer();
    matchmakingTicketPollTimerIdRef.current = globalThis.setTimeout(() => {
      void pollMatchmakingTicketRef.current?.(ticketId);
    }, delayMs);
  }, [clearMatchmakingTicketPollTimer]);

  const restorePersistedGameSession = useCallback(async (
    persistedGameSession: PersistedGameSession,
    cancelledRef: { cancelled: boolean },
    targetUserId: string,
  ) => {
    if (persistedGameSession.kind === 'online_waiting') {
      setBoardSize(Math.max(1, persistedGameSession.boardSize));

      const ticket = await getMatchmakingTicket(persistedGameSession.ticketId);
      if (cancelledRef.cancelled) {
        return;
      }

      if (ticket.status === 'waiting') {
        setMatchmakingTicketId(ticket.ticket_id);
        setMatchmakingStatus('waiting');
        setMatchmakingPosition(ticket.position);
        scheduleMatchmakingTicketPoll(
          ticket.ticket_id,
          ticket.poll_after_ms ?? DEFAULT_MATCHMAKING_POLL_DELAY_MS,
        );
        return;
      }

      if (hasMatchedTicketDetails(ticket)) {
        await loadOnlineGameFromServer(
          ticket.game_id,
          ticket.player_id,
          ticket.player_token,
          {
            shouldAutomaticallyOpenGame: true,
            targetUserId,
          },
        );
        return;
      }

      clearPersistedGameSession(targetUserId);
      return;
    }

    if (persistedGameSession.kind === 'online_active') {
      await loadOnlineGameFromServer(
        persistedGameSession.gameId,
        persistedGameSession.myPlayerId,
        persistedGameSession.playerToken,
        {
          shouldAutomaticallyOpenGame: true,
          targetUserId,
        },
      );
      return;
    }

    await loadLocalGameFromServer(persistedGameSession.gameId, {
      shouldAutomaticallyOpenGame: true,
      targetUserId,
    });
  }, [
    clearPersistedGameSession,
    loadLocalGameFromServer,
    loadOnlineGameFromServer,
    scheduleMatchmakingTicketPoll,
  ]);

  async function runGameRequest(
    request: Promise<GameStateResponse>,
    persistedActiveGameDescriptor = resolveCurrentPersistedActiveGameDescriptor(),
  ): Promise<boolean> {
    setLoading(true);
    setError(null);

    try {
      const nextGame = await request;
      setGame(nextGame);
      setBoardSize(nextGame.yen.size);
      synchronizePersistedSessionWithCurrentGame(nextGame, persistedActiveGameDescriptor);
      return true;
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      clearMatchmakingTicketPollTimer();
      clearOnlineGameSynchronizationTimer();
    };
  }, [clearMatchmakingTicketPollTimer, clearOnlineGameSynchronizationTimer]);

  useEffect(() => {
    resetRuntimeState();

    if (!normalizedCurrentUserId) {
      setRestoringSession(false);
      return;
    }

    const persistedGameSession = loadPersistedGameSession(normalizedCurrentUserId);
    setHasPersistedResumableGameSession(isPersistedActiveGameSession(persistedGameSession));
    if (!persistedGameSession) {
      setRestoringSession(false);
      return;
    }

    const cancelledRef = { cancelled: false };
    setRestoringSession(true);

    void restorePersistedGameSession(
      persistedGameSession,
      cancelledRef,
      normalizedCurrentUserId,
    )
      .catch((restoreError: unknown) => {
        if (cancelledRef.cancelled) {
          return;
        }

        const message = toErrorMessage(restoreError);
        setError(message);
        if (isMissingPersistedGameSessionError(message)) {
          clearPersistedGameSession(normalizedCurrentUserId);
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
  }, [
    clearPersistedGameSession,
    loadPersistedGameSession,
    normalizedCurrentUserId,
    resetRuntimeState,
    restorePersistedGameSession,
  ]);

  useEffect(() => {
    clearOnlineGameSynchronizationTimer();

    if (!game || game.game_over || myPlayerId === null || !myPlayerToken) {
      return;
    }

    onlineGameSynchronizationTimerIdRef.current = globalThis.setInterval(() => {
      void getGame(game.game_id, normalizedCurrentUserId, myPlayerToken)
        .then((nextGame) => {
          setGame(nextGame);
          synchronizePersistedSessionWithCurrentGame(
            nextGame,
            {
              kind: 'online',
              myPlayerId,
              playerToken: myPlayerToken,
            },
            normalizedCurrentUserId,
          );
        })
        .catch((syncError: unknown) => {
          setError(toErrorMessage(syncError));
        });
    }, ONLINE_GAME_SYNC_DELAY_MS);

    return () => {
      clearOnlineGameSynchronizationTimer();
    };
  }, [
    clearOnlineGameSynchronizationTimer,
    game,
    myPlayerId,
    myPlayerToken,
    normalizedCurrentUserId,
    synchronizePersistedSessionWithCurrentGame,
  ]);

  function updateBoardSize(value: number) {
    setBoardSize(Math.max(1, value));
  }

  async function createNewGame(
    next?: { mode?: GameMode; size?: number; botId?: string },
  ) {
    if (hasActiveGameInProgress) {
      setError('Ya tienes una partida activa. Retomala o terminala antes de crear otra.');
      return false;
    }

    if (matchmakingStatus === 'waiting') {
      setError('No puedes crear una partida mientras estas buscando rival.');
      return false;
    }

    clearPersistedGameSession();
    resetMatchmakingState(true);
    setGameIdPendingAutomaticOpen(null);

    const nextMode = next?.mode ?? mode;
    const nextSize = next?.size ?? boardSize;
    const nextBotId =
      nextMode === 'human_vs_bot'
        ? (next?.botId ?? mapDifficultyToBotId(botDifficulty))
        : undefined;

    return runGameRequest(
      createGame(
        {
          size: nextSize,
          mode: nextMode,
          ...(nextBotId ? { bot_id: nextBotId } : {}),
        },
        normalizedCurrentUserId,
      ),
      { kind: 'local' },
    );
  }

  async function refreshCurrentGame() {
    if (!game) {
      return;
    }

    await runGameRequest(
      getGame(game.game_id, normalizedCurrentUserId, myPlayerToken ?? undefined),
    );
  }

  async function resignCurrentGame() {
    if (!game) {
      return;
    }

    await runGameRequest(
      resignGame(game.game_id, normalizedCurrentUserId, myPlayerToken ?? undefined),
    );
  }

  async function passCurrentTurn() {
    if (!game || !canPlayCell || loading) {
      return;
    }

    await runGameRequest(
      passTurnGame(game.game_id, normalizedCurrentUserId, myPlayerToken ?? undefined),
    );
  }

  async function playCell(coords: Coordinates) {
    if (!game || !canPlayCell || loading) {
      return;
    }

    await runGameRequest(
      playMove(
        game.game_id,
        {
          coords,
          ...(myPlayerToken ? { player_token: myPlayerToken } : {}),
        },
        normalizedCurrentUserId,
      ),
    );
  }

  async function requestHint() {
    if (!game || !canPlayCell || game.game_over || hintLoading) {
      return false;
    }

    setError(null);
    setHintLoading(true);

    try {
      const botMove = await getBotHint(game.yen, 'minimax_bot');
      setHintCoordinates(botMove.coords);
      return true;
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError));
      return false;
    } finally {
      setHintLoading(false);
    }
  }

  useEffect(() => {
    setHintCoordinates(null);
  }, [game?.yen.layout, game?.next_player, game?.game_over]);

  async function pollMatchmakingTicket(ticketId: string) {
    try {
      const ticket = await getMatchmakingTicket(ticketId);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);

      if (ticket.status === 'waiting') {
        scheduleMatchmakingTicketPoll(
          ticketId,
          ticket.poll_after_ms ?? DEFAULT_MATCHMAKING_POLL_DELAY_MS,
        );
        return;
      }

      clearMatchmakingTicketPollTimer();

      if (hasMatchedTicketDetails(ticket)) {
        await loadOnlineGameFromServer(
          ticket.game_id,
          ticket.player_id,
          ticket.player_token,
          {
            announceMatchFound: true,
            shouldAutomaticallyOpenGame: true,
          },
        );
        return;
      }

      clearPersistedGameSession();
      setMatchmakingTicketId(null);
      setMatchmakingPosition(null);
      setMatchmakingStatus('idle');
    } catch (requestError: unknown) {
      const message = toErrorMessage(requestError);
      setError(message);
      clearMatchmakingTicketPollTimer();
      setMatchmakingStatus('idle');

      if (isMissingPersistedGameSessionError(message)) {
        clearPersistedGameSession();
      }
    }
  }

  pollMatchmakingTicketRef.current = pollMatchmakingTicket;

  async function resumeActiveGame() {
    if (game && !game.game_over) {
      setError(null);
      return true;
    }

    const persistedGameSession = loadPersistedGameSession();
    if (!persistedGameSession || !isPersistedActiveGameSession(persistedGameSession)) {
      setError('No hay ninguna partida activa para retomar.');
      setHasPersistedResumableGameSession(false);
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const resumedGame = persistedGameSession.kind === 'online_active'
        ? await loadOnlineGameFromServer(
          persistedGameSession.gameId,
          persistedGameSession.myPlayerId,
          persistedGameSession.playerToken,
        )
        : await loadLocalGameFromServer(persistedGameSession.gameId);

      if (resumedGame.game_over) {
        setError('La partida ya habia terminado.');
        return false;
      }

      return true;
    } catch (resumeError: unknown) {
      const message = toErrorMessage(resumeError);
      setError(message);

      if (isMissingPersistedGameSessionError(message)) {
        clearPersistedGameSession();
      }

      return false;
    } finally {
      setLoading(false);
    }
  }

  async function startMatchmaking() {
    if (loading || matchmakingStatus === 'waiting') {
      return;
    }

    if (hasActiveGameInProgress) {
      setError('Ya tienes una partida activa. Retomala o terminala antes de buscar rival.');
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
    setGameIdPendingAutomaticOpen(null);
    clearOnlineGameSynchronizationTimer();
    clearMatchmakingTicketPollTimer();
    clearPersistedGameSession();

    try {
      const ticket = await enqueueMatchmaking(boardSize, normalizedCurrentUserId);
      setMatchmakingTicketId(ticket.ticket_id);
      setMatchmakingStatus(ticket.status);
      setMatchmakingPosition(ticket.position);

      if (ticket.status === 'waiting') {
        persistWaitingOnlineMatchmakingSession(ticket.ticket_id, boardSize);
        scheduleMatchmakingTicketPoll(
          ticket.ticket_id,
          ticket.poll_after_ms ?? DEFAULT_MATCHMAKING_POLL_DELAY_MS,
        );
        return;
      }

      if (hasMatchedTicketDetails(ticket)) {
        await loadOnlineGameFromServer(
          ticket.game_id,
          ticket.player_id,
          ticket.player_token,
          {
            announceMatchFound: true,
            shouldAutomaticallyOpenGame: true,
          },
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
      clearMatchmakingTicketPollTimer();
      clearPersistedGameSession();
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
    hintCoordinates,
    hintLoading,
    restoringSession,
    hasActiveGameInProgress,
    gameIdPendingAutomaticOpen,
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
    resumeActiveGame,
    startMatchmaking,
    cancelCurrentMatchmaking,
    refreshCurrentGame,
    resignCurrentGame,
    passCurrentTurn,
    playCell,
    requestHint,
    acknowledgeAutomaticGameOpen,
  };
}
