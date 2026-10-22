import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Logo from '../Logo';
import { LANDING_COPY, type LandingLocale } from './copy';
import { EXTRA } from './extra';
import { SITE_URL } from './LandingSeo';

/**
 * Casca partilhada das páginas públicas (landing, FAQ, legais, setores):
 * estilos globais (sempre claros, movimento só com transform/opacity),
 * barra de topo que muda de tinta conforme o capítulo por baixo, e rodapé.
 */
export function LandingStyles() {
  return (
    <style jsx global>{`
      :root { color-scheme: light; }
      html { scroll-behavior: smooth; }
      .lp { background: #fff; color: #13213c; }
      .lp ::selection { background: #2346d8; color: #fff; }
      .lp a:focus-visible, .lp button:focus-visible, .lp summary:focus-visible, .lp input:focus-visible, .lp [tabindex]:focus-visible {
        outline: 3px solid #5c77e6; outline-offset: 3px; border-radius: 6px;
      }
      .lp [data-tone='dark'] a:focus-visible, .lp [data-tone='dark'] button:focus-visible, .lp [data-tone='brand'] a:focus-visible, .lp [data-tone='brand'] button:focus-visible, .lp [data-tone='brand'] input:focus-visible, .lp [data-tone='brand'] summary:focus-visible, .lp [data-tone='dark'] summary:focus-visible {
        outline-color: #ffffff;
      }
      /* Entrada por partes: só ativa quando o JS corre, nunca esconde conteúdo sem ele. */
      .lp-js .lp-r { opacity: 0; transform: translate3d(0, 28px, 0); transition: opacity 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) var(--d, 0ms), transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) var(--d, 0ms); }
      .lp-js .lp-r.in { opacity: 1; transform: none; }
      .lp-js .lp-r-l { transform: translate3d(-32px, 0, 0); }
      .lp-js .lp-r-s { transform: scale(0.96) translate3d(0, 24px, 0); }
      .lp-js .lp-r-l.in, .lp-js .lp-r-s.in { transform: none; }
      /* Feedback de controlo */
      .lp .lp-press { transition: transform 0.15s ease-out, background-color 0.2s, color 0.2s; }
      .lp .lp-press:hover { transform: translate3d(0, -2px, 0); }
      .lp .lp-press:active { transform: scale(0.97); }
      .lp .lp-lift { transition: transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1); }
      .lp .lp-lift:hover { transform: translate3d(0, -6px, 0); }
      .lp .lp-arrow { transition: transform 0.2s ease-out; }
      .lp a:hover > .lp-arrow, .lp button:hover > .lp-arrow, .lp summary:hover .lp-arrow { transform: translate3d(4px, 0, 0); }
      .lp details[open] > summary .lp-plus { transform: rotate(45deg); }
      .lp .lp-plus { transition: transform 0.25s ease-out; }
      .lp summary { list-style: none; cursor: pointer; }
      .lp summary::-webkit-details-marker { display: none; }
      .lp .lp-tick { position: relative; padding-left: 32px; }
      .lp .lp-tick::before { content: ''; position: absolute; left: 0; top: 0.2em; width: 20px; height: 20px; background: url("data:image/svg+xml,%3Csvg xmlns='http:%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 24 24' fill='none' stroke='%232346D8' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") no-repeat center / contain; }
      .lp .lp-tick-w::before { background-image: url("data:image/svg+xml,%3Csvg xmlns='http:%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 24 24' fill='none' stroke='%23FFFFFF' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E"); }
      .lp .lp-dash::before { background-image: url("data:image/svg+xml,%3Csvg xmlns='http:%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 24 24' fill='none' stroke='%235B6680' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 12h12'/%3E%3C/svg%3E"); }
      /* Texto longo (páginas legais): 68ch, ritmo de leitura */
      .lp-prose { color: #26324b; }
      .lp-prose h2 { font-family: var(--font-display), var(--font-sans), sans-serif; font-weight: 800; color: #13213c; font-size: clamp(26px, 3vw, 34px); line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 16px; scroll-margin-top: 96px; }
      .lp-prose p, .lp-prose li { font-size: 18px; line-height: 1.65; max-width: 68ch; }
      .lp-prose table { display: block; max-width: 100%; overflow-x: auto; }
      .lp-prose strong { color: #13213c; }
      .lp-prose a { color: #1c38b0; text-decoration: underline; text-underline-offset: 3px; }
      .lp-prose ul:not([class*='list-none']) { padding-left: 1.25rem; }
      /* Faixa que corre */
      .lp-marq-track { display: flex; width: max-content; animation: lp-marq 42s linear infinite; will-change: transform; }
      @keyframes lp-marq { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }
      /* Pulsar do estado "online" e do cursor de escrita */
      .lp-pulse { animation: lp-pulse 2.2s ease-out infinite; }
      @keyframes lp-pulse { 0% { transform: scale(1); opacity: 0.7; } 80%, 100% { transform: scale(2.6); opacity: 0; } }
      .lp-float { animation: lp-float 7s ease-in-out infinite; will-change: transform; }
      @keyframes lp-float { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -10px, 0); } }
      .lp-bar { transform-origin: left center; transform: scaleX(0); transition: transform 1.1s cubic-bezier(0.2, 0.7, 0.2, 1) var(--d, 0ms); }
      .in .lp-bar, .lp-bar.in { transform: scaleX(1); }
      html:not(.lp-on) .lp-bar { transform: scaleX(1); }
      .lp-head { transition: background-color 0.3s ease, color 0.3s ease; }
      .lp-head[data-tone='dark'] { background-color: #13213c; color: #fff; }
      .lp-head[data-tone='light'] { background-color: #fff; color: #13213c; }
      .lp-head[data-tone='field'] { background-color: #eaeff8; color: #13213c; }
      .lp-head[data-tone='brand'] { background-color: #2346d8; color: #fff; }
      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        .lp-js .lp-r, .lp-js .lp-r-l, .lp-js .lp-r-s { opacity: 1; transform: none; transition: none; }
        .lp-marq-track, .lp-pulse, .lp-float { animation: none; }
        .lp-bar { transform: none; transition: none; }
        .lp .lp-press:hover, .lp .lp-lift:hover { transform: none; }
      }
    `}</style>
  );
}

