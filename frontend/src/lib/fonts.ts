import { Inter, Bricolage_Grotesque } from 'next/font/google';

// Fonte de texto para toda a app - expoe uma CSS variable (--font-sans) que o
// tailwind.config.js referencia em theme.extend.fontFamily.sans.
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Fonte de títulos da identidade "Azulejo" (font-display no Tailwind).
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '800'],
  variable: '--font-display',
  display: 'swap',
});
