import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUsername';
const GUEST_USERNAME = 'Usuario anonimo';

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  // On mount, verify the stored token is still valid
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
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

  return {
    isAuthenticated: !!token,
    isGuest,
    hasSession: !!token || isGuest,
    displayName: token ? username : isGuest ? GUEST_USERNAME : null,
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
