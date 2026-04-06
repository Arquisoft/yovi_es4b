import { createTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

export const uiColors = {
  bg: {
    base: '#2b2a28',
    surface: '#312e2b',
    sidebar: 'rgba(38, 37, 34, 0.92)',
    overlay: 'rgba(42, 40, 37, 0.96)',
    boardPanel: 'rgba(41, 39, 36, 0.94)',
  },
  text: {
    primary: '#f0efea',
    secondary: '#c2c1bc',
    muted: '#9d9b95',
  },
  accent: {
    main: '#81b64c',
    light: '#9dce67',
    dark: '#5f8f33',
    hoverBg: 'rgba(129, 182, 76, 0.18)',
  },
  border: {
    strong: 'rgba(164, 164, 158, 0.42)',
    soft: 'rgba(164, 164, 158, 0.28)',
    faint: 'rgba(164, 164, 158, 0.16)',
  },
  feedback: {
    error: '#d65a5a',
  },
  board: {
    empty: '#d8d2c0',
    human: '#7fa650',
    opponent: '#d06b6b',
  },
} as const;

type HistoryStatTone = 'neutral' | 'win' | 'loss' | 'info';
type GameOutcomeTone = 'success' | 'danger' | 'accent';
type BoardOwner = 'human' | 'opponent' | 'empty';

function getHistoryStatBorderColor(tone: HistoryStatTone): string {
  switch (tone) {
    case 'win':
      return 'rgba(127, 166, 80, 0.58)';
    case 'loss':
      return 'rgba(208, 107, 107, 0.58)';
    case 'info':
      return 'rgba(164, 164, 158, 0.52)';
    default:
      return uiColors.border.faint;
  }
}

function getHistoryStatAccentColor(tone: HistoryStatTone): string {
  switch (tone) {
    case 'win':
      return '#7fa650';
    case 'loss':
      return '#d06b6b';
    case 'info':
      return 'rgba(172, 170, 162, 0.85)';
    default:
      return 'rgba(172, 170, 162, 0.7)';
  }
}

function getGameOutcomeBorderColor(tone: GameOutcomeTone): string {
  switch (tone) {
    case 'success':
    case 'accent':
      return 'rgba(146, 195, 92, 0.66)';
    default:
      return 'rgba(212, 104, 104, 0.62)';
  }
}

function getGameOutcomeBackgroundColor(tone: GameOutcomeTone): string {
  switch (tone) {
    case 'success':
    case 'accent':
      return 'rgba(129, 182, 76, 0.12)';
    default:
      return 'rgba(189, 84, 84, 0.12)';
  }
}

function getGameOutcomeShadowColor(tone: GameOutcomeTone): string {
  switch (tone) {
    case 'success':
    case 'accent':
      return '0 8px 16px rgba(47, 64, 31, 0.12)';
    default:
      return '0 8px 16px rgba(78, 34, 34, 0.12)';
  }
}

function getBoardOwnerMutedFilter(owner: BoardOwner): string {
  switch (owner) {
    case 'human':
      return 'saturate(0.56) brightness(0.82) contrast(0.96)';
    case 'opponent':
      return 'saturate(0.5) brightness(0.8) contrast(0.95)';
    default:
      return 'none';
  }
}

function getBoardOwnerBorderColor(owner: BoardOwner): string {
  switch (owner) {
    case 'human':
      return 'rgba(158, 235, 185, 0.84)';
    case 'opponent':
      return 'rgba(255, 186, 186, 0.9)';
    default:
      return 'rgba(255, 255, 255, 0.72)';
  }
}

function getBoardOwnerMutedPattern(owner: BoardOwner): string {
  switch (owner) {
    case 'human':
      return 'repeating-linear-gradient(135deg, rgba(255,255,255,0.28) 0 2px, rgba(255,255,255,0) 2px 6px)';
    case 'opponent':
      return 'repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 2px, rgba(255,255,255,0) 2px 6px)';
    default:
      return 'none';
  }
}

function getBoardHexFilter(highlighted: boolean, muted: boolean, mutedFilter: string): string {
  if (highlighted) {
    return 'saturate(1.12) brightness(1.02)';
  }

  if (muted) {
    return mutedFilter;
  }

  return 'none';
}

function getBoardHexBorderStyle(
  highlighted: boolean,
  owner: BoardOwner,
  ownerBorderColor: string,
): string {
  if (highlighted) {
    return '2px solid rgba(255,255,255,0.98)';
  }

  if (owner === 'human') {
    return `2px dashed ${ownerBorderColor}`;
  }

  return `2px dotted ${ownerBorderColor}`;
}

function getBoardHexHoverFilter(highlighted: boolean, muted: boolean, mutedFilter: string): string {
  if (highlighted) {
    return 'saturate(1.12) brightness(1.02)';
  }

  if (muted) {
    return mutedFilter;
  }

  return 'brightness(0.92)';
}

const theme = createTheme({
  typography: {
    fontFamily: "'Segoe UI Variable', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  palette: {
    mode: 'dark',
    primary: {
      main: uiColors.accent.main,
      light: uiColors.accent.light,
      dark: uiColors.accent.dark,
      contrastText: '#1f211c',
    },
    error: {
      main: uiColors.feedback.error,
    },
    background: {
      default: uiColors.bg.base,
      paper: uiColors.bg.surface,
    },
    text: {
      primary: uiColors.text.primary,
      secondary: uiColors.text.secondary,
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
          fontFamily: "'Segoe UI Variable', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          background: uiColors.bg.base,
        },
        '#root': {
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
          fontWeight: 700,
          textTransform: 'none',
          minWidth: 148,
          height: 40,
          borderRadius: 10,
          whiteSpace: 'nowrap',
        },
        containedPrimary: {
          color: '#042033',
          '&:hover': {
            backgroundColor: uiColors.accent.light,
          },
        },
        outlined: {
          borderColor: uiColors.border.strong,
          color: uiColors.text.primary,
          '&:hover': {
            borderColor: uiColors.accent.light,
            backgroundColor: uiColors.accent.hoverBg,
          },
        },
        text: {
          color: uiColors.accent.light,
          '&:hover': {
            color: uiColors.text.primary,
            backgroundColor: uiColors.accent.hoverBg,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${uiColors.border.soft}`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: uiColors.accent.light,
          height: 3,
          borderRadius: 3,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: uiColors.text.secondary,
          fontWeight: 700,
          '&.Mui-selected': {
            color: uiColors.accent.light,
          },
          '&:hover': {
            color: uiColors.text.primary,
            backgroundColor: uiColors.accent.hoverBg,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
          },
          '&.Mui-focused': {
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            boxShadow: `0 0 0 1px ${uiColors.accent.light}`,
          },
          '&:before, &:after': {
            display: 'none',
          },
        },
        input: {
          color: uiColors.text.primary,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: uiColors.text.secondary,
          '&.Mui-focused': {
            color: uiColors.accent.light,
          },
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
    px: { xs: 1.2, md: 1.8 },
    py: { xs: 1, md: 1.3 },
    gap: 1.5,
  } satisfies SxProps<Theme>,
  appHeader: {
    width: '100%',
    borderBottom: `1px solid ${uiColors.border.soft}`,
    border: `1px solid ${uiColors.border.faint}`,
    borderRadius: 2.2,
    backgroundColor: '#312e2b',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.18)',
    py: 1.9,
    px: 2.2,
  } satisfies SxProps<Theme>,
  appHeaderTitle: {
    textAlign: 'center',
    fontWeight: 800,
    letterSpacing: 1,
    fontSize: { xs: '1.9rem', sm: '2.3rem' },
  } satisfies SxProps<Theme>,
  appHeaderUserRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 2,
    flexWrap: 'wrap',
  } satisfies SxProps<Theme>,
  appHeaderTitleSecondary: {
    textAlign: 'left',
    fontWeight: 800,
    letterSpacing: 1,
    fontSize: { xs: '1.6rem', sm: '2rem' },
    lineHeight: 1.2,
  } satisfies SxProps<Theme>,
  appHeaderTitleLink: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    padding: 0,
    margin: 0,
    textAlign: 'left',
    fontWeight: 800,
    letterSpacing: 1,
    fontSize: { xs: '1.6rem', sm: '2rem' },
    lineHeight: 1.2,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies SxProps<Theme>,
  appHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    ml: 'auto',
  } satisfies SxProps<Theme>,
  appHeaderUserBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.7,
    px: 1.1,
    py: 0.45,
    borderRadius: 1.2,
    border: `1px solid ${uiColors.border.soft}`,
    backgroundColor: 'rgba(129, 182, 76, 0.09)',
  } satisfies SxProps<Theme>,
  appHeaderUserText: {
    fontSize: '0.92rem',
    letterSpacing: 0.2,
    color: 'text.secondary',
    lineHeight: 1.2,
  } satisfies SxProps<Theme>,
  appHeaderUserName: {
    fontWeight: 800,
    color: 'text.primary',
    letterSpacing: 0.25,
  } satisfies SxProps<Theme>,
  appRoot: {
    width: '100%',
    maxWidth: 920,
    px: 2,
    py: 4,
    mx: 'auto',
  } satisfies SxProps<Theme>,
  appBody: {
    display: 'flex',
    alignItems: 'stretch',
    width: '100%',
    flex: 1,
    minHeight: 0,
    flexDirection: { xs: 'column', md: 'row' },
    gap: 2,
    pb: 0.6,
  } satisfies SxProps<Theme>,
  appMain: {
    flex: 1,
    width: '100%',
    px: { xs: 2.1, md: 3.4 },
    py: { xs: 2.2, md: 2.8 },
    minWidth: 0,
    maxWidth: 'none',
  } satisfies SxProps<Theme>,
  sidebar: {
    width: { xs: '100%', md: 206 },
    flexShrink: 0,
    px: 2,
    py: 2.5,
    borderRight: { xs: 'none', md: `1px solid ${uiColors.border.faint}` },
    borderBottom: { xs: `1px solid ${uiColors.border.faint}`, md: 'none' },
    backgroundColor: uiColors.bg.sidebar,
    borderRadius: 1.8,
    boxShadow: '0 10px 22px rgba(0, 0, 0, 0.28)',
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    position: 'relative',
    overflow: 'visible',
  } satisfies SxProps<Theme>,
  sidebarItem: (active: boolean): SxProps<Theme> => ({
    border: 'none',
    background: 'transparent',
    color: active ? uiColors.accent.light : 'inherit',
    textAlign: 'left',
    padding: '9px 12px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: '0.98rem',
    width: '100%',
    minWidth: '100%',
    height: 'auto',
    cursor: 'pointer',
    display: 'block',
    transition: 'background-color 0.18s ease, color 0.18s ease',
    '&:hover': {
      color: uiColors.accent.light,
      backgroundColor: uiColors.accent.hoverBg,
    },
  }),
  sidebarItemContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
  } satisfies SxProps<Theme>,
  sidebarItemIcon: {
    width: 20,
    height: 20,
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
  } satisfies SxProps<Theme>,
  sidebarSessionIcon: {
    width: 24,
    height: 24,
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
  } satisfies SxProps<Theme>,
  sidebarBottom: {
    mt: 'auto',
    pt: 1.5,
  } satisfies SxProps<Theme>,
  dashboardShell: {
    width: '100%',
    maxWidth: 1160,
    mx: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2.4,
  } satisfies SxProps<Theme>,
  dashboardTopRow: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
    gap: 2.3,
    alignItems: 'stretch',
  } satisfies SxProps<Theme>,
  dashboardCard: {
    p: 2.4,
    borderRadius: 2,
    backgroundColor: 'rgba(49, 46, 43, 0.9)',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 1.25,
    minHeight: 252,
    height: '100%',
  } satisfies SxProps<Theme>,
  activeGameCard: {
    p: 2.4,
    borderRadius: 2,
    backgroundColor: 'rgba(129, 182, 76, 0.1)',
    border: '1px solid rgba(146, 195, 92, 0.4)',
    boxShadow: '0 12px 24px rgba(62, 84, 39, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    gap: 1.25,
  } satisfies SxProps<Theme>,
  dashboardCardTitle: {
    position: 'relative',
    display: 'inline-flex',
    width: 'fit-content',
    alignItems: 'center',
    gap: 0.7,
    pr: 0.8,
    pb: 0.85,
    fontWeight: 800,
    letterSpacing: 0.35,
    '&::before': {
      content: '""',
      width: 7,
      height: 7,
      borderRadius: '50%',
      backgroundColor: uiColors.accent.light,
      opacity: 0.95,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 2,
      borderRadius: 2,
      backgroundColor: uiColors.accent.light,
      opacity: 0.72,
    },
  } satisfies SxProps<Theme>,
  dashboardCardHint: {
    color: 'text.secondary',
    fontSize: '0.9rem',
  } satisfies SxProps<Theme>,
  dashboardInlineHint: {
    mt: 1.1,
    color: 'text.secondary',
    fontSize: '0.82rem',
    letterSpacing: 0.15,
  } satisfies SxProps<Theme>,
  configSectionTitle: {
    fontSize: '0.76rem',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'text.muted',
    fontWeight: 700,
  } satisfies SxProps<Theme>,
  configToggleButton: (active: boolean): SxProps<Theme> => ({
    minWidth: { xs: '100%', sm: 108 },
    height: 34,
    px: 1.4,
    borderRadius: 1.4,
    fontSize: '0.88rem',
    fontWeight: 700,
    color: active ? 'text.primary' : 'text.secondary',
    backgroundColor: active ? 'rgba(129, 182, 76, 0.18)' : 'rgba(255, 255, 255, 0.04)',
    borderColor: active ? 'primary.light' : 'divider',
    '&:hover': {
      backgroundColor: active ? 'rgba(129, 182, 76, 0.24)' : 'rgba(255, 255, 255, 0.08)',
      borderColor: active ? 'primary.light' : 'primary.main',
    },
  }),
  configGrid: {
    mt: 0.9,
    display: 'grid',
    gap: 1.35,
  } satisfies SxProps<Theme>,
  configRow: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '112px 1fr' },
    gap: 1.1,
    alignItems: 'center',
  } satisfies SxProps<Theme>,
  configRowStart: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '112px 1fr' },
    gap: 1.1,
    alignItems: 'start',
  } satisfies SxProps<Theme>,
  configRowDivider: {
    borderTop: '1px solid',
    borderColor: 'divider',
    opacity: 0.45,
    my: 0.4,
  } satisfies SxProps<Theme>,
  configOptionGroup: {
    display: 'flex',
    flexWrap: { xs: 'wrap', sm: 'nowrap' },
    gap: 1,
  } satisfies SxProps<Theme>,
  configSizeInput: {
    width: { xs: '100%', sm: 220 },
  } satisfies SxProps<Theme>,
  configActions: {
    mt: 'auto',
    pt: 0.8,
    display: 'flex',
    justifyContent: 'flex-end',
  } satisfies SxProps<Theme>,
  configCreateButton: {
    minWidth: 160,
    height: 44,
    borderRadius: 1.4,
    fontSize: '0.95rem',
    px: 2.1,
    letterSpacing: 0.2,
  } satisfies SxProps<Theme>,
  activeGameResumeButton: {
    minWidth: 210,
    height: 42,
    borderRadius: 1.4,
    color: '#10210a',
    backgroundColor: 'rgba(157, 206, 103, 0.95)',
    border: '1px solid rgba(179, 224, 131, 0.55)',
    '&:hover': {
      backgroundColor: 'rgba(168, 216, 113, 1)',
    },
  } satisfies SxProps<Theme>,
  dashboardConfigControls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1.5,
    alignItems: 'center',
    mt: 'auto',
  } satisfies SxProps<Theme>,
  onlineActionsRow: {
    mt: 'auto',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    alignItems: 'center',
  } satisfies SxProps<Theme>,
  onlinePrimaryButton: {
    minWidth: 160,
    height: 38,
    borderColor: 'rgba(146, 195, 92, 0.66)',
    color: uiColors.text.primary,
    backgroundColor: 'rgba(129, 182, 76, 0.14)',
    '&:hover': {
      borderColor: uiColors.accent.light,
      backgroundColor: 'rgba(129, 182, 76, 0.22)',
    },
  } satisfies SxProps<Theme>,
  onlineSecondaryButton: {
    minWidth: 160,
    height: 38,
    borderColor: 'rgba(164, 164, 158, 0.45)',
    color: uiColors.text.secondary,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    '&:hover': {
      borderColor: 'rgba(196, 196, 188, 0.72)',
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      color: uiColors.text.primary,
    },
  } satisfies SxProps<Theme>,
  onlineStatusBadge: (waiting: boolean): SxProps<Theme> => ({
    mt: 1.2,
    px: 1.2,
    py: 0.8,
    borderRadius: 1.4,
    border: `1px solid ${
      waiting ? 'rgba(129, 182, 76, 0.45)' : 'rgba(164, 164, 158, 0.4)'
    }`,
    backgroundColor: waiting ? 'rgba(129, 182, 76, 0.1)' : 'rgba(255, 255, 255, 0.05)',
    color: 'text.secondary',
    fontSize: '0.86rem',
    fontWeight: 600,
    letterSpacing: 0.1,
  }),
  statsRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    mt: 0.5,
  } satisfies SxProps<Theme>,
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    px: 1.2,
    py: 0.9,
    borderRadius: 1.4,
    border: `1px solid ${uiColors.border.faint}`,
    backgroundColor: 'rgba(44, 42, 39, 0.78)',
  } satisfies SxProps<Theme>,
  dashboardHistoryCard: {
    p: 2.4,
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.2,
  } satisfies SxProps<Theme>,
  historyFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    pt: 1,
  } satisfies SxProps<Theme>,
  historyFullscreenCard: {
    p: 2.4,
    borderRadius: 2,
    width: '100%',
    minHeight: 520,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.6,
  } satisfies SxProps<Theme>,
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 1.5,
    flexWrap: 'wrap',
  } satisfies SxProps<Theme>,
  historyTableHint: {
    mt: -0.5,
    mb: 0.2,
    color: 'text.secondary',
    fontSize: '0.86rem',
    letterSpacing: 0.12,
  } satisfies SxProps<Theme>,
  historyStatsGrid: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
    gap: 1.2,
    mt: 0.2,
  } satisfies SxProps<Theme>,
  historyStatCard: (tone: HistoryStatTone): SxProps<Theme> => {
    const borderColor = getHistoryStatBorderColor(tone);
    const accentColor = getHistoryStatAccentColor(tone);

    return {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 1.5,
      border: `1px solid ${borderColor}`,
      backgroundColor: 'rgba(44, 42, 39, 0.82)',
      px: 1.3,
      py: 1.1,
      minHeight: 96,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: accentColor,
      },
    };
  },
  historyStatLabel: {
    fontSize: '0.78rem',
    letterSpacing: 0.34,
    textTransform: 'uppercase',
    color: 'text.secondary',
    fontWeight: 700,
  } satisfies SxProps<Theme>,
  historyStatValue: {
    mt: 0.35,
    fontSize: { xs: '1.2rem', md: '1.35rem' },
    fontWeight: 800,
    letterSpacing: 0.2,
    lineHeight: 1.1,
  } satisfies SxProps<Theme>,
  historyStatMeta: {
    mt: 0.45,
    fontSize: '0.78rem',
    color: 'text.secondary',
    opacity: 0.92,
    letterSpacing: 0.12,
  } satisfies SxProps<Theme>,
  historyWinrateTrack: {
    mt: 0.55,
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  } satisfies SxProps<Theme>,
  historyWinrateFill: (percent: number): SxProps<Theme> => ({
    height: '100%',
    width: `${Math.max(0, Math.min(100, percent))}%`,
    borderRadius: 999,
    backgroundColor: uiColors.accent.main,
    transition: 'width 0.2s ease',
  }),
  historyTableContainer: {
    border: `1px solid ${uiColors.border.faint}`,
    borderRadius: 1.6,
    overflow: 'hidden',
    backgroundColor: 'rgba(44, 42, 39, 0.55)',
  } satisfies SxProps<Theme>,
  historyTableHeadCell: {
    backgroundColor: 'rgba(49, 46, 43, 0.96)',
    color: 'text.secondary',
    fontWeight: 700,
    letterSpacing: 0.2,
    fontSize: '0.79rem',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${uiColors.border.soft}`,
    whiteSpace: 'nowrap',
  } satisfies SxProps<Theme>,
  historyRow: (interactive: boolean): SxProps<Theme> => ({
    transition: 'background-color 0.14s ease',
    cursor: interactive ? 'pointer' : 'default',
    '&:nth-of-type(odd)': {
      backgroundColor: 'rgba(255, 255, 255, 0.01)',
    },
    '&:hover': interactive
      ? {
          backgroundColor: 'rgba(129, 182, 76, 0.12)',
        }
      : {},
  }),
  historyGameIdButton: (interactive: boolean): SxProps<Theme> => ({
    minWidth: 0,
    px: 0,
    py: 0,
    fontWeight: 800,
    justifyContent: 'flex-start',
    textAlign: 'left',
    color: interactive ? uiColors.accent.light : 'text.secondary',
    opacity: interactive ? 1 : 0.62,
    '&:hover': interactive
      ? {
          textDecoration: 'underline',
          backgroundColor: 'transparent',
        }
      : {},
  }),
  historyResultBadge: (won: boolean): SxProps<Theme> => ({
    display: 'inline-flex',
    alignItems: 'center',
    px: 1.1,
    py: 0.26,
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: 0.14,
    border: `1px solid ${
      won
        ? 'rgba(115, 229, 154, 0.6)'
        : 'rgba(255, 134, 134, 0.66)'
    }`,
    color: won ? '#c8ffd8' : '#ffd2d2',
    backgroundColor: won ? 'rgba(73, 174, 114, 0.16)' : 'rgba(189, 84, 84, 0.16)',
  }),
  historyModeBadge: (isBot: boolean): SxProps<Theme> => ({
    display: 'inline-flex',
    alignItems: 'center',
    px: 1,
    py: 0.22,
    borderRadius: 999,
    fontSize: '0.76rem',
    fontWeight: 700,
    border: `1px solid ${
      isBot
        ? 'rgba(129, 182, 76, 0.62)'
        : 'rgba(164, 164, 158, 0.52)'
    }`,
    color: isBot ? '#d8efbe' : '#d8d5cc',
    backgroundColor: isBot ? 'rgba(129, 182, 76, 0.14)' : 'rgba(140, 137, 128, 0.14)',
    minWidth: 68,
    justifyContent: 'center',
  }),
  historyMutedTextCell: {
    color: 'text.secondary',
    opacity: 0.9,
  } satisfies SxProps<Theme>,
  historyActionCell: {
    textAlign: 'right',
    whiteSpace: 'nowrap',
  } satisfies SxProps<Theme>,
  historyActionButton: (enabled: boolean): SxProps<Theme> => ({
    minWidth: 112,
    height: 32,
    borderRadius: 1.3,
    fontSize: '0.8rem',
    fontWeight: 700,
    px: 1.3,
    ...(enabled
      ? {}
      : {
          color: 'text.secondary',
          opacity: 0.7,
        }),
  }),
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
    width: '100%',
    maxWidth: 360,
    mx: 'auto',
  } satisfies SxProps<Theme>,
  loginTitle: {
    fontWeight: 800,
    letterSpacing: 0.5,
    fontSize: { xs: '1.6rem', sm: '1.95rem' },
    textAlign: 'center',
    color: 'text.primary',
    textShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
  } satisfies SxProps<Theme>,
  authTabs: {
    mb: 2,
    border: `1px solid ${uiColors.border.faint}`,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
  } satisfies SxProps<Theme>,
  loginGuestActions: {
    mt: 2,
    pt: 1.6,
    borderTop: `1px solid ${uiColors.border.faint}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  } satisfies SxProps<Theme>,
  loginGuestHint: {
    textAlign: 'center',
    color: 'text.secondary',
    fontSize: '0.9rem',
    maxWidth: 360,
  } satisfies SxProps<Theme>,
  accessDialogPaper: {
    maxWidth: 480,
    borderRadius: 2.2,
    backgroundColor: uiColors.bg.surface,
    boxShadow: '0 18px 42px rgba(0, 0, 0, 0.32)',
  } satisfies SxProps<Theme>,
  accessDialogTitle: {
    fontWeight: 800,
    letterSpacing: 0.25,
  } satisfies SxProps<Theme>,
  accessDialogContent: {
    pt: '6px !important',
  } satisfies SxProps<Theme>,
  accessDialogText: {
    color: 'text.secondary',
    lineHeight: 1.6,
  } satisfies SxProps<Theme>,
  accessDialogActions: {
    px: 3,
    pb: 2.4,
    pt: 0.6,
    gap: 1,
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
    backgroundColor: uiColors.bg.boardPanel,
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.25)',
  } satisfies SxProps<Theme>,
  gameActionsBox: {
    width: 'fit-content',
    mx: 'auto',
    p: 1.5,
    borderRadius: 2,
    border: `1px solid ${uiColors.border.faint}`,
    backgroundColor: uiColors.bg.boardPanel,
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.25)',
  } satisfies SxProps<Theme>,
  gameResignButton: {
    minWidth: 150,
    borderColor: 'rgba(164, 164, 158, 0.62)',
    color: '#e4e1d8',
    backgroundColor: 'rgba(63, 61, 57, 0.42)',
    '&:hover': {
      borderColor: 'rgba(184, 184, 176, 0.8)',
      backgroundColor: 'rgba(74, 72, 67, 0.6)',
    },
  } satisfies SxProps<Theme>,
  gameOutcomeBanner: (tone: GameOutcomeTone): SxProps<Theme> => {
    const borderColor = getGameOutcomeBorderColor(tone);
    const backgroundColor = getGameOutcomeBackgroundColor(tone);
    const boxShadow = getGameOutcomeShadowColor(tone);

    return {
      width: '100%',
      maxWidth: 760,
      px: { xs: 1.6, sm: 2.1 },
      py: { xs: 1.2, sm: 1.5 },
      borderRadius: 2,
      border: `1px solid ${borderColor}`,
      backgroundColor,
      boxShadow,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.45,
      textAlign: 'center',
    };
  },
  gameOutcomeTitle: {
    fontWeight: 900,
    fontSize: { xs: '1.16rem', sm: '1.34rem' },
    letterSpacing: 0.25,
  } satisfies SxProps<Theme>,
  gameOpponentInactivityCountdownCard: {
    width: '100%',
    maxWidth: 760,
    px: { xs: 1.5, sm: 1.9 },
    py: { xs: 1.2, sm: 1.4 },
    borderRadius: 2,
    border: '1px solid rgba(146, 195, 92, 0.66)',
    backgroundColor: 'rgba(129, 182, 76, 0.12)',
    boxShadow: '0 8px 16px rgba(47, 64, 31, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: 0.7,
    textAlign: 'center',
  } satisfies SxProps<Theme>,
  gameOpponentInactivityCountdownLabel: {
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: uiColors.text.secondary,
  } satisfies SxProps<Theme>,
  gameOpponentInactivityCountdownValue: {
    fontSize: { xs: '1.7rem', sm: '2rem' },
    fontWeight: 900,
    lineHeight: 1,
    color: uiColors.text.primary,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: 1,
  } satisfies SxProps<Theme>,
  gameOpponentInactivityCountdownTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  } satisfies SxProps<Theme>,
  gameOpponentInactivityCountdownFill: (percent: number): SxProps<Theme> => ({
    width: `${Math.max(0, Math.min(100, percent))}%`,
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(157, 206, 103, 0.95), rgba(129, 182, 76, 0.95))',
    transition: 'width 0.2s linear',
  }),
  gameOpponentInactivityCountdownHint: {
    color: uiColors.text.secondary,
    fontSize: '0.88rem',
  } satisfies SxProps<Theme>,
  boardRow: (size: number, rowIndex: number): SxProps<Theme> => ({
    display: 'flex',
    justifyContent: 'center',
    mb: '-14px',
    ml: `${size - (rowIndex + 1)}px`,
  }),
  boardHex: (
    color: string,
    clickable: boolean,
    highlighted = false,
    muted = false,
    owner: 'human' | 'opponent' | 'empty' = 'empty',
  ): SxProps<Theme> => {
    const mutedFilter = getBoardOwnerMutedFilter(owner);
    const ownerBorderColor = getBoardOwnerBorderColor(owner);
    const mutedPattern = getBoardOwnerMutedPattern(owner);
    const filter = getBoardHexFilter(highlighted, muted, mutedFilter);
    const hoverFilter = getBoardHexHoverFilter(highlighted, muted, mutedFilter);
    const borderStyle = getBoardHexBorderStyle(highlighted, owner, ownerBorderColor);

    return {
      width: 48,
      height: 56,
      backgroundColor: color,
      margin: '4px',
      position: 'relative',
      clipPath: `polygon(
        50% 0%,
        100% 25%,
        100% 75%,
        50% 100%,
        0% 75%,
        0% 25%
      )`,
      transition: 'filter 0.16s ease, box-shadow 0.22s ease, opacity 0.2s ease',
      display: 'inline-block',
      zIndex: highlighted ? 2 : 1,
      opacity: muted ? 0.78 : 1,
      boxShadow: highlighted
        ? '0 0 0 2px rgba(255, 255, 255, 0.88)'
        : 'none',
      filter,
      transform: 'none',
      animation: 'none',
      '&::before':
        highlighted || (muted && owner !== 'empty')
          ? {
              content: '""',
              position: 'absolute',
              inset: 2,
              clipPath: 'inherit',
              backgroundImage: highlighted
                ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.34) 0 3px, rgba(255,255,255,0) 3px 8px)'
                : mutedPattern,
              opacity: highlighted ? 0.52 : 0.66,
              pointerEvents: 'none',
            }
          : {},
      '&::after':
        highlighted || (muted && owner !== 'empty')
          ? {
              content: '""',
              position: 'absolute',
              inset: highlighted ? 1 : 2,
              clipPath: 'inherit',
              border: borderStyle,
              pointerEvents: 'none',
            }
          : {},
      '&:hover': clickable
        ? {
            filter: hoverFilter,
            cursor: 'pointer',
          }
        : {},
    };
  },
};

export default theme;




