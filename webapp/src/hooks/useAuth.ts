import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUsername';

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));
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
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  const getAuthHeader = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  return {
    isAuthenticated: !!token,
    token,
    username,
    loading,
    login,
    logout,
    getAuthHeader,
  };
}
