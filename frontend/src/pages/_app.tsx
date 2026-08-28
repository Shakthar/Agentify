import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';
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
      <Head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ThemeScript />
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
      <Component {...pageProps} />
    </>
  );
}
