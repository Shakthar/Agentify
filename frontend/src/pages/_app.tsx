import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import i18n from '../lib/i18n';
import '../styles/globals.css';

// Aplica o tema salvo ANTES do primeiro render para evitar flash branco
const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
    }}
  />
);

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
      <Component {...pageProps} />
    </>
  );
}
