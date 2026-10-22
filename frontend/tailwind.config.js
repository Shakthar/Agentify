/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identidade "Azulejo" (out/2026): cobalto como única cor de ação,
        // tinta azul-marinho e campos azul-gelo. A escala brand-* mantém os
        // mesmos nomes, por isso o dashboard herda a nova cor sem mudanças.
        brand: {
          50:  '#F4F6FA',
          100: '#EAEFF8',
          200: '#D3DAE8',
          300: '#A9B8E8',
          400: '#5C77E6',
          500: '#3657E0',
          600: '#2346D8',
          700: '#1C38B0',
          800: '#18307F',
          900: '#13213C',
        },
        ink: { DEFAULT: '#13213C', soft: '#3A4660', mute: '#5B6680' },
        field: '#EAEFF8',
        mist: '#F4F6FA',
        // Tokens da app (out/2026, estilo "framed sheet"): moldura azul-gelo,
        // folha branca, tinta azul-marinho, cobalto só no que é dado/ação.
        // Valores em styles/globals.css (:root e .dark), por isso o modo
        // escuro troca tudo de uma vez e o contraste fica sempre certo.
        app: {
          frame: 'rgb(var(--app-frame) / <alpha-value>)',
          sheet: 'rgb(var(--app-sheet) / <alpha-value>)',
          raised: 'rgb(var(--app-raised) / <alpha-value>)',
          edge: 'rgb(var(--app-edge) / <alpha-value>)',
          rule: 'rgb(var(--app-rule) / <alpha-value>)',
          control: 'rgb(var(--app-control) / <alpha-value>)',
          ink: 'rgb(var(--app-ink) / <alpha-value>)',
          muted: 'rgb(var(--app-muted) / <alpha-value>)',
          faint: 'rgb(var(--app-faint) / <alpha-value>)',
          accent: 'rgb(var(--app-accent) / <alpha-value>)',
          'accent-ink': 'rgb(var(--app-accent-ink) / <alpha-value>)',
          'accent-soft': 'rgb(var(--app-accent-soft) / <alpha-value>)',
          pos: 'rgb(var(--app-pos) / <alpha-value>)',
          'pos-soft': 'rgb(var(--app-pos-soft) / <alpha-value>)',
          neg: 'rgb(var(--app-neg) / <alpha-value>)',
          'neg-soft': 'rgb(var(--app-neg-soft) / <alpha-value>)',
          warn: 'rgb(var(--app-warn) / <alpha-value>)',
          'warn-soft': 'rgb(var(--app-warn-soft) / <alpha-value>)',
        },
        line: '#D3DAE8',
        // Só para a demonstração de conversa (imita o WhatsApp).
        wa: { header: '#008069', bubble: '#D9FDD3', wall: '#EFEAE2', tick: '#53BDEB', text: '#111B21', meta: '#667781' },
      },
      fontFamily: {
        // src/pages/_document.tsx aplica --font-sans (Inter, via next/font) ao <html>.
        // Cai para o stack por omissão do Tailwind se a variavel nao existir.
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-display)', 'var(--font-sans)', ...defaultTheme.fontFamily.sans],
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
