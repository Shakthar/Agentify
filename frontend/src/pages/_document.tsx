import { Html, Head, Main, NextScript } from 'next/document';
import { inter, bricolage } from '../lib/fonts';

export default function Document() {
  return (
    <Html className={`${inter.variable} ${bricolage.variable}`}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
