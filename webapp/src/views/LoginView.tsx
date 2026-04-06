import React, { useState } from 'react';
import LoginForm from '../LoginForm';
import RegisterForm from '../RegisterForm';
import { Box, Button, Paper, Tab, Tabs, Typography } from '@mui/material';
import { uiSx } from '../theme';

type Props = {
  onNext: () => void;
  onAuth: (token: string, username: string) => void;
  onContinueAsGuest: () => void;
};

const LoginView: React.FC<Props> = ({ onNext, onAuth, onContinueAsGuest }) => {
  const [tab, setTab] = useState(0);

  const handleAuth = (token: string, username: string) => {
    onAuth(token, username);
    onNext();
  };

  return (
    <Box sx={uiSx.centeredColumn}>
      <Typography variant="h5" sx={uiSx.loginTitle}>
        Welcome to GameY
      </Typography>

      <Paper sx={uiSx.panel(520)}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} centered sx={uiSx.authTabs}>
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>

        {tab === 0 && <LoginForm onSuccess={handleAuth} />}
        {tab === 1 && <RegisterForm onSuccess={handleAuth} />}

        <Box sx={uiSx.loginGuestActions}>
          <Typography sx={uiSx.loginGuestHint}>
            Si prefieres probar primero, puedes entrar sin cuenta y jugar como invitado.
          </Typography>
          <Button variant="text" onClick={onContinueAsGuest}>
            Continuar sin registrarme
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginView;
