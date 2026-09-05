import { Inter } from 'next/font/google';

// Fonte unica para toda a app - expoe uma CSS variable (--font-sans) que o
// tailwind.config.js referencia em theme.extend.fontFamily.sans.
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
