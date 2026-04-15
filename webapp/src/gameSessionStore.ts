export const GAME_SESSION_STORE_VERSION = 1;

export interface WaitingOnlineMatchmakingSession {
  version: typeof GAME_SESSION_STORE_VERSION;
  kind: 'online_waiting';
  userId: string;
  ticketId: string;
  boardSize: number;
}

export interface ActiveOnlineGameSession {
  version: typeof GAME_SESSION_STORE_VERSION;
  kind: 'online_active';
  userId: string;
  gameId: string;
  myPlayerId: number;
  playerToken: string;
}

export interface ActiveLocalGameSession {
  version: typeof GAME_SESSION_STORE_VERSION;
  kind: 'local_active';
  userId: string;
  gameId: string;
}

export type PersistedGameSession =
  | WaitingOnlineMatchmakingSession
  | ActiveOnlineGameSession
  | ActiveLocalGameSession;

export interface GameSessionStore {
  load(userId: string): PersistedGameSession | null;
  save(session: PersistedGameSession): void;
  clear(userId: string): void;
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DEFAULT_STORAGE_KEY_PREFIX = 'gamey:game-session';

function buildStorageKey(userId: string, keyPrefix: string): string {
  return `${keyPrefix}:${userId.trim().toLowerCase()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasValidBaseShape(value: unknown): value is {
  version: typeof GAME_SESSION_STORE_VERSION;
  kind: PersistedGameSession['kind'];
  userId: string;
  gameId?: string;
  ticketId?: string;
  boardSize?: number;
  myPlayerId?: number;
  playerToken?: string;
} {
  return (
    isRecord(value) &&
    value.version === GAME_SESSION_STORE_VERSION &&
    typeof value.kind === 'string' &&
    typeof value.userId === 'string'
  );
}

function isWaitingOnlineMatchmakingSession(value: unknown): value is WaitingOnlineMatchmakingSession {
  return (
    hasValidBaseShape(value) &&
    value.kind === 'online_waiting' &&
    typeof value.ticketId === 'string' &&
    typeof value.boardSize === 'number'
  );
}

function isActiveOnlineGameSession(value: unknown): value is ActiveOnlineGameSession {
  return (
    hasValidBaseShape(value) &&
    value.kind === 'online_active' &&
    typeof value.gameId === 'string' &&
    typeof value.myPlayerId === 'number' &&
    typeof value.playerToken === 'string'
  );
}

function isActiveLocalGameSession(value: unknown): value is ActiveLocalGameSession {
  return (
    hasValidBaseShape(value) &&
    value.kind === 'local_active' &&
    typeof value.gameId === 'string'
  );
}

function isPersistedGameSession(value: unknown): value is PersistedGameSession {
  return (
    isWaitingOnlineMatchmakingSession(value) ||
    isActiveOnlineGameSession(value) ||
    isActiveLocalGameSession(value)
  );
}

function createNoopGameSessionStore(): GameSessionStore {
  return {
    load: () => null,
    save: () => {},
    clear: () => {},
  };
}

export function createGameSessionStore(
  storage?: BrowserStorage,
  keyPrefix = DEFAULT_STORAGE_KEY_PREFIX,
): GameSessionStore {
  if (!storage) {
    return createNoopGameSessionStore();
  }

  return {
    load(userId: string) {
      const normalizedUserId = userId.trim();
      if (normalizedUserId.length === 0) {
        return null;
      }

      const storageKey = buildStorageKey(normalizedUserId, keyPrefix);

      try {
        const raw = storage.getItem(storageKey);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!isPersistedGameSession(parsed)) {
          storage.removeItem(storageKey);
          return null;
        }

        if (parsed.userId.trim().toLowerCase() !== normalizedUserId.toLowerCase()) {
          storage.removeItem(storageKey);
          return null;
        }

        return parsed;
      } catch {
        storage.removeItem(storageKey);
        return null;
      }
    },
    save(session: PersistedGameSession) {
      const normalizedUserId = session.userId.trim();
      if (normalizedUserId.length === 0) {
        return;
      }

      try {
        storage.setItem(
          buildStorageKey(normalizedUserId, keyPrefix),
          JSON.stringify({
            ...session,
            userId: normalizedUserId,
          }),
        );
      } catch {
        // Ignore browser storage quota and availability errors.
      }
    },
    clear(userId: string) {
      const normalizedUserId = userId.trim();
      if (normalizedUserId.length === 0) {
        return;
      }

      try {
        storage.removeItem(buildStorageKey(normalizedUserId, keyPrefix));
      } catch {
        // Ignore browser storage quota and availability errors.
      }
    },
  };
}

const browserLocalStorage =
  typeof globalThis.window === 'undefined' ? undefined : globalThis.window.localStorage;

export const gameSessionStore = createGameSessionStore(browserLocalStorage);
