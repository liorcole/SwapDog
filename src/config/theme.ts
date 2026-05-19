export const colors = {
  primary: '#FF2D55',
  secondary: '#4ECDC4',
  background: '#FFF5F5',
  surface: '#FFFFFF',
  text: '#2D3436',
  textSecondary: '#636E72',
  error: '#E17055',
  success: '#00B894',
  warning: '#FDCB6E',
  border: '#F0D9D9',
};

export const darkColors = {
  primary: '#FF2D55',
  secondary: '#4ECDC4',
  background: '#1A0A0A',
  surface: '#2A1414',
  text: '#FAFAFA',
  textSecondary: '#C0A0A0',
  error: '#E17055',
  success: '#00B894',
  warning: '#FDCB6E',
  border: '#3D2020',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  button: { fontSize: 16, fontWeight: '600' as const },
};

export const shadow = {
  sm: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const theme = {
  colors,
  darkColors,
  spacing,
  borderRadius,
  typography,
  shadow,
};

export default theme;
