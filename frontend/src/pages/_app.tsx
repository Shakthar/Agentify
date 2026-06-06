import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import i18n from '../lib/i18n';
import { useTheme } from '../hooks/useTheme';
import '../styles/globals.css';

// Aplica o tema salvo ANTES do primeiro render para evitar flash branco
const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
    }}
  />
);

function ThemeToggle() {
  const { toggle, isDark } = useTheme();
  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 shadow-sm transition-colors dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {isDark ? 'Modo claro' : 'Modo escuro'}
    </button>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const { locale } = useRouter();

  useEffect(() => {
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return (
    <>
      <ThemeScript />
      <ThemeToggle />
      <Component {...pageProps} />
    </>
  );
}
