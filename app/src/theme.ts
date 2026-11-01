// Design tokens for the host app, mirroring web/src/styles/tokens.css: the neon pub quiz night
// identity (spec §2.3), dark only. Components use these only.

const gold = '#FFC23D';
const violet = '#C77DFF';

export const color = {
  bg: '#120A1F',
  surface: '#1D1230',
  surfaceRaised: '#2A1B44',
  border: '#3A2A5A',
  text: '#F7F0E1',
  textMuted: '#B9A8D6',
  gold,
  goldPressed: '#E6A920',
  goldLight: '#FFE3A3',
  onGold: '#1A0F00',
  violet,
  violetLight: '#F0D9FF',
  primary: gold,
  primaryPressed: '#E6A920',
  onPrimary: '#1A0F00',
  accent: gold,
  success: '#5CF2A6',
  warning: '#FFB27A',
  danger: '#FF7A59',
  onDanger: '#1A0600',
  qrDark: '#000000',
  qrLight: '#FFFFFF',
  choice: ['#FFC23D', '#3EE6D2', '#FF4F9E', '#8A4DFF'],
  onChoice: ['#1A0F00', '#04201D', '#2A0418', '#FFFFFF'],
  /** Dims the screen behind a dialog. */
  scrim: 'rgba(8, 4, 15, 0.75)',
} as const;

/** React Native has one shadow per text, so each sign gets a single soft glow. */
export const glow = {
  goldText: { textShadowColor: 'rgba(255, 194, 61, 0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  violetText: { textShadowColor: 'rgba(199, 125, 255, 0.85)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  softGoldText: { textShadowColor: 'rgba(255, 194, 61, 0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  /** Box glow: shadowColor works on iOS and Android 9+; elevation gives older Android a lift. */
  gold: { shadowColor: gold, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  violet: { shadowColor: violet, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
} as const;

/** Font files are loaded in app/_layout.tsx; on Android each weight is its own family. */
export const font = {
  sign: 'TiltNeon-Regular',
  display: 'BigShouldersDisplay-Black',
  displayBold: 'BigShouldersDisplay-ExtraBold',
  body: 'Manrope-Regular',
  bodySemi: 'Manrope-SemiBold',
  bodyBold: 'Manrope-ExtraBold',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40, 8: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const text = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
  display: 64,
} as const;

export const size = {
  tapMin: 48,
  qr: 220,
  /** Screens wider than this get the two-column (tablet) layout. */
  wide: 768,
  contentMax: 960,
  /** Forms and reading screens stay narrower on a tablet, so lines stay easy to read. */
  formMax: 640,
  borderWidth: 1,
  borderStrong: 2,
  numberColumn: 48,
  markColumn: 20,
  controlMin: 140,
  dialogMax: 420,
  radio: 22,
  radioBorder: 2,
  tabIcon: 24,
} as const;

export const tracking = { caps: 1.5 } as const;

export const opacity = { disabled: 0.5, pressed: 0.85, offline: 0.45 } as const;
