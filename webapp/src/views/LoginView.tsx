import React, { useState } from 'react';
import LoginForm from '../LoginForm';
import RegisterForm from '../RegisterForm';
import { Box, Typography, Paper, Tabs, Tab } from '@mui/material';

type Props = {
  onNext: () => void;
  onAuth: (token: string, username: string) => void;
};

const LoginView: React.FC<Props> = ({ onNext, onAuth }) => {
  const [tab, setTab] = useState(0);

  const handleAuth = (token: string, username: string) => {
    onAuth(token, username);
    onNext();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', width: '100%' }}>
      <Typography variant="h5">Welcome to GameY</Typography>

      <Paper sx={{ p: 3, width: '100%', maxWidth: 520 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mb: 2 }}>
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>

        {tab === 0 && <LoginForm onSuccess={handleAuth} />}
        {tab === 1 && <RegisterForm onSuccess={handleAuth} />}
      </Paper>
    </Box>
  );
};

export default LoginView;