/** Ativa as entradas por partes: marca <html> e acrescenta .in quando o elemento entra no ecrã. */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('lp-js', 'lp-on');
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-r, .lp-bar'));
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((e) => e.classList.add('in'));
      return () => root.classList.remove('lp-js', 'lp-on');
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
    return () => { io.disconnect(); root.classList.remove('lp-js', 'lp-on'); };
  }, []);
}

type Tone = 'light' | 'field' | 'dark' | 'brand';

interface HeaderProps {
  locale: LandingLocale;
  /** Caminho da página (sem prefixo de idioma), para o seletor de idioma. */
  path?: string;
  home?: boolean;
  onLogin?: () => void;
  onSignup?: () => void;
  initialTone?: Tone;
}

export function LandingHeader({ locale, path = '/', home = false, onLogin, onSignup, initialTone = 'light' }: HeaderProps) {
  const c = LANDING_COPY[locale];
  const x = EXTRA[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const [tone, setTone] = useState<Tone>(initialTone);
  const ref = useRef<HTMLElement>(null);

  // A barra assume a tinta do capítulo que está por baixo dela.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = (ref.current?.getBoundingClientRect().height ?? 72) / 2;
      const nodes = document.querySelectorAll<HTMLElement>('[data-tone]:not(.lp-head)');
      let next: Tone | null = null;
      nodes.forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) next = n.dataset.tone as Tone;
      });
      if (window.scrollY < 8) next = initialTone;
      if (next) setTone((t) => (t === next ? t : (next as Tone)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [initialTone]);

  const base = home ? '' : '/';
  const nav: { href: string; label: string; page?: boolean }[] = [
    { href: `${base}#como`, label: c.nav.how },
    { href: `${base}#porque`, label: c.nav.compare },
    { href: `${base}#setores`, label: c.nav.sectors },
    { href: `${base}#precos`, label: c.nav.pricing },
    { href: '/faq', label: c.nav.faq, page: true },
  ];
  const dark = tone === 'dark' || tone === 'brand';
  const link = 'rounded px-1 py-2 text-[17px] font-medium opacity-90 hover:opacity-100 hover:underline hover:underline-offset-8';
  const renderLink = (n: (typeof nav)[number], cls: string, onClick?: () => void) =>
    n.page || !home ? (
      <Link key={n.href} href={n.href} locale={locale} className={cls} onClick={onClick}>{n.label}</Link>
    ) : (
      <a key={n.href} href={n.href} className={cls} onClick={onClick}>{n.label}</a>
    );

  return (
    <header ref={ref} data-tone={tone} className="lp-head sticky top-0 z-40">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" locale={locale} aria-label="Agentfy" className="shrink-0"><Logo size={36} inverted={dark} /></Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
          {nav.map((n) => renderLink(n, link))}
        </nav>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden items-center gap-1 text-[15px] md:flex" role="group" aria-label="Idioma">
            {(['pt', 'es', 'en'] as const).map((l) => (
              <Link key={l} href={path} locale={l} hrefLang={l} aria-current={l === locale ? 'true' : undefined}
                className={`rounded px-1.5 py-1 font-semibold uppercase ${l === locale ? 'underline underline-offset-8' : 'opacity-80 hover:opacity-100'}`}>{l}</Link>
            ))}
          </div>
          {onLogin ? (
            <button onClick={onLogin} className="hidden min-h-[44px] px-2 text-[17px] font-medium hover:underline hover:underline-offset-8 sm:block">{c.nav.login}</button>
          ) : (
            <Link href="/?login=1" locale={locale} className="hidden min-h-[44px] items-center px-2 text-[17px] font-medium hover:underline hover:underline-offset-8 sm:flex">{c.nav.login}</Link>
          )}
          {onSignup ? (
            <button onClick={onSignup} className={`lp-press min-h-[44px] whitespace-nowrap rounded-[10px] px-3.5 text-[16px] font-semibold sm:px-4 sm:text-[17px] ${dark ? 'bg-white text-ink hover:bg-field' : 'bg-brand-600 text-white hover:bg-brand-700'}`}><span className="sm:hidden">{x.signup}</span><span className="hidden sm:inline">{c.nav.cta}</span></button>
          ) : (
            <Link href="/?signup=1" locale={locale} className={`lp-press flex min-h-[44px] items-center whitespace-nowrap rounded-[10px] px-3.5 text-[16px] font-semibold sm:px-4 sm:text-[17px] ${dark ? 'bg-white text-ink hover:bg-field' : 'bg-brand-600 text-white hover:bg-brand-700'}`}><span className="sm:hidden">{x.signup}</span><span className="hidden sm:inline">{c.nav.cta}</span></Link>
          )}
          <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={c.nav.menu} className={`flex h-11 w-11 items-center justify-center rounded-lg ${dark ? 'bg-white/15' : 'bg-ink/10'} lg:hidden`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-menu" aria-label={c.nav.menu} className="px-4 pb-5 lg:hidden">
          <div className="mx-auto max-w-[1280px]">
            {nav.map((n) => renderLink(n, 'block py-3 text-[20px] font-medium', () => setMenuOpen(false)))}
            <div className="flex items-center gap-4 pt-2">
              {(['pt', 'es', 'en'] as const).map((l) => <Link key={l} href={path} locale={l} hrefLang={l} className="py-2 text-[17px] font-semibold uppercase">{l}</Link>)}
              {onLogin ? <button onClick={() => { setMenuOpen(false); onLogin(); }} className="ml-auto py-2 text-[17px] font-medium">{c.nav.login}</button>
                : <Link href="/?login=1" locale={locale} className="ml-auto py-2 text-[17px] font-medium">{c.nav.login}</Link>}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

export function LandingFooter({ locale }: { locale: LandingLocale }) {
  const c = LANDING_COPY[locale];
  const x = EXTRA[locale];
  const email = 'contact@solutions.shaklabs.tech';
  const [user, host] = email.split('@');
  return (
    <footer data-tone="dark" className="bg-ink text-white">
      <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-16 md:px-8 md:pt-24">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Logo size={32} inverted />
            <p className="max-w-[420px] text-[17px] leading-[1.55] text-[#D6DDEC]">{x.footerNote}</p>
          </div>
          <nav aria-label="Legal" className="grid grid-cols-2 gap-x-8 gap-y-3 text-[17px] sm:grid-cols-3 lg:col-span-7">
            <Link href="/faq" locale={locale} className="hover:underline hover:underline-offset-4">{x.footerFaq}</Link>
            <Link href="/privacy-policy" locale={locale} className="hover:underline hover:underline-offset-4">{c.footer.privacy}</Link>
            <Link href="/terms-of-service" locale={locale} className="hover:underline hover:underline-offset-4">{c.footer.terms}</Link>
            <Link href="/data-deletion" locale={locale} className="hover:underline hover:underline-offset-4">{c.footer.deletion}</Link>
            <Link href="/" locale={locale} className="hover:underline hover:underline-offset-4">{x.home}</Link>
            <a href="#top" className="hover:underline hover:underline-offset-4">{x.backToTop}</a>
          </nav>
        </div>
        <a href={`mailto:${email}`} className="lp-press mt-16 block break-words font-display font-extrabold leading-[0.95] tracking-[-0.04em] text-white hover:underline hover:underline-offset-[10px] md:mt-24"
          style={{ fontSize: 'clamp(26px, 6.4vw, 92px)' }}>
          {user}<br />@{host}
        </a>
        <div className="mt-14 flex flex-col gap-2 text-[15px] text-[#D6DDEC] md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} Agentfy · Shaklabs</span>
          <span>{c.footer.made}</span>
          <a href={SITE_URL} className="hover:underline">agentfy.shaklabs.tech</a>
        </div>
      </div>
    </footer>
  );
}

/** Pagina pública completa: estilos, barra, conteúdo e rodapé. */
export function LandingShell({ locale, path, children }: { locale: LandingLocale; path: string; children: ReactNode }) {
  useReveal();
  return (
    <>
      <LandingStyles />
      <div id="top" className="lp min-h-screen font-sans">
        <LandingHeader locale={locale} path={path} />
        {children}
        <LandingFooter locale={locale} />
      </div>
    </>
  );
}
