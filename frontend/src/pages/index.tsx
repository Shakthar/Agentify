import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import Logo from '../components/Logo';
import SupportWidget from '../components/SupportWidget';
import api from '../utils/api';

type AuthTab = 'login' | 'signup';

// ─── Pricing plans (landingpage copy) ────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: 0,
    credits: '1.000',
    creditsNote: 'créditos únicos (não renovam)',
    agents: '1 agente',
    highlight: false,
    cta: 'Começar grátis',
    color: 'border-gray-200',
    features: ['1 número WhatsApp', 'Chat Web', 'Base de conhecimento', 'Skill Delivery básico', 'Modelos: Haiku / GPT-mini'],
  },
  {
    id: 'starter',
    label: 'Starter',
    price: 59,
    credits: '5.000',
    creditsNote: 'créditos/mês renováveis',
    agents: '1 agente',
    highlight: true,
    cta: 'Começar agora',
    color: 'border-brand-500',
    features: ['1 número WhatsApp', 'Chat Web', 'Skill Delivery + Upselling¹', 'Upload de ficheiros', 'Modelos: + Claude Sonnet', 'Suporte por email'],
  },
  {
    id: 'business',
    label: 'Business',
    price: 159,
    credits: '15.000',
    creditsNote: 'créditos/mês renováveis',
    agents: '3 agentes',
    highlight: false,
    cta: 'Escolher Business',
    color: 'border-orange-300',
    features: ['3 números WhatsApp', 'Skills: Delivery + Vendas + Pagamentos', 'Detecção de humor IA', 'API Access', 'Modelos: + GPT-4o + Gemini', 'Histórico 1 ano'],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 399,
    credits: '40.000',
    creditsNote: 'créditos/mês renováveis',
    agents: '10 agentes',
    highlight: false,
    cta: 'Falar com vendas',
    ctaHref: 'mailto:contact@solutions.shaklabs.tech',
    color: 'border-green-400',
    features: ['10 números WhatsApp', 'TODAS as Skills incluídas', 'Claude Opus (melhor IA)', 'White-label incluído', 'SLA 24h', 'Histórico ilimitado'],
  },
];

const FEATURES = [
  {
    icon: '🤖',
    title: 'Pronto em menos de 10 minutos',
    desc: 'O assistente de criação faz-te as perguntas certas e configura tudo por ti. Sem código, sem IT, sem reuniões. Na primeira tarde já estás a receber pedidos.',
  },
  {
    icon: '📱',
    title: 'O teu número de WhatsApp, não um genérico',
    desc: 'Conecta o teu número real em minutos. Os clientes falam com "Pizzaria Roma" — não com um bot anónimo. A taxa de abertura do WhatsApp é 5× superior ao email.',
  },
  {
    icon: '📚',
    title: 'Aprende o teu negócio, não um genérico',
    desc: 'Faz upload do teu menu, lista de preços, FAQs ou cola um link. Em segundos o agente sabe o que vendes, como vendes e como tratas os clientes.',
  },
  {
    icon: '⚡',
    title: 'Poupa até 60% nos custos de IA',
    desc: 'O auto-routing seleciona automaticamente o modelo mais económico para cada mensagem. Uma conversa que custaria €0.05 passa a custar €0.02 — sem configuração.',
  },
  {
    icon: '🔀',
    title: 'Nunca perde um cliente difícil',
    desc: 'Quando o cliente está frustrado ou o assunto é complexo, o agente avisa a tua equipa e passa a conversa com o contexto completo. Zero perda de informação.',
  },
  {
    icon: '🛡️',
    title: 'Dados na EU, conformidade RGPD',
    desc: 'Servidores em Portugal/EU, encriptação AES-256, exportação e eliminação de dados a pedido. Auditoria disponível. Ideal para negócios europeus com obrigações legais.',
  },
];

