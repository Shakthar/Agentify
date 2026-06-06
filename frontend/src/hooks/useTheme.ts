import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme) || 'system';
    setThemeState(stored);
    applyTheme(stored);

    // Reage a mudanças do sistema quando em modo 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((localStorage.getItem('theme') || 'system') === 'system') applyTheme('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = (t: Theme) => {
    localStorage.setItem('theme', t);
    setThemeState(t);
    applyTheme(t);
  };

  const toggle = () => setTheme(
    document.documentElement.classList.contains('dark') ? 'light' : 'dark',
  );

  const isDark = typeof window !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;

  return { theme, setTheme, toggle, isDark };
}
