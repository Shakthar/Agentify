import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import i18n from '../lib/i18n';
import { inter, bricolage } from '../lib/fonts';
import '../styles/globals.css';
import PageViewTracker from '../components/PageViewTracker';

// Aplica o tema salvo ANTES do primeiro render para evitar flash branco
const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{if(location.pathname.indexOf('/dashboard')!==0&&!/^\\/[a-z]{2}\\/dashboard/.test(location.pathname))return;var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
    }}
  />
);

export default function App({ Component, pageProps }: AppProps) {
  const { locale, pathname } = useRouter();

  // O modo escuro é só da app (/dashboard). Landing, FAQ e páginas públicas
  // são sempre claras - antes o "sistema escuro" deixava títulos brancos em
  // fundos claros na home.
  useEffect(() => {
    if (!pathname.startsWith('/dashboard')) document.documentElement.classList.remove('dark');
  }, [pathname]);

  // A app vive da sessão guardada no navegador: renderizar /dashboard só no
  // cliente evita o "hydration mismatch" (o servidor não conhece o tenant).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clientOnly = pathname.startsWith('/dashboard');

  useEffect(() => {
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="64x64" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#13213C" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ThemeScript />
      <PageViewTracker />
      {/* As fontes do next/font têm de ser importadas no _app (o _document não
          carrega CSS no cliente); expõe-nas como variáveis no :root para o
          Tailwind (font-sans / font-display). */}
      <style jsx global>{`
        :root {
          --font-sans: ${inter.style.fontFamily};
          --font-display: ${bricolage.style.fontFamily};
        }
      `}</style>
      {/* Facebook SDK — Embedded Signup (WhatsApp) */}
      <Script
        id="facebook-sdk-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.fbAsyncInit = function() {
              FB.init({
                appId: '4098020310452947',
                autoLogAppEvents: true,
                xfbml: true,
                version: 'v26.0'
              });
            };
          `,
        }}
      />
      <Script
        id="facebook-sdk"
        strategy="afterInteractive"
        async
        defer
        crossOrigin="anonymous"
        src="https://connect.facebook.net/en_US/sdk.js"
      />
      {clientOnly && !mounted ? <div className="min-h-screen bg-app-frame" /> : <Component {...pageProps} />}
    </>
  );
}
