import { useState, useEffect, useCallback } from 'react';

const KEY = 'appTheme'; // 'dark' | 'light'

function applyTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme; // yo'q bo'lsa default (dark) ishlaydi
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'dark');

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
