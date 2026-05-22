import React, { createContext, useContext, ReactNode } from 'react';
import { darkColors } from '../config/theme';

type ColorPalette = typeof darkColors;

interface ThemeContextType {
  isDark: boolean;
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: darkColors,
});

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={{ isDark: true, colors: darkColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
