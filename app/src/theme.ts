// Design tokens for the host app, mirroring web/src/styles/tokens.css so the host screen, the
// players' phones and the TV read as one product. Components use these only.

export const color = {
  bg: '#f6f4ef',
  surface: '#ffffff',
  surfaceRaised: '#fbfaf7',
  text: '#1b1a22',
  textMuted: '#5d5a6b',
  border: '#e2dfd6',
  primary: '#3a2fd1',
  primaryPressed: '#2b22a8',
  onPrimary: '#ffffff',
  accent: '#f2a900',
  success: '#1c7c4a',
  warning: '#a85f00',
  danger: '#b3261e',
  qrDark: '#000000',
  qrLight: '#ffffff',
  /** Dims the screen behind a dialog. */
  scrim: 'rgba(27, 26, 34, 0.55)',
  choice: ['#3a2fd1', '#c2410c', '#0f766e', '#a21caf'],
  onChoice: '#ffffff',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40, 8: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const text = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
  display: 56,
} as const;

export const weight = { regular: '400', semibold: '600', bold: '800' } as const;

export const size = {
  tapMin: 48,
  qr: 220,
  /** Screens wider than this get the two-column (tablet) layout. */
  wide: 768,
  contentMax: 960,
  borderWidth: 1,
  numberColumn: 48,
  markColumn: 20,
  controlMin: 140,
  dialogMax: 420,
} as const;

export const tracking = { caps: 1 } as const;

export const opacity = { disabled: 0.5, pressed: 0.85, offline: 0.45 } as const;
