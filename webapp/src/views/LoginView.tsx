import React, { useState } from 'react';
import LoginForm from '../LoginForm';
import RegisterForm from '../RegisterForm';
import { Box, Typography, Paper, Tabs, Tab } from '@mui/material';
import { uiSx } from '../theme';

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
    <Box sx={uiSx.centeredColumn}>
      <Typography variant="h5">Welcome to GameY</Typography>

      <Paper sx={uiSx.panel(520)}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} centered sx={uiSx.authTabs}>
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
