import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0b3d91',
      light: '#3b82f6',
    },
    error: {
      main: '#dc2626',
    },
    background: {
      default: '#071024',
      paper: '#071a2a',
    },
    text: {
      primary: '#e6eef8',
      secondary: '#cfe6ff',
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
  },
});

export default theme;
