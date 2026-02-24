import React from 'react';
import RegisterForm from '../RegisterForm';
import { Box, Typography, Paper, Button } from '@mui/material';
import { uiSx } from '../theme';

type Props = {
  onNext: () => void;
};

const LoginView: React.FC<Props> = ({ onNext }) => {
  return (
    <Box sx={uiSx.centeredColumn}>
      <Typography variant="h5">Registro / Login</Typography>

      <Paper sx={uiSx.panel(520)}>
        <RegisterForm />
        <Box sx={[uiSx.centeredRow, { mt: 2 }]}>
          <Button variant="outlined" onClick={onNext}>
            Continuar
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginView;
