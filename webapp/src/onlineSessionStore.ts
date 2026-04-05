export const ONLINE_SESSION_VERSION = 1;

export interface WaitingOnlineSession {
  version: typeof ONLINE_SESSION_VERSION;
  kind: 'waiting';
  userId: string;
  ticketId: string;
  boardSize: number;
}

export interface ActiveOnlineSession {
  version: typeof ONLINE_SESSION_VERSION;
  kind: 'active';
  userId: string;
  gameId: string;
  myPlayerId: number;
  playerToken: string;
}

export type PersistedOnlineSession = WaitingOnlineSession | ActiveOnlineSession;

export interface OnlineSessionStore {
  load(userId: string): PersistedOnlineSession | null;
  save(session: PersistedOnlineSession): void;
  clear(userId: string): void;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DEFAULT_KEY_PREFIX = 'gamey:online-session';

function buildStorageKey(userId: string, keyPrefix: string): string {
  return `${keyPrefix}:${userId.trim().toLowerCase()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWaitingSession(value: unknown): value is WaitingOnlineSession {
  return (
    isRecord(value) &&
    value.version === ONLINE_SESSION_VERSION &&
    value.kind === 'waiting' &&
    typeof value.userId === 'string' &&
    typeof value.ticketId === 'string' &&
    typeof value.boardSize === 'number'
  );
}

function isActiveSession(value: unknown): value is ActiveOnlineSession {
  return (
    isRecord(value) &&
    value.version === ONLINE_SESSION_VERSION &&
    value.kind === 'active' &&
    typeof value.userId === 'string' &&
    typeof value.gameId === 'string' &&
    typeof value.myPlayerId === 'number' &&
    typeof value.playerToken === 'string'
  );
}

function isPersistedOnlineSession(value: unknown): value is PersistedOnlineSession {
  return isWaitingSession(value) || isActiveSession(value);
}

function createNoopStore(): OnlineSessionStore {
  return {
    load: () => null,
    save: () => {},
    clear: () => {},
  };
}

export function createOnlineSessionStore(
  storage?: StorageLike,
  keyPrefix = DEFAULT_KEY_PREFIX,
): OnlineSessionStore {
  if (!storage) {
    return createNoopStore();
  }

  return {
    load(userId: string) {
      const normalizedUserId = userId.trim();
      if (normalizedUserId.length === 0) {
        return null;
      }

      try {
        const raw = storage.getItem(buildStorageKey(normalizedUserId, keyPrefix));
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!isPersistedOnlineSession(parsed)) {
          storage.removeItem(buildStorageKey(normalizedUserId, keyPrefix));
          return null;
        }

        if (parsed.userId.trim().toLowerCase() !== normalizedUserId.toLowerCase()) {
          storage.removeItem(buildStorageKey(normalizedUserId, keyPrefix));
          return null;
        }

        return parsed;
      } catch {
        storage.removeItem(buildStorageKey(normalizedUserId, keyPrefix));
        return null;
      }
    },
    save(session: PersistedOnlineSession) {
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
        // Ignore storage quota and browser access errors.
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
        // Ignore browser storage access errors.
      }
    },
  };
}

const browserSessionStorage =
  typeof window === 'undefined' ? undefined : window.sessionStorage;

export const onlineSessionStore = createOnlineSessionStore(browserSessionStorage);
