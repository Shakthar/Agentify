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
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
