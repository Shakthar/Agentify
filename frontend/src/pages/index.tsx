import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import Logo from '../components/Logo';
import { LandingStyles, LandingHeader, LandingFooter, useReveal } from '../components/landing/LandingChrome';
import { InboxFragment, DashboardFragment, KitchenFragment, HandoffFragment } from '../components/landing/ProductFragments';
import { EXTRA } from '../components/landing/extra';
import { FAQ_PAGE } from '../components/landing/faqData';
import SupportWidget from '../components/SupportWidget';
import WhatsAppDemo from '../components/landing/WhatsAppDemo';
import LandingSeo from '../components/landing/LandingSeo';
import { LANDING_COPY, landingLocale } from '../components/landing/copy';
import api from '../utils/api';
import { PLAN_PRICING, TOP_UP, estConversations, money, num, defaultCurrency, type Currency, type PlanId } from '../utils/pricing';

type AuthTab = 'login' | 'signup';

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'business', 'enterprise'];
const SALES_EMAIL = 'mailto:contact@solutions.shaklabs.tech';
const H2 = 'clamp(32px, 5.2vw, 76px)';
const MARQUEE = ['WhatsApp', 'Instagram', 'Telegram', 'MB WAY', 'Multibanco', 'Google Calendar', 'Claude', 'GPT'];

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
  const [ctaName, setCtaName] = useState('');
  const loc = landingLocale(router.locale);
  const c = LANDING_COPY[loc];
  const x = EXTRA[loc];
  useReveal();
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
    const { fbTicket, fbAuthError, signup: signupParam, login: loginParam } = router.query as { fbTicket?: string; fbAuthError?: string; signup?: string; login?: string };

    // Links "Criar conta" das páginas de setor (/para/[slug]) chegam com ?signup=1.
    if (signupParam && !fbTicket && !fbAuthError) {
      setTab('signup');
      setAuthOpen(true);
      router.replace(router.pathname, undefined, { shallow: true });
      return;
    }

    if (loginParam && !fbTicket && !fbAuthError) {
      setTab('login');
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

  return (
    <>
      <LandingSeo copy={c} locale={loc} />
      <LandingStyles />

      <div id="top" className="lp min-h-screen font-sans">
      <LandingHeader locale={loc} path="/" home onLogin={() => openAuth('login')} onSignup={() => openAuth('signup')} />

      {/* ─── Auth Modal / Panel ─── */}
      {(authOpen || pendingTwoFactor) && (
        <div role="dialog" aria-modal="true" aria-label="Agentfy" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div ref={authRef} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Logo size={32} />
                <button
                  onClick={() => { setAuthOpen(false); if (pendingTwoFactor) cancelTwoFactor(); }}
                  className="text-ink-soft hover:text-ink text-3xl leading-none px-2"
                >×</button>
              </div>

              {pendingTwoFactor ? (
                <>
                  <div className="text-center mb-6">
                    
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Código de autenticação</h2>
                    <p className="text-sm text-ink-soft mt-1">Abre o teu Google Authenticator e introduz o código de 6 dígitos.</p>
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
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400' : 'text-ink-soft hover:text-ink'}`}>
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
                    <span className="text-sm text-ink-soft">ou com email</span>
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
                      <p className="text-[15px] text-ink-soft text-center">
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
        {/* ─── Hero: dois campos de cor, título no campo claro, demo no campo cobalto ─── */}
        <div data-tone="field" className="bg-field">
          <div className="mx-auto max-w-[1280px] px-4 pb-14 pt-10 md:px-8 md:pb-20 md:pt-16 lg:pt-20">
            <h1 className="lp-r font-display font-extrabold leading-[0.94] tracking-[-0.045em] text-ink" style={{ fontSize: 'clamp(31px, 7.4vw, 112px)' }}>
              {c.hero.title.split('. ').map((part, i, arr) => (
                <span key={part} className="block">{part}{i < arr.length - 1 ? '.' : ''}</span>
              ))}
            </h1>
          </div>
        </div>
        <section data-tone="brand" aria-label={c.hero.title} className="bg-brand-600 text-white">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 pb-20 pt-12 md:px-8 md:pb-28 md:pt-16 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-8 lg:col-span-5">
              <p className="lp-r max-w-[560px] text-[20px] leading-[1.55] text-white md:text-[22px]" style={{ ['--d' as string]: '100ms' }}>{c.hero.sub}</p>
              <div className="lp-r flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={{ ['--d' as string]: '200ms' }}>
                <button onClick={() => openAuth('signup')} className="lp-press min-h-[56px] whitespace-nowrap rounded-xl bg-white px-7 text-[19px] font-semibold text-ink hover:bg-field">{c.hero.cta}</button>
                <a href="#porque" className="lp-press flex min-h-[56px] items-center justify-center rounded-xl bg-white/15 px-6 text-[18px] font-semibold text-white hover:bg-white/25 sm:whitespace-nowrap">{c.hero.secondary}</a>
              </div>
              <ul className="lp-r flex flex-col gap-3 text-[17px] text-white" style={{ ['--d' as string]: '300ms' }}>
                {c.hero.checks.map((t) => <li key={t} className="lp-tick lp-tick-w">{t}</li>)}
              </ul>
            </div>
            <div className="lp-r lp-r-s lg:col-span-6 lg:col-start-7" style={{ ['--d' as string]: '200ms' }}>
              <WhatsAppDemo demo={c.demo} />
            </div>
          </div>
        </section>

        {/* ─── Faixa: integrações reais ─── */}
        <section aria-label={x.marqueeLabel} data-tone="dark" className="bg-ink py-9 text-white">
          <p className="sr-only">{x.marqueeLabel}</p>
          <ul aria-hidden="true" className="mx-auto flex max-w-[1280px] flex-wrap gap-x-6 gap-y-2 px-4 font-display text-[30px] font-extrabold tracking-[-0.03em] md:hidden">
            {MARQUEE.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <div className="mx-auto hidden max-w-[1280px] overflow-hidden px-4 md:block md:px-8">
          <div aria-hidden="true" className="lp-marq-track font-display font-extrabold tracking-[-0.03em]" style={{ fontSize: 'clamp(34px, 5.4vw, 80px)' }}>
            {[0, 1].map((k) => (
              <ul key={k} className="flex shrink-0 items-center">
                {MARQUEE.map((n) => (
                  <li key={n} className="flex items-center whitespace-nowrap">
                    <span className="px-[0.45em]">{n}</span>
                    <span className="h-[0.28em] w-[0.28em] rounded-full bg-[#7C95F0]" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
          </div>
        </section>

        {/* ─── Omnichat: um agente, todos os canais + caixa de entrada ─── */}
        <section data-tone="light" className="bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
            <h2 className="lp-r mb-14 max-w-[1100px] font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.omni.title}</h2>
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
              <div className="flex flex-col gap-8 lg:col-span-6">
                <p className="lp-r max-w-[560px] text-[20px] leading-[1.55] text-ink-soft" style={{ ['--d' as string]: '80ms' }}>{c.omni.sub}</p>
                <ul className="flex flex-col">
                  {c.omni.channels.map((ch, i) => (
                    <li key={ch.name} className="lp-r flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6" style={{ ['--d' as string]: `${120 + i * 80}ms` }}>
                      <span className="font-display text-[34px] font-extrabold leading-none tracking-[-0.03em] text-brand-600 sm:w-[260px] sm:shrink-0 md:text-[40px]">{ch.name}</span>
                      <span className="text-[18px] text-ink-soft">{ch.desc}</span>
                    </li>
                  ))}
                </ul>
                <p className="lp-r flex items-start gap-3 rounded-2xl bg-field px-6 py-5 text-[18px] leading-[1.5] text-ink" style={{ ['--d' as string]: '300ms' }}><Check className="mt-1 text-brand-600" />{c.omni.inboxNote}</p>
              </div>
              <div className="lp-r lp-r-s flex items-center rounded-[28px] bg-field p-5 md:p-10 lg:col-span-6" style={{ ['--d' as string]: '160ms' }}>
                <div className="lp-float w-full"><InboxFragment x={x} /></div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Como funciona: quatro campos de cor, o mesmo caminho ─── */}
        <section id="como" data-tone="light" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-24 md:px-8 md:pt-32">
            <h2 className="lp-r max-w-[1000px] font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.how.title}</h2>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4">
            {c.how.steps.map((s, i) => {
              const tones = [
                { bg: 'bg-field', fg: 'text-ink', sub: 'text-ink-soft', num: 'text-brand-600', tone: 'field' },
                { bg: 'bg-brand-600', fg: 'text-white', sub: 'text-white', num: 'text-white', tone: 'brand' },
                { bg: 'bg-ink', fg: 'text-white', sub: 'text-[#D6DDEC]', num: 'text-[#9FB4F5]', tone: 'dark' },
                { bg: 'bg-brand-100', fg: 'text-ink', sub: 'text-ink-soft', num: 'text-brand-700', tone: 'field' },
              ][i % 4];
              return (
                <li key={s.title} data-tone={tones.tone} className={`${tones.bg} ${tones.fg} lp-r flex min-h-[420px] flex-col justify-between gap-16 p-8 md:p-10 lg:min-h-[520px]`} style={{ ['--d' as string]: `${i * 100}ms` }}>
                  <span className={`font-display text-[72px] font-extrabold leading-none tracking-[-0.05em] md:text-[88px] ${tones.num}`}>{s.time}</span>
                  <span className="flex flex-col gap-3">
                    <span className="font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] md:min-h-[68px] md:text-[32px]">{s.title}</span>
                    <span className={`text-[18px] leading-[1.55] ${tones.sub}`}>{s.desc}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ─── Porque não a IA da Meta ─── */}
        <section id="porque" data-tone="dark" className="scroll-mt-20 bg-ink text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
            <div className="mb-14 flex max-w-[980px] flex-col gap-6">
              <h2 className="lp-r font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.vsMeta.title}</h2>
              <p className="lp-r max-w-[760px] text-[20px] leading-[1.55] text-[#D6DDEC]" style={{ ['--d' as string]: '80ms' }}>{c.vsMeta.sub}</p>
            </div>
            <ul className="flex flex-col gap-3 md:hidden">
              {c.vsMeta.rows.map((r) => (
                <li key={r.topic} className="flex flex-col gap-3 rounded-2xl bg-white p-5 text-ink">
                  <h3 className="text-[19px] font-semibold">{r.topic}</h3>
                  <p className="flex gap-3 rounded-xl bg-field p-3 text-[17px] leading-[1.45]"><Check /><span><strong className="block text-[15px] text-brand-700">{c.vsMeta.colUs}</strong>{r.us}</span></p>
                  <p className="flex gap-3 px-3 text-[17px] leading-[1.45] text-ink-soft"><Cross /><span><strong className="block text-[15px]">{c.vsMeta.colThem}</strong>{r.them}</span></p>
                </li>
              ))}
            </ul>
            <div className="lp-r hidden overflow-x-auto rounded-2xl bg-white text-ink md:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">{c.vsMeta.title}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-[22%] px-6 py-5"><span className="sr-only">{c.vsMeta.colTopic || '—'}</span></th>
                    <th scope="col" className="w-[42%] bg-brand-600 px-6 py-5 text-white"><span className="flex items-center gap-3 font-display text-[24px] font-extrabold"><Logo size={28} showText={false} inverted />{c.vsMeta.colUs}</span></th>
                    <th scope="col" className="px-6 py-5 text-[20px] font-semibold text-ink-soft">{c.vsMeta.colThem}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.vsMeta.rows.map((r) => (
                    <tr key={r.topic} className="border-t border-line">
                      <th scope="row" className="px-6 py-5 align-top text-[18px] font-semibold">{r.topic}</th>
                      <td className="bg-field px-6 py-5 align-top text-[18px] leading-[1.5]"><span className="lp-tick block">{r.us}</span></td>
                      <td className="px-6 py-5 align-top text-[18px] leading-[1.5] text-ink-soft"><span className="lp-tick lp-dash block">{r.them}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5 text-[15px] text-[#D6DDEC]">{c.vsMeta.footnote}</p>
          </div>
        </section>

        {/* ─── Diferenciais + painel + passagem para humano ─── */}
        <section data-tone="field" className="bg-field">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
            <h2 className="lp-r mb-14 max-w-[1000px] font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.diffs.title}</h2>
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="lp-r flex flex-col gap-8 rounded-[28px] bg-ink p-8 text-white md:p-12 lg:col-span-7">
                <p className="font-display text-[24px] font-extrabold leading-[1.15] tracking-[-0.02em] md:text-[30px] lg:text-[34px]">{c.handoff.title}</p>
                <p className="max-w-[640px] text-[19px] leading-[1.55] text-[#D6DDEC]">{c.handoff.desc}</p>
                <HandoffFragment label={c.handoff.cardLabel} text={c.handoff.cardText} meta={c.handoff.cardMeta} />
                <p className="mt-auto flex items-start gap-3 text-[18px] leading-[1.5] text-white"><Check className="mt-1 text-white" />{c.handoff.copilot}</p>
              </div>
              <div className="lp-r lp-r-s lg:col-span-5" style={{ ['--d' as string]: '120ms' }}>
                <DashboardFragment x={x} />
              </div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-12">
              <div className="lp-r lg:col-span-5 [&>*]:h-full">
                <KitchenFragment x={x} />
              </div>
              <ul className="grid gap-x-10 gap-y-10 rounded-[28px] bg-white p-8 sm:grid-cols-2 md:p-12 lg:col-span-7">
                {c.diffs.items.map((d, i) => (
                  <li key={d.title} className="lp-r flex flex-col gap-3" style={{ ['--d' as string]: `${(i % 2) * 90}ms` }}>
                    <h3 className="font-display text-[23px] font-extrabold leading-[1.1] tracking-[-0.02em]">{d.title}</h3>
                    <p className="text-[17px] leading-[1.55] text-ink-soft">{d.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Anti-ban ─── */}
        <section data-tone="light" className="bg-white">
          <div className="mx-auto max-w-[1280px] px-4 pb-24 md:px-8 md:pb-32">
            <h2 className="lp-r mb-12 max-w-[1100px] font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.antiBan.title}</h2>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
              <p className="lp-r text-[22px] leading-[1.5] text-ink-soft lg:col-span-4" style={{ ['--d' as string]: '80ms' }}>{c.antiBan.desc}</p>
              <ul className="flex flex-col gap-4 lg:col-span-7 lg:col-start-6">
                {c.antiBan.points.map((p, i) => (
                  <li key={p.title} className={`lp-r flex flex-col gap-3 rounded-[24px] p-8 md:p-10 ${i === 0 ? 'bg-brand-600 text-white' : i === 1 ? 'bg-field text-ink' : 'bg-ink text-white'}`} style={{ ['--d' as string]: `${i * 100}ms` }}>
                    <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.02em] md:text-[34px]">{p.title}</span>
                    <span className={`text-[18px] leading-[1.55] ${i === 1 ? 'text-ink-soft' : 'text-white'}`}>{p.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div data-tone="field" aria-hidden="true" className="h-[140px] overflow-hidden bg-field md:h-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/azulejo-band.jpg" alt="" width={2400} height={480} loading="lazy" className="h-full w-full object-cover" />
        </div>

        {/* ─── Setores ─── */}
        <section id="setores" data-tone="light" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 pb-24 md:px-8 md:pb-32">
            <div className="mb-12 flex max-w-[900px] flex-col gap-6">
              <h2 className="lp-r font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.sectors.title}</h2>
              <p className="lp-r text-[20px] leading-[1.55] text-ink-soft" style={{ ['--d' as string]: '80ms' }}>{c.sectors.sub}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.sectors.items.map((s, i) => {
                const t = [
                  'bg-brand-600 text-white', 'bg-ink text-white', 'bg-field text-ink', 'bg-brand-100 text-ink',
                ][i % 4];
                const sub = i < 2 ? 'text-white' : 'text-ink-soft';
                return (
                  <li key={s.slug} className="lp-r" style={{ ['--d' as string]: `${i * 90}ms` }}>
                    <Link href={`/para/${s.slug}`} locale={loc} className={`lp-lift group flex h-full min-h-[260px] flex-col justify-between gap-10 rounded-[24px] p-7 ${t}`}>
                      <span className="flex flex-col gap-3">
                        <span className="font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em]">{s.title}</span>
                        <span className={`text-[17px] leading-[1.5] ${sub}`}>{s.desc}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[17px] font-semibold underline-offset-4 group-hover:underline">{c.sectors.more}<span className="lp-arrow" aria-hidden="true">→</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ─── Preços ─── */}
        <section id="precos" data-tone="field" className="scroll-mt-20 bg-field">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
            <div className="mb-12 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="flex max-w-[860px] flex-col gap-6">
                <h2 className="lp-r font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.pricing.title}</h2>
                <p className="lp-r text-[20px] leading-[1.55] text-ink-soft" style={{ ['--d' as string]: '80ms' }}>{c.pricing.sub}</p>
              </div>
              <div role="group" aria-label="Moeda" className="inline-flex self-start rounded-xl bg-white p-1 lg:self-auto">
                {(['EUR', 'BRL'] as Currency[]).map((cur) => (
                  <button key={cur} onClick={() => setCurrency(cur)} aria-pressed={currency === cur}
                    className={`lp-press min-h-[44px] rounded-lg px-4 text-[17px] font-semibold ${currency === cur ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}>
                    {cur === 'EUR' ? c.pricing.currencyEUR : c.pricing.currencyBRL}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PLAN_ORDER.map((id, idx) => {
                const p = PLAN_PRICING[id][currency];
                const plan = c.pricing.plans[id];
                const dark = id === 'starter' || id === 'enterprise';
                const skin = id === 'starter' ? 'bg-brand-600 text-white' : id === 'enterprise' ? 'bg-ink text-white' : 'bg-white text-ink';
                const soft = dark ? 'text-white' : 'text-ink-soft';
                const name = id.charAt(0).toUpperCase() + id.slice(1);
                return (
                  <div key={id} className={`lp-r flex flex-col gap-6 rounded-[24px] p-7 md:p-8 ${skin}`} style={{ ['--d' as string]: `${idx * 80}ms` }}>
                    <div className="flex flex-col gap-2">
                      <span className="font-display text-[56px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
                        {money(p.price, currency)}
                        {p.price > 0 && <span className={`font-sans text-[18px] font-medium tracking-normal ${soft}`}>{c.pricing.month}</span>}
                      </span>
                      <div className="flex flex-wrap items-center gap-3"><h3 className="text-[22px] font-semibold">{name}</h3>{id === 'starter' && <span className="rounded-md bg-white px-2 py-0.5 text-[14px] font-semibold text-brand-700">{c.pricing.popular}</span>}</div>
                    </div>
                    <div className={`flex flex-col gap-1 rounded-xl p-4 text-[16px] ${dark ? 'bg-white/15' : 'bg-field'}`}>
                      <span><strong className="text-[20px]">≈ {num(estConversations(p.credits))}</strong> {c.pricing.conversations}{id === 'free' ? '' : c.pricing.month}</span>
                      <span className={soft}>{num(p.credits)} {id === 'free' ? c.pricing.creditsOnce : c.pricing.credits} · {c.pricing.agents(PLAN_PRICING[id].agents)}</span>
                    </div>
                    <ul className="flex flex-1 flex-col gap-2.5">
                      {plan.features.map((f) => <li key={f} className={`lp-tick text-[16px] leading-snug ${dark ? 'lp-tick-w' : ''}`}>{f}</li>)}
                    </ul>
                    {id === 'enterprise' ? (
                      <a href={SALES_EMAIL} className="lp-press flex min-h-[48px] items-center justify-center rounded-xl bg-white text-[17px] font-semibold text-ink hover:bg-field">{plan.cta}</a>
                    ) : (
                      <button onClick={() => openAuth('signup')} className={`lp-press min-h-[48px] rounded-xl text-[17px] font-semibold ${id === 'starter' ? 'bg-white text-ink hover:bg-field' : 'bg-ink text-white hover:bg-brand-700'}`}>{plan.cta}</button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="lp-r mt-8 max-w-[860px] text-[17px] leading-[1.55] text-ink-soft">{c.pricing.creditExplainer}</p>
            <div className="mt-12 flex flex-col gap-5">
              <h3 className="lp-r font-display text-[28px] font-extrabold tracking-[-0.02em]">{c.pricing.addonsTitle}</h3>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {c.pricing.addons.map((a, i) => (
                  <li key={a.title} className="lp-r flex flex-col gap-1 py-2" style={{ ['--d' as string]: `${i * 70}ms` }}>
                    <span className="text-[19px] font-semibold">{a.title}</span>
                    <span className="text-[16px] text-ink-soft">{i === 0 ? `${a.desc} · ${money(TOP_UP.enterprise[currency], currency)}–${money(TOP_UP.starter[currency], currency)}` : a.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-8 max-w-[900px] text-[15px] leading-[1.55] text-ink-soft">{c.pricing.footnote}</p>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" data-tone="light" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 pb-24 md:px-8 md:pb-32">
            <h2 className="lp-r mb-12 max-w-[1100px] font-display font-extrabold leading-[1] tracking-[-0.04em]" style={{ fontSize: H2 }}>{c.faq.title}</h2>
            <div className="flex flex-col">
              {c.faq.items.map((f, i) => (
                <details key={f.q} className={`group ${i % 2 === 0 ? 'bg-mist' : 'bg-white'} rounded-2xl px-6 md:px-8`}>
                  <summary className="flex min-h-[72px] items-center justify-between gap-6 py-4">
                    <h3 className="text-[19px] font-semibold leading-snug md:text-[22px]">{f.q}</h3>
                    <span className="lp-plus flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </summary>
                  <p className="max-w-[66ch] pb-7 text-[18px] leading-[1.6] text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
            <Link href="/faq" locale={loc} className="lp-press group mt-8 inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-ink px-6 text-[18px] font-semibold text-white hover:bg-brand-700">{x.faqAll}<span className="lp-arrow" aria-hidden="true">→</span></Link>
          </div>
        </section>

        {/* ─── CTA final: o primeiro passo, já aberto ─── */}
        <section data-tone="brand" className="bg-brand-600 text-white">
          <div className="mx-auto max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
            <h2 className="lp-r mb-14 max-w-[1200px] font-display font-extrabold leading-[0.98] tracking-[-0.045em]" style={{ fontSize: 'clamp(32px, 6.2vw, 92px)' }}>{c.cta.title}</h2>
            <div className="grid items-end gap-10 lg:grid-cols-12 lg:gap-8">
              <p className="lp-r max-w-[520px] text-[22px] leading-[1.5] text-white lg:col-span-6" style={{ ['--d' as string]: '80ms' }}>{c.cta.sub}</p>
              <form
                onSubmit={(e) => { e.preventDefault(); setCompany(ctaName.trim()); openAuth('signup'); }}
                className="lp-r lp-r-s flex min-w-0 flex-col gap-4 rounded-[24px] bg-white p-7 text-ink md:p-8 lg:col-span-5 lg:col-start-8"
                style={{ ['--d' as string]: '140ms' }}
              >
                <label htmlFor="cta-name" className="text-[17px] font-semibold">{x.cta.label}</label>
                <input id="cta-name" value={ctaName} onChange={(e) => setCtaName(e.target.value)} placeholder={x.cta.placeholder} autoComplete="organization"
                  className="min-h-[52px] w-full min-w-0 rounded-xl border-[1.5px] border-line bg-white px-4 text-[18px] text-ink placeholder:text-ink-mute focus:border-brand-600 focus:outline-none" />
                <button type="submit" className="lp-press min-h-[56px] rounded-xl bg-brand-600 px-6 text-[19px] font-semibold text-white hover:bg-brand-700">{c.cta.button}</button>
                <p className="text-[15px] text-ink-soft">{x.cta.hint}</p>
              </form>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter locale={loc} />
      </div>
      <SupportWidget />
    </>
  );
}
