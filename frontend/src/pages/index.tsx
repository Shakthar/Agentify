import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import Logo from '../components/Logo';
import SupportWidget from '../components/SupportWidget';
import WhatsAppDemo from '../components/landing/WhatsAppDemo';
import LandingSeo from '../components/landing/LandingSeo';
import { LANDING_COPY, landingLocale } from '../components/landing/copy';
import api from '../utils/api';
import { PLAN_PRICING, TOP_UP, estConversations, money, num, defaultCurrency, type Currency, type PlanId } from '../utils/pricing';

type AuthTab = 'login' | 'signup';

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'business', 'enterprise'];
const SALES_EMAIL = 'mailto:contact@solutions.shaklabs.tech';

function Check({ className = 'text-brand-600' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-ink-mute">
      <path d="M6 12h12" />
    </svg>
  );
}

const CHANNEL_ICONS: Record<string, JSX.Element> = {
  0: <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" />,
  1: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></>,
  2: <path d="m21 4-18 7 6 2 2 6 3-4 5 4z" />,
  3: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></>,
};

export default function Home() {
  const router = useRouter();
  const { tenant, login, signup, loading, error, clearError, pendingTwoFactor, completeTwoFactorLogin, cancelTwoFactor, loginWithFacebookTicket } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>('EUR');
  useEffect(() => { setCurrency(defaultCurrency()); }, []);
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = landingLocale(router.locale);
  const c = LANDING_COPY[loc];
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const authRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tenant) router.replace(ROUTES.dashboard);
  }, [tenant, router]);

  // Regresso do fluxo "Continuar com Facebook" (ver GET /api/auth/facebook/callback):
  // troca o ticket de curta duração pelos tokens de sessão reais.
  useEffect(() => {
    if (!router.isReady) return;
    const { fbTicket, fbAuthError, signup: signupParam } = router.query as { fbTicket?: string; fbAuthError?: string; signup?: string };

    // Links "Criar conta" das páginas de setor (/para/[slug]) chegam com ?signup=1.
    if (signupParam && !fbTicket && !fbAuthError) {
      setTab('signup');
      setAuthOpen(true);
      router.replace(router.pathname, undefined, { shallow: true });
      return;
    }

    if (fbAuthError) {
      setFbError(fbAuthError);
      setAuthOpen(true);
      router.replace(router.pathname, undefined, { shallow: true });
      return;
    }

    if (fbTicket) {
      setAuthOpen(true);
      loginWithFacebookTicket(fbTicket)
        .then(() => router.replace(ROUTES.dashboard))
        .catch((err: Error) => setFbError(err.message))
        .finally(() => router.replace(router.pathname, undefined, { shallow: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const handleFacebookLogin = async () => {
    setFbLoading(true); setFbError(null);
    try {
      const { data } = await api.get('/api/auth/facebook');
      window.location.href = data.url;
    } catch {
      setFbError('Não foi possível iniciar o login com o Facebook');
      setFbLoading(false);
    }
  };

  // Close auth panel on outside click
  useEffect(() => {
    if (!authOpen) return;
    const handle = (e: MouseEvent) => {
      if (authRef.current && !authRef.current.contains(e.target as Node)) {
        setAuthOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [authOpen]);

  const openAuth = (t: AuthTab) => { setTab(t); setAuthOpen(true); clearError(); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); clearError();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, name, company || undefined);
        router.push(ROUTES.dashboard);
      }
    } catch { /* error set in store */ }
  };

  const handleTwoFactor = async (e: FormEvent) => {
    e.preventDefault(); clearError();
    try {
      await completeTwoFactorLogin(twoFactorCode);
      router.push(ROUTES.dashboard);
    } catch { setTwoFactorCode(''); }
  };

  const nav = [
    { href: '#como', label: c.nav.how },
    { href: '#porque', label: c.nav.compare },
    { href: '#setores', label: c.nav.sectors },
    { href: '#precos', label: c.nav.pricing },
    { href: '#faq', label: c.nav.faq },
  ];
  const otherLocales = (['pt', 'es', 'en'] as const);

  return (
    <>
      <Head>
        <title>{c.meta.title}</title>
        <meta name="description" content={c.meta.description} />
      </Head>
      <LandingSeo copy={c} locale={loc} />

      <div className="min-h-screen bg-white font-sans text-ink">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" locale={loc} aria-label="Agentfy" className="shrink-0"><Logo size={36} /></Link>
          <nav aria-label="Principal" className="hidden items-center gap-7 text-[17px] font-medium lg:flex">
            {nav.map((n) => <a key={n.href} href={n.href} className="hover:text-brand-600">{n.label}</a>)}
          </nav>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden items-center gap-1 text-[15px] md:flex" aria-label="Idioma">
              {otherLocales.map((l) => (
                <Link key={l} href="/" locale={l} className={`rounded px-1.5 py-1 font-semibold uppercase ${l === loc ? 'text-ink' : 'text-ink-mute hover:text-ink'}`} aria-current={l === loc ? 'true' : undefined}>{l}</Link>
              ))}
            </div>
            <button onClick={() => openAuth('login')} className="hidden min-h-[44px] px-2 text-[17px] font-medium hover:text-brand-600 sm:block">{c.nav.login}</button>
            <button onClick={() => openAuth('signup')} className="min-h-[44px] rounded-[10px] bg-brand-600 px-4 text-[17px] font-semibold text-white hover:bg-brand-700">{c.nav.cta}</button>
            <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={c.nav.menu} className="flex h-11 w-11 items-center justify-center rounded-lg border border-line lg:hidden">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" aria-label={c.nav.menu} className="border-t border-line px-4 pb-4 lg:hidden">
            {nav.map((n) => <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="block py-3 text-[19px] font-medium">{n.label}</a>)}
            <div className="flex gap-3 pt-2">
              {otherLocales.map((l) => <Link key={l} href="/" locale={l} className="py-2 text-[17px] font-semibold uppercase">{l}</Link>)}
              <button onClick={() => { setMenuOpen(false); openAuth('login'); }} className="ml-auto py-2 text-[17px] font-medium">{c.nav.login}</button>
            </div>
          </nav>
        )}
      </header>

      {/* ─── Auth Modal / Panel ─── */}
      {(authOpen || pendingTwoFactor) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={authRef} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Logo size={32} />
                <button
                  onClick={() => { setAuthOpen(false); if (pendingTwoFactor) cancelTwoFactor(); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >×</button>
              </div>

              {pendingTwoFactor ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-3">🔐</div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Código de autenticação</h2>
                    <p className="text-sm text-gray-500 mt-1">Abre o teu Google Authenticator e introduz o código de 6 dígitos.</p>
                  </div>
                  <form onSubmit={handleTwoFactor} className="space-y-4">
                    <input className="input text-center text-2xl tracking-widest font-mono" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                      value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus required />
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                    <button type="submit" className="btn-primary w-full py-2.5" disabled={loading || twoFactorCode.length !== 6}>
                      {loading ? 'A verificar...' : 'Verificar'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 -mt-2">
                    {(['login', 'signup'] as AuthTab[]).map((t) => (
                      <button key={t} onClick={() => { setTab(t); clearError(); setFbError(null); }}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t === 'login' ? 'Entrar' : 'Criar conta'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleFacebookLogin}
                    disabled={fbLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm text-white transition-colors mb-4"
                    style={{ background: fbLoading ? '#888' : '#1877F2' }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    {fbLoading ? 'A ligar...' : 'Continuar com Facebook'}
                  </button>
                  {fbError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{fbError}</p>}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400">ou com email</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {tab === 'signup' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                          <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" required minLength={2} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
                          <input className="input" type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Minha Empresa Lda." />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder={tab === 'signup' ? 'Mín. 8 caracteres, 1 maiúscula, 1 número' : '••••••••'} required minLength={8} />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                    <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
                      {loading ? 'A processar...' : tab === 'login' ? 'Entrar' : 'Criar conta grátis'}
                    </button>
                    {tab === 'signup' && (
                      <p className="text-[15px] text-gray-400 text-center">
                        Ao criar conta aceitas os nossos <Link href="/terms-of-service" className="underline">Termos de Serviço</Link> e <Link href="/privacy-policy" className="underline">Política de Privacidade</Link>.
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      <main>
        {/* ─── Hero ─── */}
        <section className="mx-auto grid max-w-[1280px] gap-12 px-4 pb-16 pt-12 md:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-20">
          <div className="flex flex-col gap-7 lg:col-span-6 lg:pt-6">
            <h1 className="font-display text-[46px] font-extrabold leading-[1.0] tracking-[-0.035em] sm:text-[64px] xl:text-[80px]">{c.hero.title}</h1>
            <p className="max-w-[580px] text-[20px] leading-[1.55] text-ink-soft md:text-[22px]">{c.hero.sub}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => openAuth('signup')} className="min-h-[56px] rounded-xl bg-brand-600 px-7 text-[20px] font-semibold text-white hover:bg-brand-700">{c.hero.cta}</button>
              <a href="#porque" className="flex min-h-[56px] items-center justify-center rounded-xl border-[1.5px] border-line px-6 text-[19px] font-semibold hover:border-ink">{c.hero.secondary}</a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[17px] text-ink-soft">
              {c.hero.checks.map((t) => <li key={t} className="flex items-center gap-2"><Check />{t}</li>)}
            </ul>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <WhatsAppDemo demo={c.demo} />
          </div>
        </section>

        {/* ─── Omnichat ─── */}
        <section className="bg-mist">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-20 md:px-8 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-4">
              <h2 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[52px]">{c.omni.title}</h2>
              <p className="text-[19px] leading-[1.55] text-ink-soft">{c.omni.sub}</p>
            </div>
            <div className="flex flex-col gap-4 lg:col-span-7 lg:col-start-6">
              <ul className="grid gap-4 sm:grid-cols-2">
                {c.omni.channels.map((ch, i) => (
                  <li key={ch.name} className="flex items-start gap-4 rounded-2xl bg-white p-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-field text-brand-600">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CHANNEL_ICONS[i]}</svg>
                    </span>
                    <span className="flex flex-col gap-1"><span className="text-[21px] font-semibold">{ch.name}</span><span className="text-[17px] text-ink-soft">{ch.desc}</span></span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center gap-3 rounded-2xl bg-ink px-6 py-5 text-[18px] text-white"><Check className="text-white" />{c.omni.inboxNote}</p>
            </div>
          </div>
        </section>

        {/* ─── Como funciona ─── */}
        <section id="como" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-24 md:px-8">
          <h2 className="mb-10 max-w-[900px] font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[56px]">{c.how.title}</h2>
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {c.how.steps.map((s) => (
              <li key={s.title} className="flex flex-col gap-3 border-t-[3px] border-ink pt-5">
                <span className="font-display text-[40px] font-extrabold text-brand-600">{s.time}</span>
                <span className="text-[22px] font-semibold">{s.title}</span>
                <span className="text-[18px] leading-[1.55] text-ink-soft">{s.desc}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Porque não a IA da Meta ─── */}
        <section id="porque" className="scroll-mt-24 bg-ink text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8">
            <div className="mb-12 flex max-w-[900px] flex-col gap-4">
              <h2 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[60px]">{c.vsMeta.title}</h2>
              <p className="text-[20px] leading-[1.55] text-[#C8D2E6]">{c.vsMeta.sub}</p>
            </div>
            <div className="overflow-x-auto rounded-2xl bg-white text-ink">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="w-[22%] px-6 py-5 text-[16px] font-semibold text-ink-mute"><span className="sr-only">{c.vsMeta.colTopic || '—'}</span></th>
                    <th scope="col" className="w-[42%] bg-field px-6 py-5"><span className="flex items-center gap-3 font-display text-[24px] font-extrabold"><Logo size={28} showText={false} />{c.vsMeta.colUs}</span></th>
                    <th scope="col" className="px-6 py-5 text-[20px] font-semibold text-ink-soft">{c.vsMeta.colThem}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.vsMeta.rows.map((r) => (
                    <tr key={r.topic} className="border-b border-line last:border-b-0">
                      <th scope="row" className="px-6 py-5 align-top text-[18px] font-semibold">{r.topic}</th>
                      <td className="bg-field px-6 py-5 align-top text-[18px] leading-[1.5]"><span className="flex gap-3"><Check />{r.us}</span></td>
                      <td className="px-6 py-5 align-top text-[18px] leading-[1.5] text-ink-soft"><span className="flex gap-3"><Cross />{r.them}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[15px] text-[#AEB9D1]">{c.vsMeta.footnote}</p>
          </div>
        </section>

        {/* ─── Diferenciais + passagem para humano ─── */}
        <section className="mx-auto max-w-[1280px] px-4 py-24 md:px-8">
          <h2 className="mb-10 font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[56px]">{c.diffs.title}</h2>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-[22px] bg-ink p-8 text-white md:p-10 lg:col-span-2 lg:row-span-2">
              <h3 className="font-display text-[32px] font-extrabold leading-[1.08] md:text-[40px]">{c.handoff.title}</h3>
              <p className="max-w-[640px] text-[19px] leading-[1.55] text-[#C8D2E6]">{c.handoff.desc}</p>
              <div className="mt-2 flex max-w-[540px] flex-col gap-1.5 rounded-2xl bg-white p-5 text-ink">
                <span className="text-[14px] font-semibold uppercase tracking-wide text-brand-600">{c.handoff.cardLabel}</span>
                <span className="text-[19px] font-semibold">{c.handoff.cardText}</span>
                <span className="text-[16px] text-ink-soft">{c.handoff.cardMeta}</span>
              </div>
              <p className="mt-auto flex items-center gap-3 pt-4 text-[17px] text-[#C8D2E6]"><Check className="text-white" />{c.handoff.copilot}</p>
            </div>
            {c.diffs.items.map((d) => (
              <div key={d.title} className="flex flex-col gap-3 rounded-[22px] bg-field p-8">
                <h3 className="text-[23px] font-semibold leading-tight">{d.title}</h3>
                <p className="text-[18px] leading-[1.55] text-ink-soft">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Anti-ban ─── */}
        <section className="border-y border-line bg-mist">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-20 md:px-8 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-5">
              <h2 className="font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[48px]">{c.antiBan.title}</h2>
              <p className="text-[19px] leading-[1.55] text-ink-soft">{c.antiBan.desc}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
              {c.antiBan.points.map((p) => (
                <li key={p.title} className="flex flex-col gap-2 rounded-2xl bg-white p-6">
                  <Check />
                  <span className="text-[20px] font-semibold">{p.title}</span>
                  <span className="text-[17px] leading-[1.5] text-ink-soft">{p.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── Setores ─── */}
        <section id="setores" className="mx-auto max-w-[1280px] scroll-mt-24 px-4 py-24 md:px-8">
          <div className="mb-10 flex max-w-[860px] flex-col gap-3">
            <h2 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[56px]">{c.sectors.title}</h2>
            <p className="text-[19px] text-ink-soft">{c.sectors.sub}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.sectors.items.map((s) => (
              <li key={s.slug}>
                <Link href={`/para/${s.slug}`} locale={loc} className="group flex h-full flex-col gap-3 rounded-2xl border-[1.5px] border-line p-7 hover:border-brand-600">
                  <span className="text-[22px] font-semibold">{s.title}</span>
                  <span className="text-[17px] leading-[1.5] text-ink-soft">{s.desc}</span>
                  <span className="mt-auto pt-3 text-[16px] font-semibold text-brand-600 group-hover:underline">{c.sectors.more}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Preços ─── */}
        <section id="precos" className="scroll-mt-24 bg-mist">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="flex max-w-[760px] flex-col gap-3">
                <h2 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] md:text-[56px]">{c.pricing.title}</h2>
                <p className="text-[19px] text-ink-soft">{c.pricing.sub}</p>
              </div>
              <div role="group" aria-label="Moeda" className="inline-flex self-start rounded-xl border border-line bg-white p-1 lg:self-auto">
                {(['EUR', 'BRL'] as Currency[]).map((cur) => (
                  <button key={cur} onClick={() => setCurrency(cur)} aria-pressed={currency === cur}
                    className={`min-h-[44px] rounded-lg px-4 text-[17px] font-semibold ${currency === cur ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}>
                    {cur === 'EUR' ? c.pricing.currencyEUR : c.pricing.currencyBRL}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PLAN_ORDER.map((id) => {
                const p = PLAN_PRICING[id][currency];
                const plan = c.pricing.plans[id];
                const highlight = id === 'starter';
                return (
                  <div key={id} className={`relative flex flex-col gap-5 rounded-[20px] bg-white p-7 ${highlight ? 'border-2 border-brand-600' : 'border-[1.5px] border-line'}`}>
                    {highlight && <span className="absolute -top-3.5 left-7 rounded-full bg-brand-600 px-3 py-1 text-[14px] font-semibold text-white">{c.pricing.popular}</span>}
                    <div className="flex flex-col gap-1">
                      <span className={`text-[18px] font-semibold ${highlight ? 'text-brand-600' : ''}`}>{id.charAt(0).toUpperCase() + id.slice(1)}</span>
                      <span className="font-display text-[48px] font-extrabold leading-none">
                        {p.price === 0 ? c.pricing.free : money(p.price, currency)}
                        {p.price > 0 && <span className="font-sans text-[18px] font-medium text-ink-soft">{c.pricing.month}</span>}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl bg-field p-4 text-[16px]">
                      <span><strong className="text-[20px]">≈ {num(estConversations(p.credits))}</strong> {c.pricing.conversations}{id === 'free' ? '' : c.pricing.month}</span>
                      <span className="text-ink-soft">{num(p.credits)} {id === 'free' ? c.pricing.creditsOnce : c.pricing.credits} · {c.pricing.agents(PLAN_PRICING[id].agents)}</span>
                    </div>
                    <ul className="flex flex-1 flex-col gap-2">
                      {plan.features.map((f) => <li key={f} className="flex gap-2 text-[16px] leading-snug"><Check />{f}</li>)}
                    </ul>
                    {id === 'enterprise' ? (
                      <a href={SALES_EMAIL} className="flex min-h-[48px] items-center justify-center rounded-xl border-[1.5px] border-ink text-[17px] font-semibold hover:bg-ink hover:text-white">{plan.cta}</a>
                    ) : (
                      <button onClick={() => openAuth('signup')} className={`min-h-[48px] rounded-xl text-[17px] font-semibold ${highlight ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border-[1.5px] border-ink hover:bg-ink hover:text-white'}`}>{plan.cta}</button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-[16px] text-ink-soft">{c.pricing.creditExplainer}</p>
            <div className="mt-10 flex flex-col gap-4">
              <h3 className="text-[22px] font-semibold">{c.pricing.addonsTitle}</h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {c.pricing.addons.map((a, i) => (
                  <li key={a.title} className="flex flex-col gap-1 rounded-xl bg-white p-5">
                    <span className="text-[18px] font-semibold">{a.title}</span>
                    <span className="text-[16px] text-ink-soft">{i === 0 ? `${a.desc} · ${money(TOP_UP.enterprise[currency], currency)}–${money(TOP_UP.starter[currency], currency)}` : a.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 text-[15px] leading-[1.5] text-ink-mute">{c.pricing.footnote}</p>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="mx-auto max-w-[900px] scroll-mt-24 px-4 py-24 md:px-8">
          <h2 className="mb-8 font-display text-[40px] font-extrabold tracking-[-0.03em] md:text-[52px]">{c.faq.title}</h2>
          <div className="divide-y divide-line border-y border-line">
            {c.faq.items.map((f, i) => (
              <div key={f.q}>
                <h3>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} aria-controls={`faq-${i}`}
                    className="flex min-h-[64px] w-full items-center justify-between gap-6 py-4 text-left text-[20px] font-semibold">
                    {f.q}
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`shrink-0 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </h3>
                <div id={`faq-${i}`} hidden={openFaq !== i} className="pb-6 text-[18px] leading-[1.6] text-ink-soft">{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA final ─── */}
        <section className="px-4 pb-24 md:px-8">
          <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-6 rounded-[28px] bg-brand-600 px-8 py-14 text-white md:flex-row md:items-center md:justify-between md:px-14">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[48px]">{c.cta.title}</h2>
              <p className="text-[19px] text-white/85">{c.cta.sub}</p>
            </div>
            <button onClick={() => openAuth('signup')} className="min-h-[56px] shrink-0 rounded-xl bg-white px-8 text-[19px] font-semibold text-ink hover:bg-field">{c.cta.button}</button>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8">
          <Logo size={32} inverted />
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-[16px] text-[#C8D2E6]">
            <Link href="/privacy-policy" className="hover:text-white">{c.footer.privacy}</Link>
            <Link href="/terms-of-service" className="hover:text-white">{c.footer.terms}</Link>
            <Link href="/data-deletion" className="hover:text-white">{c.footer.deletion}</Link>
            <a href="mailto:contact@solutions.shaklabs.tech" className="hover:text-white">contact@solutions.shaklabs.tech</a>
          </nav>
        </div>
        <div className="mx-auto max-w-[1280px] border-t border-white/10 px-4 py-6 text-[14px] text-[#AEB9D1] md:px-8">
          © {new Date().getFullYear()} Agentfy · Shaklabs · {c.footer.made}
        </div>
      </footer>
      </div>
      <SupportWidget />
    </>
  );
}