const FAQS = [
  {
    q: 'O que é um crédito?',
    a: 'Créditos são a unidade de consumo da plataforma. Cada mensagem trocada entre o cliente e o agente consome créditos — uma conversa simples usa ~5-10 créditos, um pedido completo com pagamento usa ~25-30 créditos. O auto-routing pode reduzir esse custo em até 60%.',
  },
  {
    q: 'O que acontece quando os créditos acabam?',
    a: 'O agente para de responder. Podes comprar créditos extras on-demand a qualquer momento ao preço do teu plano, ou fazer upgrade para um plano com mais créditos.',
  },
  {
    q: 'Posso acumular créditos não usados?',
    a: '🔜 Em breve: o addon Rollover vai permitir pagar 85% do valor dos créditos não usados para os transferir para o mês seguinte (validade de 2 meses). Por agora, os créditos não usados não transitam de mês — créditos do plano Free também não são renováveis.',
  },
  {
    q: '1 agente = 1 WhatsApp?',
    a: 'Exatamente. Cada agente está ligado a um número de WhatsApp dedicado. No entanto, um agente pode estar integrado com múltiplas plataformas em simultâneo (Shopify, iFood, POS, etc.).',
  },
  {
    q: 'Posso adicionar mais agentes sem mudar de plano?',
    a: 'Sim. No Starter podes adicionar até 2 agentes extra por €20/agente/mês (máx 3 total). No Business, até 7 extras por €15/agente/mês (máx 10 total). No Enterprise são ilimitados a €10/agente/mês.',
  },
  {
    q: 'Quanto tempo demora a criar um agente?',
    a: 'Com o assistente de criação IA, menos de 10 minutos. O assistente recolhe informações sobre o teu negócio, gera o system prompt e sugere as skills adequadas. Podes sempre ajustar depois.',
  },
  {
    q: 'Posso entrar com o Facebook em vez de criar password?',
    a: 'Sim. No ecrã de login/registo tens o botão "Continuar com Facebook" — cria conta ou entra automaticamente com o teu perfil do Facebook. Se já tiveres conta com email/password, também podes associar a tua conta do Facebook depois, na aba de Perfil (útil se o email do Facebook for diferente do email da tua conta).',
  },
  {
    q: 'Como ligo o meu WhatsApp Business ao agente?',
    a: 'Dentro do agente, na aba WhatsApp, clica em "Continuar com Facebook / Meta" — autentica com a tua conta Meta e o agente fica ligado ao teu número WhatsApp Business automaticamente, sem precisares de copiar tokens. Só falta confirmar o Phone Number ID e, se for pedido, introduzir o PIN de 6 dígitos para ativar o número. Também existe uma opção de configuração manual para quem prefere gerir o token diretamente na Meta for Developers.',
  },
  {
    q: 'Como ligo a minha conta do Instagram ao agente?',
    a: 'Dentro do agente, na aba Instagram, clica em "Continuar com Facebook" — abre-se um popup de autenticação e, depois de aceitares, o agente fica ligado à tua conta Instagram Business automaticamente, sem copiar tokens. É preciso que a conta Instagram seja do tipo Business/Criador e esteja ligada a uma Página do Facebook. Também há uma opção manual, para quem prefere configurar via Meta for Developers.',
  },
  {
    q: 'Posso definir um horário em que o agente não trabalha?',
    a: 'Sim. Na aba de cada canal (WhatsApp, Instagram e Telegram) existe um bloco "Horário de funcionamento" onde defines dias de semana e fins de semana com janelas diferentes (ex: só ativo das 9h às 18h) e, opcionalmente, uma mensagem automática para quando alguém escrever fora desse horário (ex: "Estamos fechados, respondemos às 9h 🙏"). Fora da janela definida, o agente não responde normalmente — fica em silêncio ou envia essa mensagem, consoante configures.',
  },
  {
    q: 'O meu número de WhatsApp corre o risco de ser banido?',
    a: 'Não. O Agentfy liga-se ao teu número através da API oficial da Meta para empresas (WhatsApp Cloud API) — nunca através de automações não-oficiais que simulam o WhatsApp Web e que são a causa mais comum de bloqueios. O número fica sempre registado em teu nome na Meta, e as mensagens proativas (iniciadas pelo agente) respeitam os limites diário/mensal que tu defines, para nunca gerar picos que pareçam spam.',
  },
];

