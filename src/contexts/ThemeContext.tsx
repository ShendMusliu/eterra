import { createContext, useContext, useEffect, type ReactNode } from 'react';

type ThemeMode = 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const applyThemeClass = () => {
  document.documentElement.classList.remove('dark');
  document.documentElement.dataset.theme = 'light';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyThemeClass();
  }, []);

  const setTheme = () => {
    // Intentionally left blank; light mode is enforced.
  };

  return <ThemeContext.Provider value={{ theme: 'light', setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
