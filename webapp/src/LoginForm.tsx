import React, { useState } from 'react';
import { Box, TextField, Button, Alert } from '@mui/material';

interface LoginFormProps {
  onSuccess: (token: string, username: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.');
      return;
    }

    setLoading(true);
    try {
      const AUTH_URL = import.meta.env.VITE_AUTH_API_URL ?? '/auth';
      const res = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : {};
      if (res.ok) {
        onSuccess(data.token, data.username);
      } else {
        setError(data.message || `Login failed (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: 360 }}>
      <TextField
        id="login-username"
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        variant="filled"
        size="small"
      />

      <TextField
        id="login-password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        variant="filled"
        size="small"
      />

      <Button className="login-button" type="submit" variant="contained" color="primary" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </Button>

      {error && <Alert className="error-message" severity="error">{error}</Alert>}
    </Box>
  );
};

export default LoginForm;
