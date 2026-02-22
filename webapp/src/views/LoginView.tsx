import React from 'react';
import RegisterForm from '../RegisterForm';
import { Box, Typography, Paper, Button } from '@mui/material';

type Props = {
  onNext: () => void;
};

const LoginView: React.FC<Props> = ({ onNext }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', width: '100%' }}>
      <Typography variant="h5">Registro / Login</Typography>

      <Paper sx={{ p: 3, width: '100%', maxWidth: 520 }}>
        <RegisterForm />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button variant="outlined" onClick={onNext}>
            Continuar
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginView;
