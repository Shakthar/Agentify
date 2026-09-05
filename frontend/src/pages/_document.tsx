import { Html, Head, Main, NextScript } from 'next/document';
import { inter } from '../lib/fonts';

export default function Document() {
  return (
    <Html lang="pt" className={inter.variable}>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
