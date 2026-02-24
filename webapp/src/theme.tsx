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
        variant: 'contained',
        size: 'medium',
      },
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: 'none',
          minWidth: 148,
          height: 40,
          borderRadius: 10,
          whiteSpace: 'nowrap',
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
  appShell: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  } satisfies SxProps<Theme>,
  appHeader: {
    width: '100%',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    py: 2,
    px: 2,
  } satisfies SxProps<Theme>,
  appHeaderTitle: {
    textAlign: 'center',
    fontWeight: 800,
    letterSpacing: 1,
    fontSize: { xs: '1.9rem', sm: '2.3rem' },
  } satisfies SxProps<Theme>,
  appRoot: {
    width: '100%',
    maxWidth: 920,
    px: 2,
    py: 4,
    mx: 'auto',
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
  gameBoardStage: {
    position: 'relative',
    width: 'fit-content',
    mx: 'auto',
    mt: 1,
    mb: 3,
    px: 5.8,
    pt: 4.4,
    pb: 3.4,
    transform: 'translateX(6px)',
    isolation: 'isolate',
  } satisfies SxProps<Theme>,
  gameBoardBase: {
    position: 'absolute',
    zIndex: -1,
    inset: '-4px -8px -1px -7px',
    clipPath: 'polygon(46% 7%, 54% 7%, 96% 92%, 92% 100%, 7% 100%, 4% 92%)',
    backgroundColor: 'rgba(7, 26, 42, 0.8)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.25)',
  } satisfies SxProps<Theme>,
  gameActionsBox: {
    width: 'fit-content',
    mx: 'auto',
    p: 1.5,
    borderRadius: 2,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(7, 26, 42, 0.8)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.25)',
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
