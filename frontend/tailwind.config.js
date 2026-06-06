/** @type {import('tailwindcss').Config} */
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
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
