import { createTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

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
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          minWidth: 320,
          minHeight: '100vh',
        },
        '#root': {
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'filled',
        size: 'small',
      },
    },
  },
});

export const uiSx = {
  appRoot: {
    width: '100%',
    maxWidth: 920,
    px: 2,
    py: 4,
  } satisfies SxProps<Theme>,
  appTitle: {
    mb: 2,
    textAlign: 'center',
  } satisfies SxProps<Theme>,
  errorText: {
    mb: 2,
    textAlign: 'center',
  } satisfies SxProps<Theme>,
  centeredColumn: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    alignItems: 'center',
  } satisfies SxProps<Theme>,
  panel: (maxWidth: number): SxProps<Theme> => ({
    p: 3,
    width: '100%',
    maxWidth,
  }),
  centeredRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 1,
  } satisfies SxProps<Theme>,
  formColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: 360,
  } satisfies SxProps<Theme>,
  configRow: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
    flexWrap: 'wrap',
  } satisfies SxProps<Theme>,
  boardContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    mt: 2,
  } satisfies SxProps<Theme>,
  boardRow: (size: number, rowIndex: number): SxProps<Theme> => ({
    display: 'flex',
    justifyContent: 'center',
    mb: '-14px',
    ml: `${size - (rowIndex + 1)}px`,
  }),
  boardHex: (color: string, clickable: boolean): SxProps<Theme> => ({
    width: 48,
    height: 56,
    backgroundColor: color,
    margin: '4px',
    clipPath: `polygon(
      50% 0%,
      100% 25%,
      100% 75%,
      50% 100%,
      0% 75%,
      0% 25%
    )`,
    transition: '0.12s',
    display: 'inline-block',
    '&:hover': clickable ? { filter: 'brightness(0.92)', cursor: 'pointer' } : {},
  }),
};

export default theme;
