/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3b57f0',
          700: '#2d44d4',
          900: '#1a2875',
        },
      },
      fontFamily: {
        // src/pages/_document.tsx aplica --font-sans (Inter, via next/font) ao <html>.
        // Cai para o stack por omissão do Tailwind se a variavel nao existir.
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      // Escala de tamanhos de fonte do Tailwind (defaultTheme.fontSize) x1.4,
      // a pedido do Eduardo (05/09) por as letras terem ficado pequenas.
      // Só o tamanho do texto muda - espaçamentos/larguras (que usam a escala
      // de "spacing", não a de "fontSize") ficam exatamente como estavam.
      fontSize: {
        xs:   ['1.05rem',  { lineHeight: '1.4rem' }],
        sm:   ['1.225rem', { lineHeight: '1.75rem' }],
        base: ['1.4rem',   { lineHeight: '2.1rem' }],
        lg:   ['1.575rem', { lineHeight: '2.45rem' }],
        xl:   ['1.75rem',  { lineHeight: '2.45rem' }],
        '2xl':['2.1rem',   { lineHeight: '2.8rem' }],
        '3xl':['2.625rem', { lineHeight: '3.15rem' }],
        '4xl':['3.15rem',  { lineHeight: '3.5rem' }],
        '5xl':['4.2rem',   { lineHeight: '1' }],
        '6xl':['5.25rem',  { lineHeight: '1' }],
        '7xl':['6.3rem',   { lineHeight: '1' }],
        '8xl':['8.4rem',   { lineHeight: '1' }],
        '9xl':['11.2rem',  { lineHeight: '1' }],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