export default function Home() {
  const router = useRouter();
  const { tenant, login, signup, loading, error, clearError, pendingTwoFactor, completeTwoFactorLogin, cancelTwoFactor, loginWithFacebookTicket } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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
    const { fbTicket, fbAuthError } = router.query as { fbTicket?: string; fbAuthError?: string };

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
      <Head>
        <title>Agentfy — Agentes de IA para Atendimento no WhatsApp</title>
        <meta name="description" content="Cria agentes de IA para atendimento ao cliente no WhatsApp em minutos. Sem código. Créditos renováveis. GDPR compliant." />
      </Head>

      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size={36} />
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">Preços</a>
            <a href="#faq" className="hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => openAuth('login')} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5">
              Entrar
            </button>
            <button onClick={() => openAuth('signup')} className="btn-primary text-sm px-4 py-2">
              Começar grátis →
            </button>
          </div>
        </div>
      </nav>

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
                      <p className="text-[11px] text-gray-400 text-center">
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

      <div className="pt-16">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pt-20 pb-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-xs font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-3 py-1 rounded-full mb-6">
              🇵🇹 Feito para Portugal e Brasil · GDPR Compliant
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
              O teu negócio perde vendas<br />
              <span className="text-brand-600 dark:text-brand-400">enquanto dormes.</span><br />
              <span className="text-2xl md:text-3xl font-semibold text-gray-600 dark:text-gray-300">O Agentfy resolve isso.</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Um agente de IA no teu WhatsApp que responde, processa pedidos e aceita pagamentos — 24 horas por dia, 7 dias por semana.
              Sem código. Pronto em menos de 10 minutos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => openAuth('signup')} className="btn-primary text-base px-8 py-3 shadow-lg hover:shadow-brand-200 dark:hover:shadow-brand-900 transition-shadow">
                Começar grátis — sem cartão →
              </button>
              <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors px-4 py-3">
                Ver preços ↓
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-4">1.000 créditos grátis para testar · Upgrade quando precisar</p>
          </div>

          {/* WhatsApp mockup */}
          <div className="max-w-sm mx-auto mt-14">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* WA header */}
              <div className="bg-green-600 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">🤖</div>
                <div>
                  <p className="text-white text-sm font-semibold">Agente Pizzaria Roma</p>
                  <p className="text-green-200 text-xs">Online • responde em segundos</p>
                </div>
              </div>
              {/* Messages */}
              <div className="p-4 space-y-3 bg-[#e5ddd5] dark:bg-gray-700 text-sm">
                {[
                  { from: 'user', text: 'Olá! Queria pedir uma margherita grande e uma coca-cola 🍕' },
                  { from: 'bot', text: 'Olá! Com certeza 😊\nMargherita Grande (€12.50) + Coca-Cola (€2.50)\nTotal: €15.00\n\nEnvio para a morada registada?\nPagamento: MB Way ou Dinheiro?' },
                  { from: 'user', text: 'MB Way sim! Para Rua das Flores 12, Lisboa' },
                  { from: 'bot', text: '✅ Pedido confirmado!\nTempo estimado: 35 min\nReferência MB Way enviada para o teu telemóvel 📱' },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line shadow-sm
                      ${m.from === 'user'
                        ? 'bg-green-100 dark:bg-green-900 text-gray-800 dark:text-gray-200 rounded-br-none'
                        : 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 text-center">Conversa real → ~25 créditos gastos</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Social Proof ─── */}
        <section className="py-10 px-4 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">
              Negócios que já automatizaram o atendimento com Agentfy
            </p>
            {/* Logos placeholder */}
            <div className="flex flex-wrap items-center justify-center gap-8 mb-10 opacity-60">
              {['Pizzaria Roma', 'Clínica Saúde+', 'Loja Moda PT', 'Auto Reparações SA', 'Academia Fit'].map(name => (
                <span key={name} className="text-sm font-bold text-gray-400 dark:text-gray-500 tracking-tight">{name}</span>
              ))}
            </div>
            {/* Testimonials */}
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  quote: 'Antes perdíamos 30% dos pedidos fora de horário. Agora o agente responde às 3h da manhã e o cliente fica satisfeito.',
                  author: 'Miguel S.',
                  role: 'Dono · Pizzaria Roma, Lisboa',
                },
                {
                  quote: 'Configurei em 8 minutos. Sem IT, sem contratos. O agente já tratou de mais de 400 conversas este mês.',
                  author: 'Ana P.',
                  role: 'Gestora · Loja Moda PT, Porto',
                },
                {
                  quote: 'O handoff automático para humanos é o que nos convenceu. Quando o cliente está irritado, o agente passa para a equipa com o contexto todo.',
                  author: 'Rui F.',
                  role: 'CEO · Clínica Saúde+, Braga',
                },
              ].map(t => (
                <div key={t.author} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">"{t.quote}"</p>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{t.author}</p>
                    <p className="text-[11px] text-gray-400">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Proteção do número de WhatsApp ─── */}
        <section className="py-14 px-4 bg-gradient-to-br from-green-50 via-white to-brand-50 dark:from-green-950/20 dark:via-gray-900 dark:to-gray-950 border-y border-green-100 dark:border-green-900/30">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-3 py-1 rounded-full mb-4">
              🛡️ O teu número está seguro
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
              Zero risco de ficares banido do WhatsApp
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Ao contrário de automações não-oficiais que simulam um telemóvel, o Agentfy liga-se ao teu número
              através da API oficial da Meta para empresas — a mesma que a Meta disponibiliza a grandes marcas.
              Não há truques nem simulação de app: é o canal aprovado, e o teu número fica protegido.
            </p>
            <div className="grid md:grid-cols-3 gap-5 text-left">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-green-100 dark:border-green-900/30 shadow-sm">
                <span className="text-2xl mb-2 block">✅</span>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">API oficial da Meta</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Usamos exclusivamente a WhatsApp Cloud API oficial — nunca automações não-oficiais que replicam
                  o WhatsApp Web e arriscam bloqueios.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-green-100 dark:border-green-900/30 shadow-sm">
                <span className="text-2xl mb-2 block">⏱️</span>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Limites de envio automáticos</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Nas mensagens iniciadas pelo agente (proativas), defines um limite diário e mensal — o Agentfy
                  respeita-os sempre, para nunca haver picos de envio que pareçam spam.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-green-100 dark:border-green-900/30 shadow-sm">
                <span className="text-2xl mb-2 block">🔒</span>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">O número continua teu</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  O número fica sempre registado em teu nome na Meta. Não guardamos credenciais paralelas nem
                  dependemos de sessões que possam expirar ou ser detetadas como automação.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Stats ─── */}
        <section className="bg-gray-900 dark:bg-gray-950 py-12 px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '< 10 min', label: 'Para criar um agente' },
              { value: '24/7', label: 'O agente nunca dorme' },
              { value: '–60%', label: 'Créditos poupados com auto-routing' },
              { value: '8 idiomas', label: 'Suportados nativamente' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold text-white">{s.value}</p>
                <p className="text-sm text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Tudo o que precisas para automatizar o atendimento</h2>
              <p className="text-gray-500 dark:text-gray-400">Sem contratos, sem integrações complexas, sem equipa de TI.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {FEATURES.map(f => (
                <div key={f.title} className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 hover:border-brand-200 dark:hover:border-brand-800 transition-colors">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section className="py-20 px-4 bg-brand-50 dark:bg-gray-950">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Como funciona?</h2>
              <p className="text-gray-500 dark:text-gray-400">3 passos para ter o teu agente ativo</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', icon: '💬', title: 'Configura com IA', desc: 'O assistente de criação faz-te perguntas sobre o teu negócio e gera tudo automaticamente — nome, personalidade, skills e base de conhecimento.' },
                { step: '02', icon: '📚', title: 'Treina o agente', desc: 'Faz upload dos teus PDFs, menus, listas de produtos ou cola um link do YouTube. O agente aprende o teu negócio em segundos.' },
                { step: '03', icon: '📱', title: 'Ativa o WhatsApp', desc: 'Conecta o teu número de WhatsApp e liga ao teu site. O agente começa a responder imediatamente.' },
              ].map(s => (
                <div key={s.step} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-600 text-white text-lg font-bold mb-4">{s.step}</div>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Preços simples baseados em créditos</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
                Pagas pelo que usas. Sem surpresas. Quanto mais alto o plano, mais barato fica cada crédito.
              </p>
            </div>

            {/* Credits explainer */}
            <div className="mb-10 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 max-w-2xl mx-auto">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 O que é um crédito?</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Uma conversa simples usa ~5-10 créditos. Um pedido completo com pagamento usa ~25-30 créditos.
                O auto-routing usa automaticamente o modelo mais barato para cada tipo de mensagem, poupando até 60%.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-5">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all
                    ${plan.highlight
                      ? 'border-brand-500 shadow-xl shadow-brand-100 dark:shadow-brand-900/20 bg-white dark:bg-gray-800'
                      : `${plan.color} bg-white dark:bg-gray-900`}`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      ⭐ Mais popular
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{plan.label}</p>
                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
                      {plan.price === 0 ? 'Grátis' : `€${plan.price}`}
                      {plan.price > 0 && <span className="text-sm font-normal text-gray-400">/mês</span>}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5 space-y-1">
                    <p>💳 <strong className="text-gray-700 dark:text-gray-200">{plan.credits}</strong> {plan.creditsNote}</p>
                    <p>🤖 <strong className="text-gray-700 dark:text-gray-200">{plan.agents}</strong></p>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {(plan as { ctaHref?: string }).ctaHref ? (
                    <a
                      href={(plan as { ctaHref?: string }).ctaHref}
                      className={`block w-full text-center text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors
                        bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200`}
                    >
                      {plan.cta} →
                    </a>
                  ) : (
                    <button
                      onClick={() => openAuth('signup')}
                      className={`w-full text-sm py-2.5 px-4 rounded-xl font-semibold transition-colors
                        ${plan.highlight
                          ? 'bg-brand-600 hover:bg-brand-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}`}
                    >
                      {plan.cta} →
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              ¹ Vendas/Upselling disponível como addon no Starter (€20/mês). Incluído no Business+.
              {' · '}Todos os planos incluem SSL, uptime 99.9% e backups diários.
            </p>

            {/* Addons row */}
            <div className="mt-10 p-5 rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10">
              <p className="text-sm font-bold text-orange-800 dark:text-orange-200 mb-4">➕ Addons disponíveis em qualquer plano pago</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: '⚡', name: 'Créditos extras', desc: 'Compra quando precisas, ao preço do teu plano' },
                  { icon: '🔄', name: 'Rollover', desc: '85% dos créditos não usados transferidos para o mês seguinte' },
                  { icon: '🤖', name: 'Mais agentes', desc: 'Starter +€20/ag · Business +€15/ag · Enterprise +€10/ag' },
                  { icon: '🎨', name: 'White-label', desc: 'Portal com a tua marca, sem branding Agentfy' },
                ].map(a => (
                  <div key={a.name} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-orange-100 dark:border-orange-900">
                    <span className="text-xl">{a.icon}</span>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">{a.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Use cases ─── */}
        <section className="py-16 px-4 bg-gray-50 dark:bg-gray-950">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">Para que tipo de negócios?</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: '🍕', type: 'Restaurantes & Delivery', cases: ['Pedidos via WhatsApp', 'Menu interativo', 'Confirmação de reservas', 'Pagamento por MB Way / PIX'] },
                { icon: '🛒', type: 'E-commerce & Lojas', cases: ['Suporte ao cliente 24/7', 'Estado do pedido', 'Devoluções e trocas', 'Upselling automático'] },
                { icon: '🏢', type: 'Serviços & B2B', cases: ['Agendamento de reuniões', 'Triagem de leads', 'Suporte técnico nível 1', 'Recolha de feedback'] },
              ].map(uc => (
                <div key={uc.type} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="text-3xl mb-2">{uc.icon}</div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{uc.type}</h3>
                  <ul className="space-y-1.5">
                    {uc.cases.map(c => (
                      <li key={c} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <span className="text-brand-500">·</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">Perguntas frequentes</h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{faq.q}</span>
                    <span className={`text-gray-400 ml-4 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 pt-1 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA Bottom ─── */}
        <section className="py-20 px-4 bg-gradient-to-br from-brand-600 to-brand-700 dark:from-brand-800 dark:to-gray-900">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Pronto para começar?</h2>
            <p className="text-brand-100 mb-8">
              Cria a tua conta grátis hoje. 1.000 créditos incluídos para testares sem compromisso.
            </p>
            <button onClick={() => openAuth('signup')} className="bg-white text-brand-700 hover:bg-brand-50 text-sm font-bold px-8 py-3.5 rounded-xl shadow-lg transition-colors">
              Criar conta grátis — sem cartão →
            </button>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="bg-gray-900 dark:bg-gray-950 py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <Logo size={32} />
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
                <Link href="/privacy-policy" className="hover:text-gray-200 transition-colors">Política de Privacidade</Link>
                <Link href="/terms-of-service" className="hover:text-gray-200 transition-colors">Termos de Serviço</Link>
                <Link href="/data-deletion" className="hover:text-gray-200 transition-colors">Eliminação de Dados</Link>
                <a href="mailto:contact@solutions.shaklabs.tech" className="hover:text-gray-200 transition-colors">contact@solutions.shaklabs.tech</a>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-600">
              © {new Date().getFullYear()} Agentfy by Shaklabs.tech · Feito em Portugal 🇵🇹 · GDPR Compliant
            </div>
          </div>
        </footer>
      </div>
      {/* ─── Support Widget ─── */}
      <SupportWidget />
    </>
  );
}
