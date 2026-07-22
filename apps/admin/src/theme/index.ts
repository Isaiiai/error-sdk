import { createTheme, alpha } from '@mui/material/styles';

/** Isaii Error Tracker — signal-console tokens */
export const brand = {
  ink: '#07070D',
  inkSoft: '#12121C',
  magenta: '#D81B60',
  magentaSoft: '#F48FB1',
  cobalt: '#1A6FBF',
  teal: '#0D9488',
  surface: '#E8ECF4',
  paper: '#FFFFFF',
  border: '#CDD5E4',
  muted: '#5B6B7F',
  text: '#0B1220',
  /** @deprecated alias — prefer cobalt */
  blue: '#1A6FBF',
  /** @deprecated alias — prefer teal */
  cyan: '#0D9488',
  violet: '#7C3AED',
};

export const signalGradient = `linear-gradient(90deg, ${brand.magenta} 0%, ${brand.cobalt} 52%, ${brand.teal} 100%)`;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brand.magenta,
      light: '#EC407A',
      dark: '#AD1457',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brand.cobalt,
      light: '#4B9ADB',
      dark: '#0F4F8A',
      contrastText: '#FFFFFF',
    },
    error: { main: '#E11D48' },
    warning: { main: '#D97706' },
    success: { main: '#059669' },
    info: { main: brand.teal },
    divider: brand.border,
    background: {
      default: brand.surface,
      paper: brand.paper,
    },
    text: {
      primary: brand.text,
      secondary: brand.muted,
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    h1: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.04em',
      lineHeight: 1.1,
    },
    h2: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.035em',
      lineHeight: 1.15,
    },
    h3: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.15,
    },
    h4: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      fontSize: '1.75rem',
      lineHeight: 1.2,
    },
    h5: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 650,
      letterSpacing: '-0.02em',
    },
    h6: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 650,
      letterSpacing: '-0.015em',
      fontSize: '1.05rem',
    },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    overline: {
      fontFamily: '"IBM Plex Mono", monospace',
      fontWeight: 600,
      letterSpacing: '0.12em',
      fontSize: '0.68rem',
      lineHeight: 1.5,
    },
    caption: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      letterSpacing: '0.01em',
    },
  },
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    '0 1px 0 rgba(11, 18, 32, 0.04)',
    '0 1px 2px rgba(11, 18, 32, 0.05)',
    '0 4px 12px rgba(11, 18, 32, 0.06)',
    '0 8px 20px rgba(11, 18, 32, 0.08)',
    ...Array(20).fill('0 8px 20px rgba(11, 18, 32, 0.08)'),
  ] as unknown as ReturnType<typeof createTheme>['shadows'],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: brand.surface,
          scrollbarWidth: 'thin',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          paddingInline: 14,
          minHeight: 38,
        },
        containedPrimary: {
          backgroundColor: brand.magenta,
          backgroundImage: 'none',
          '&:hover': {
            backgroundColor: '#AD1457',
            backgroundImage: 'none',
            filter: 'none',
          },
        },
        outlined: {
          borderColor: brand.border,
          backgroundColor: brand.paper,
          '&:hover': {
            borderColor: alpha(brand.magenta, 0.45),
            backgroundColor: alpha(brand.magenta, 0.04),
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${brand.border}`,
          boxShadow: 'none',
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${brand.border}`,
          boxShadow: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#fff',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(brand.magenta, 0.4),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.magenta,
            borderWidth: 1.5,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6,
          fontFamily: '"IBM Plex Sans", sans-serif',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 650,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: brand.muted,
            backgroundColor: alpha(brand.surface, 0.85),
            borderBottom: `1px solid ${brand.border}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: brand.border,
          fontSize: 14,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          minHeight: 44,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: brand.ink,
          fontSize: 12,
          borderRadius: 6,
        },
      },
    },
  },
});

export const severityColor: Record<string, string> = {
  critical: '#E11D48',
  high: '#EA580C',
  medium: '#D97706',
  low: '#059669',
  info: brand.cobalt,
};

export const chartColors = {
  primary: brand.magenta,
  secondary: brand.cobalt,
  tertiary: brand.teal,
  axis: brand.muted,
  grid: brand.border,
};
