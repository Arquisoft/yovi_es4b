import React, { useState } from 'react';
import { Box, TextField, Button, Alert } from '@mui/material';
import { uiSx } from './theme';

interface RegisterFormProps {
  onSuccess: (token: string, username: string) => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResponseMessage(null);
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter a username and password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const AUTH_URL = import.meta.env.VITE_AUTH_API_URL ?? '/auth';
      const res = await fetch(`${AUTH_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : {};
      if (res.ok) {
        setResponseMessage(data.message);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        onSuccess(data.token, data.username);
      } else {
        setError(data.message || `Server error (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={uiSx.formColumn}>
      <TextField
        id="register-username"
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <TextField
        id="register-password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <TextField
        id="register-confirm-password"
        label="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <Button type="submit" color="primary" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </Button>

      {responseMessage && <Alert severity="success">{responseMessage}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
};

export default RegisterForm;
