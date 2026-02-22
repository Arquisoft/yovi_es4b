import React, { useState } from 'react';
import { Box, TextField, Button, Alert } from '@mui/material';

const RegisterForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [responseMessage, setResponseMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResponseMessage(null);
    setError(null);

    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }

    setLoading(true);
    try {
      const USERS_API_URL = import.meta.env.VITE_USERS_API_URL ?? '/users';
      const res = await fetch(`${USERS_API_URL}/createuser`, {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      if (res.ok) {
        setResponseMessage(data.message);
        setUsername('');
      } else {
        setError(data.error || 'Server error');
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
        id="username"
        label="Whats your name?"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        variant="filled"
        size="small"
      />

      <Button type="submit" variant="contained" color="primary" disabled={loading}>
        {loading ? 'Entering...' : 'Lets go!'}
      </Button>

      {responseMessage && <Alert severity="success">{responseMessage}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
};

export default RegisterForm;
