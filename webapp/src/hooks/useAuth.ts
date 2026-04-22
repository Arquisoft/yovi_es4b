import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUsername';
const GUEST_SESSION_ID_KEY = 'guestSessionId';
const GUEST_USERNAME = 'Usuario anonimo';

function generateSecureRandomHex(byteLength = 16): string {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure crypto API is required to create guest sessions');
  }

  const randomBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(randomBytes);

  return Array.from(randomBytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function generateGuestSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest-${crypto.randomUUID()}`;
  }

  return `guest-${generateSecureRandomHex()}`;
}

function getStoredGuestSessionId(): string | null {
  const guestSessionId = localStorage.getItem(GUEST_SESSION_ID_KEY);
  return guestSessionId?.trim() ? guestSessionId : null;
}

function ensureGuestSessionId(): string {
  const existingGuestSessionId = getStoredGuestSessionId();
  if (existingGuestSessionId) {
    return existingGuestSessionId;
  }

  const nextGuestSessionId = generateGuestSessionId();
  localStorage.setItem(GUEST_SESSION_ID_KEY, nextGuestSessionId);
  return nextGuestSessionId;
}

function getDisplayName(token: string | null, username: string | null, isGuest: boolean): string | null {
  if (token) {
    return username;
  }

  if (isGuest) {
    return GUEST_USERNAME;
  }

  return null;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  // On mount, verify the stored token is still valid
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      return;
    }

    const AUTH_URL = import.meta.env.VITE_AUTH_API_URL ?? '/auth';
    fetch(`${AUTH_URL}/verify`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('invalid');
        return res.json();
      })
      .then((data) => {
        setToken(stored);
        setUsername(data.user?.username ?? localStorage.getItem(USER_KEY));
      })
      .catch(() => {
        // Token expired or invalid – clear session
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((newToken: string, newUsername: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, newUsername);
    setToken(newToken);
    setUsername(newUsername);
    setIsGuest(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
    setIsGuest(false);
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    ensureGuestSessionId();
    setToken(null);
    setUsername(null);
    setIsGuest(true);
  }, []);

  const openLogin = useCallback(() => {
    setIsGuest(false);
  }, []);

  const getAuthHeader = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const guestSessionId = isGuest ? getStoredGuestSessionId() : null;
  const displayName = getDisplayName(token, username, isGuest);

  return {
    isAuthenticated: !!token,
    isGuest,
    hasSession: !!token || isGuest,
    displayName,
    sessionUserId: token ? username : guestSessionId,
    token,
    username,
    loading,
    login,
    logout,
    continueAsGuest,
    openLogin,
    getAuthHeader,
  };
}
