import { useEffect, useState } from 'react';
import Head from 'next/head';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, PageHeader, Panel, Pill, Tabs, cx } from '../../components/app/ui';
import { UsageBar, fmt, isoDate } from '../../components/app/billingParts';
import { useAuth } from '../../hooks/useAuth';
import { Plan, PLAN_LABELS } from '../../types';
import api from '../../utils/api';
import {
  PLAN_PRICING, TOP_UP, CREDITS_PER_CONVERSATION, estConversations, addonPrice, money, num, pricePer1k, defaultCurrency,
  type Currency, type PlanId,
} from '../../utils/pricing';

// ─── Planos ───────────────────────────────────────────────────────────────────
const PLAN_META = [
  { id: 'free',       label: 'Free',       renewable: false, highlight: false, badge: null as string | null },
  { id: 'starter',    label: 'Starter',    renewable: true,  highlight: true,  badge: 'Mais popular' },
  { id: 'business',   label: 'Business',   renewable: true,  highlight: false, badge: 'Para crescer' },
  { id: 'enterprise', label: 'Enterprise', renewable: true,  highlight: false, badge: 'Grande operação' },
] as const;

function plansFor(cur: Currency) {
  return PLAN_META.map(m => {
    const p = PLAN_PRICING[m.id];
    const { price, credits } = p[cur];
    return {
      ...m, price, credits, agents: p.agents, whatsapp: p.agents,
      creditsLabel: m.renewable ? `${num(credits)} / mês` : `${num(credits)} (única vez)`,
      conversations: estConversations(credits),
    };
  });
}

// ─── Skills catalog ───────────────────────────────────────────────────────────
type SkillAvail = 'included' | 'addon' | 'unavailable';

interface SkillDef {
  id: string;
  name: string;
  icon: string;
  category: 'base' | 'automation' | 'revenue' | 'analytics' | 'custom';
  desc: string;
  detail: string;
  plans: Record<'free' | 'starter' | 'business' | 'enterprise', SkillAvail>;
  addonPrice: Partial<Record<string, number>>;       // mensalidade € por plano
  creditsPerTx?: Partial<Record<string, number>>;    // créditos por transação (pagamentos)
}

const SKILLS: SkillDef[] = [
  // ── Base (incluídas em todos os planos) ──────────────────────────────
  {
    id: 'handoff',
    name: 'Handoff para Humano',
    icon: '🔀',
    category: 'base',
    desc: 'Transfere a conversa para um humano quando necessário',
    detail: 'Detecta quando o cliente precisa de atenção humana e faz a transferência automática com o contexto completo da conversa preservado.',
    plans: { free: 'included', starter: 'included', business: 'included', enterprise: 'included' },
    addonPrice: {},
  },
  {
    id: 'data_collect',
    name: 'Recolha de Dados',
    icon: '📋',
    category: 'base',
    desc: 'Formulários conversacionais para recolher informação do cliente',
    detail: 'O agente guia o cliente por um fluxo de perguntas para recolher nome, morada, preferências ou qualquer outro dado estruturado.',
    plans: { free: 'included', starter: 'included', business: 'included', enterprise: 'included' },
    addonPrice: {},
  },
  // ── Automation ──────────────────────────────────────────────────────
  {
    id: 'file_upload',
    name: 'Upload de Ficheiros',
    icon: '📁',
    category: 'automation',
    desc: 'O cliente pode enviar documentos, imagens e PDFs ao agente',
    detail: 'Permite ao cliente enviar ficheiros durante a conversa. O agente processa e armazena em segurança. Útil para reclamações, comprovativos e contratos.',
    plans: { free: 'addon', starter: 'included', business: 'included', enterprise: 'included' },
    addonPrice: { free: 8 },
  },
  {
    id: 'scheduling',
    name: 'Agendamento',
    icon: '📅',
    category: 'automation',
    desc: 'Agenda consultas, reuniões ou serviços diretamente na conversa',
    detail: 'O agente verifica disponibilidade, propõe horários e confirma marcações de consultas, reuniões, reservas ou serviços — sem sair do WhatsApp ou do Chat Web.',
    plans: { free: 'unavailable', starter: 'addon', business: 'included', enterprise: 'included' },
    addonPrice: { starter: 7 },
  },
  {
    id: 'humor',
    name: 'Detecção de Humor',
    icon: '😊',
    category: 'automation',
    desc: 'Deteta frustração e ativa handoff automático para humano',
    detail: 'IA analisa o sentimento de cada mensagem em tempo real. Quando deteta irritação, urgência ou frustração elevada, avisa a equipa e passa a conversa para um humano com contexto.',
    plans: { free: 'unavailable', starter: 'addon', business: 'included', enterprise: 'included' },
    addonPrice: { starter: 9 },
  },
  // ── Revenue ─────────────────────────────────────────────────────────
  {
    id: 'vendas',
    name: 'Vendas + Delivery/Pedidos + KDS',
    icon: '🏷️',
    category: 'revenue',
    desc: 'Pedidos e delivery, upselling inteligente, cliente recorrente e KDS',
    detail: 'Addon de vendas com boas práticas integradas + Delivery/Pedidos e sistema KDS incluídos:\n\n• Delivery / Pedidos — o agente recolhe os itens, a morada de entrega e confirma o pedido\n• Trata sempre o cliente pelo nome — usa o histórico para personalizar cada conversa\n• Clientes recorrentes: analisa o histórico de pedidos e sugere automaticamente o que o cliente costuma pedir ("Olá João! Queres o teu habitual — pizza margherita + sumo?")\n• Upselling natural — sugere itens adicionais no momento certo, de forma amigável e assertiva, sem ser invasivo\n• Cross-sell contextual — recomenda produtos complementares com base no pedido atual\n• Histórico de preferências — aprende com as conversas anteriores para afinar sugestões ao longo do tempo\n• Inclui sistema de Pedidos/KDS: painel de cozinha em tempo real, gestão de estados e notificações',
    plans: { free: 'unavailable', starter: 'addon', business: 'addon', enterprise: 'addon' },
    addonPrice: { starter: 25, business: 20, enterprise: 15 },
  },
  {
    id: 'payments',
    name: 'Pagamentos',
    icon: '💳',
    category: 'revenue',
    desc: 'MB Way, PIX, Multibanco e Cartão diretamente na conversa',
    detail: 'Processamento de pagamentos integrado na conversa do WhatsApp ou Chat Web. Inclui mensalidade de acesso + consumo de créditos por transação processada.',
    plans: { free: 'unavailable', starter: 'addon', business: 'included', enterprise: 'included' },
    addonPrice: { starter: 15 },
    creditsPerTx: { starter: 50, business: 20, enterprise: 10 },
  },
  // ── Analytics ───────────────────────────────────────────────────────
  {
    id: 'feedback',
    name: 'Recolha de Feedback',
    icon: '⭐',
    category: 'analytics',
    desc: 'Pede avaliação (1-5 estrelas) no fim de cada conversa',
    detail: 'Quando a conversa é resolvida, o agente pede ao cliente uma avaliação de 1 a 5 estrelas (e comentário opcional) via WhatsApp ou Chat Web. Os resultados ficam agregados no Histórico de conversas.',
    plans: { free: 'addon', starter: 'addon', business: 'included', enterprise: 'included' },
    addonPrice: { free: 4, starter: 4 },
  },
  {
    id: 'analytics',
    name: 'Análises Avançadas',
    icon: '📊',
    category: 'analytics',
    desc: 'Dashboard com métricas, conversões, padrões e insights',
    detail: 'Relatórios detalhados: volume de conversas, taxa de resolução, produtos mais pedidos, horários de pico, motivos de handoff, funil de conversão e mais.',
    plans: { free: 'unavailable', starter: 'addon', business: 'addon', enterprise: 'included' },
    addonPrice: { starter: 20, business: 15 },
  },
  {
    id: 'lead_gen',
    name: 'Lead Generation',
    icon: '🎯',
    category: 'analytics',
    desc: 'Qualifica leads automaticamente e integra com CRM',
    detail: 'O agente qualifica leads com perguntas estratégicas, atribui scores e sincroniza com HubSpot, Pipedrive ou outros CRMs via webhook.',
    plans: { free: 'unavailable', starter: 'unavailable', business: 'addon', enterprise: 'included' },
    addonPrice: { business: 25 },
  },
  // ── Custom ──────────────────────────────────────────────────────────
  {
    id: 'custom',
    name: 'Custom Skills',
    icon: '⚙️',
    category: 'custom',
    desc: 'Skills desenvolvidas à medida para o teu negócio',
    detail: 'Desenvolvemos skills personalizadas para os teus casos de uso específicos — integrações com sistemas próprios, fluxos únicos, automações à medida.',
    plans: { free: 'unavailable', starter: 'unavailable', business: 'addon', enterprise: 'addon' },
    addonPrice: { business: 30, enterprise: 20 },
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  base: 'Skills base',
  automation: 'Automação',
  revenue: 'Receita',
  analytics: 'Análise',
  custom: 'À medida',
};

// ─── Infra features (tabela de planos, sem skills) ─────────────────────────
interface FeatureRow { label: string; icon: string; values: (string | boolean | null)[]; note?: string; }
function infraFeatures(cur: Currency): FeatureRow[] {
  const ids = ['free', 'starter', 'business', 'enterprise'] as const;
  const m = (eur: number) => money(addonPrice(eur, cur), cur);
  return [
    { label: 'Preço/mês',              icon: '💶', values: ids.map(id => PLAN_PRICING[id][cur].price === 0 ? 'Grátis' : money(PLAN_PRICING[id][cur].price, cur)) },
    { label: 'Créditos',               icon: '💳', values: ids.map(id => id === 'free' ? `${num(PLAN_PRICING[id][cur].credits)} ¹` : `${num(PLAN_PRICING[id][cur].credits)}/mês`) },
    { label: 'Conversas estimadas',    icon: '💬', values: ids.map(id => `≈ ${num(estConversations(PLAN_PRICING[id][cur].credits))}${id === 'free' ? '' : '/mês'}`), note: `Média de ~${CREDITS_PER_CONVERSATION} créditos por conversa (3-5 trocas). Varia com o modelo e o tamanho da base de conhecimento.` },
    { label: 'Preço por 1.000 créditos', icon: '📊', values: ids.map(id => pricePer1k(id, cur)), note: 'Quanto mais alto o plano, mais barato fica cada crédito' },
    { label: 'Agentes',                icon: '🤖', values: ['1', '1', '3', '10'], note: '1 agente = 1 número WhatsApp. Podes adicionar mais como addon.' },
    { label: 'Números WhatsApp',       icon: '📱', values: ['1', '1', '3', '10'] },
    { label: 'Chat Web',               icon: '🌐', values: [true, true, true, true] },
    { label: 'Modelos IA',             icon: '⚡', values: ['Haiku / GPT-mini', '+ Sonnet', '+ GPT-4o', '+ Claude Opus'], note: 'Auto-routing escolhe o modelo para cada mensagem' },
    { label: 'Base de conhecimento',   icon: '📚', values: [true, true, true, true], note: 'PDF, Word, Excel, PPT, YouTube, Páginas web' },
    { label: 'Mensagens WhatsApp', icon: '✅', values: ['Sem créditos', 'Sem créditos', 'Sem créditos', 'Sem créditos'], note: 'O envio de mensagens não consome créditos. As tarifas da Meta (acima de 1.000 mensagens/mês por número) são faturadas pela Meta diretamente no cartão do dono do número.' },
    { label: 'Rollover de créditos',   icon: '🔄', values: ['—', 'Em breve', 'Em breve', 'Em breve'], note: 'Em breve: paga 85% dos créditos não usados para os transferir para o mês seguinte (válido 2 meses).' },
    { label: 'Pacote extra 5.000 créditos', icon: '⚡', values: ['—', money(TOP_UP.starter[cur], cur), money(TOP_UP.business[cur], cur), money(TOP_UP.enterprise[cur], cur)] },
    { label: 'Agentes extras (addon)', icon: '➕', values: ['—', `+${m(20)}/ag/mês ²`, `+${m(15)}/ag/mês ²`, `+${m(10)}/ag/mês`] },
    { label: 'White-label',            icon: '🎨', values: ['—', `+${m(5)}/ag/mês ➕`, `+${m(3)}/ag/mês ➕`, 'Incluído'] },
    { label: 'API Access',             icon: '🔌', values: [false, false, true, true] },
    { label: 'Histórico conversas',    icon: '💬', values: ['30 dias', '90 dias', '1 ano', 'Ilimitado'] },
    { label: 'Suporte',                icon: '🛟', values: ['Comunidade', 'Email', 'Email prioritário', 'SLA 24h'] },
  ];
}

const TIER = ['free', 'starter', 'business', 'enterprise'] as const;
const HISTORY: Record<string, string> = { free: '30 dias', starter: '90 dias', business: '1 ano', enterprise: 'ilimitado' };
const HAS_API: Record<string, boolean> = { free: false, starter: false, business: true, enterprise: true };

/** O que muda ao passar de um plano para outro, em frases factuais. */
function consequences(from: PlanId, to: PlanId, cur: Currency): string[] {
  const a = PLAN_PRICING[from], b = PLAN_PRICING[to];
  const out: string[] = [];
  const pa = a[cur].price, pb = b[cur].price;
  out.push(pa === 0 ? `Passa a pagar ${money(pb, cur)} por mês.` : pb === 0 ? 'Deixa de pagar mensalidade.' : `A mensalidade passa de ${money(pa, cur)} para ${money(pb, cur)} por mês.`);
  out.push(to === 'free'
    ? `Os créditos passam a ${num(b[cur].credits)}, atribuídos uma única vez e sem renovação.`
    : `Créditos: ${num(a[cur].credits)}${from === 'free' ? ' (únicos)' : ''} → ${num(b[cur].credits)} por mês.`);
  if (a.agents !== b.agents) out.push(`Agentes incluídos: ${a.agents} → ${b.agents}.`);
  if (HISTORY[from] !== HISTORY[to]) out.push(`Histórico de conversas: ${HISTORY[from]} → ${HISTORY[to]}.`);
  if (HAS_API[from] !== HAS_API[to]) out.push(HAS_API[to] ? 'Ganha acesso à API.' : 'Perde o acesso à API.');
  const lost = SKILLS.filter(s => s.plans[from] === 'included' && s.plans[to] !== 'included').length;
  const gained = SKILLS.filter(s => s.plans[from] !== 'included' && s.plans[to] === 'included').length;
  if (gained) out.push(gained === 1 ? '1 skill passa a estar incluída.' : `${gained} skills passam a estar incluídas.`);
  if (lost) out.push(lost === 1 ? '1 skill deixa de estar incluída (fica como addon ou indisponível).' : `${lost} skills deixam de estar incluídas (ficam como addon ou indisponíveis).`);
  return out;
}

function Cell({ ok }: { ok: boolean | string | null | undefined }) {
  if (ok === null || ok === undefined || ok === false) return <span className="text-app-faint">—</span>;
  if (typeof ok === 'string') {
    const addon = ok.includes('➕');
    const txt = ok.replace('➕', '').trim();
    return <span className={cx('num', txt === '—' ? 'text-app-faint' : 'text-app-ink')}>{txt}{addon && <span className="text-app-faint"> · addon</span>}</span>;
  }
  return <span className="text-app-ink">Sim</span>;
}

function SkillBadge({ avail, price, creditsPerTx, currency }: { avail: SkillAvail; price?: number; creditsPerTx?: number; currency: Currency }) {
  if (avail === 'unavailable') return <span className="text-app-faint">—</span>;
  if (avail === 'included') return <span className="font-medium text-app-pos">Incluído</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className="num whitespace-nowrap font-medium text-app-ink">{price ? `+${money(addonPrice(price, currency), currency)}/mês` : 'Addon'}</span>
      {creditsPerTx && <span className="num text-xs text-app-faint">{creditsPerTx} créditos/tx</span>}
    </span>
  );
}
export default function PlansPage() {
  const { tenant } = useAuth();
  const [usage, setUsage] = useState<{ used: number; total: number } | null>(null);
  const [mobilePlan, setMobilePlan] = useState<PlanId | null>(null);

  type MainTab = 'plans' | 'skills' | 'marketplace';
  const [mainTab, setMainTab] = useState<MainTab>('plans');

  // Subscribe modal
  type Step = 'method' | 'phone' | 'instructions';
  type MethodId = 'stripe' | 'ifthenpay_mbway' | 'ifthenpay_multibanco' | 'pix';
  interface PayInstructions {
    invoiceId: string; method: string; amount: number; currency: Currency; plan: string; mock: boolean;
    checkoutUrl?: string;
    mbwayPhone?: string; mbwayReference?: string;
    multibancoEntity?: string; multibancoReference?: string; multibancoExpiry?: string;
    pixKey?: string; pixReference?: string;
    notes?: string;
  }

  // Moeda: a da conta (se já é faturada em R$) ou a do browser (pt-BR → R$)
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [currencyLocked, setCurrencyLocked] = useState(false);
  useEffect(() => {
    setCurrency(defaultCurrency());
    api.get('/api/billing/pricing')
      .then(r => {
        if (r.data?.tenantCurrency === 'BRL') { setCurrency('BRL'); setCurrencyLocked(true); }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    api.get('/api/billing/credits').then(r => { if (typeof r.data?.total === 'number') setUsage({ used: r.data.used, total: r.data.total }); }).catch(() => {});
  }, []);
  const PLANS_DATA = plansFor(currency);
  const INFRA_FEATURES = infraFeatures(currency);

  const [modal, setModal] = useState<{ open: boolean; plan: string; price: number }>({ open: false, plan: '', price: 0 });
  const [step, setStep] = useState<Step>('method');
  const [chosenMethod, setChosenMethod] = useState<MethodId | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState<PayInstructions | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  function openModal(planId: string, price: number) {
    setModal({ open: true, plan: planId, price });
    setStep('method'); setChosenMethod(null); setPhone(''); setInstructions(null); setModalError(null);
  }
  function closeModal() { setModal(m => ({ ...m, open: false })); }

  async function handleMethodChosen(method: MethodId) {
    setChosenMethod(method);
    if (method === 'ifthenpay_mbway') { setStep('phone'); return; }
    await submitSubscribe(method, undefined);
  }

  async function handlePhoneSubmit() {
    if (!phone.match(/^\+?[0-9]{9,15}$/)) { setModalError('Número inválido'); return; }
    await submitSubscribe('ifthenpay_mbway', phone);
  }

  async function submitSubscribe(method: MethodId, mbPhone?: string) {
    setLoading(true); setModalError(null);
    try {
      const res = await api.post('/api/billing/platform-subscribe', { plan: modal.plan, method, phone: mbPhone, currency });
      setInstructions(res.data);
      setStep('instructions');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao processar';
      setModalError(msg);
    } finally { setLoading(false); }
  }

  if (!tenant) return null;

  const currentPlan = tenant.plan as 'free' | 'starter' | 'business' | 'enterprise';
  const currentIdx = PLANS_DATA.findIndex(p => p.id === currentPlan);

  // Skills que o utilizador atual pode comprar (addon no plano dele)
  const availableAddons = SKILLS.filter(s => s.plans[currentPlan] === 'addon');
  // Skills incluídas no plano atual
  const includedSkills = SKILLS.filter(s => s.plans[currentPlan] === 'included');

  // Categorias únicas
  const categories = Array.from(new Set(SKILLS.map(s => s.category)));
  const primaryId: PlanId | null = (() => {
    const hi = PLANS_DATA.find(p => p.highlight);
    if (hi && PLANS_DATA.findIndex(p => p.id === hi.id) > currentIdx) return hi.id;
    const next = PLANS_DATA[currentIdx + 1];
    return next ? next.id : null;
  })();
  const mp: PlanId = mobilePlan ?? currentPlan;
  const curData = PLANS_DATA[currentIdx];
  const days = tenant.subscriptionExpiresAt ? Math.ceil((new Date(tenant.subscriptionExpiresAt).getTime() - Date.now()) / 86400000) : null;
  const status = tenant.subscriptionStatus;

  // Contorno acento só no plano recomendado: bordas nas células da coluna.
  const hiIdx = PLANS_DATA.findIndex(p => p.highlight);
  const colEdge = (j: number, pos: 'top' | 'mid' | 'bottom') =>
    j === hiIdx ? cx('border-x border-app-accent', pos === 'top' && 'rounded-t-lg border-t', pos === 'bottom' && 'rounded-b-lg border-b') : '';
  const curTint = (j: number) => (PLANS_DATA[j].id === currentPlan ? 'bg-app-raised/60' : '');

  function PlanAction({ plan, block, full }: { plan: (typeof PLANS_DATA)[number]; block?: boolean; full?: boolean }) {
    if (plan.id === currentPlan) return <span className={cx('text-sm font-medium text-app-muted', block && 'block text-center')}>Plano atual</span>;
    const isUpgrade = currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id);
    return (
      <button
        onClick={() => plan.price > 0 && openModal(plan.id, plan.price)}
        disabled={plan.price === 0}
        aria-label={plan.price === 0 ? 'Plano gratuito' : `${isUpgrade ? 'Subir' : 'Descer'} para ${plan.label}`}
        className={cx(plan.id === primaryId ? 'btn-primary' : 'btn-secondary', 'w-full disabled:cursor-not-allowed disabled:opacity-50')}
      >
        {plan.price === 0 ? 'Gratuito' : isUpgrade ? (full ? `Subir para ${plan.label}` : 'Subir') : (full ? `Descer para ${plan.label}` : 'Descer')}
      </button>
    );
  }

  const MobilePlanPicker = () => (
    <div className="mb-4 grid grid-cols-4 gap-0.5 rounded-lg border border-app-control p-0.5 md:hidden" role="tablist" aria-label="Plano a ver">
      {PLANS_DATA.map(p => (
        <button key={p.id} role="tab" aria-selected={mp === p.id} onClick={() => setMobilePlan(p.id)}
          className={cx('rounded-md px-1 py-1.5 text-xs font-medium', mp === p.id ? 'bg-app-raised text-app-ink' : 'text-app-muted')}>
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <AppLayout wide>
      <Head><title>Agentfy — Planos e Skills</title></Head>
      <PageHeader
        title="Planos"
        subtitle={<>Plano {PLAN_LABELS[currentPlan as Plan]} · {includedSkills.length} skills incluídas · {availableAddons.length} disponíveis como addon</>}
        actions={
          <div className="flex items-center gap-3">
            {currencyLocked && <span className="text-xs text-app-faint">Conta faturada em reais</span>}
            <div className="inline-flex rounded-lg border border-app-control p-0.5 text-sm" role="group" aria-label="Moeda">
              {(['EUR', 'BRL'] as Currency[]).map(c => (
                <button key={c} onClick={() => !currencyLocked && setCurrency(c)} disabled={currencyLocked && c !== currency} aria-pressed={currency === c}
                  className={cx('rounded-md px-3 py-1 font-medium transition-colors disabled:opacity-40', currency === c ? 'bg-app-raised text-app-ink' : 'text-app-muted hover:text-app-ink')}>
                  {c === 'EUR' ? 'EUR €' : 'BRL R$'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <Tabs<MainTab>
        label="Planos e skills"
        value={mainTab}
        onChange={setMainTab}
        tabs={[
          { id: 'plans', label: 'Planos' },
          { id: 'skills', label: 'Skills por plano' },
          { id: 'marketplace', label: 'Marketplace', count: availableAddons.length },
        ]}
      />

      {/* ── Planos ── */}
      {mainTab === 'plans' && (
        <div className="space-y-6">
          {/* Plano atual e utilização primeiro */}
          <Panel>
            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-app-ink">Plano {PLAN_LABELS[currentPlan as Plan]}</h2>
                  {status === 'active' && <Pill tone="pos" dot>Ativo</Pill>}
                  {status === 'trial' && <Pill tone="accent">Período de teste</Pill>}
                  {status === 'pending_payment' && <Pill tone="warn">Aguarda pagamento</Pill>}
                  {status === 'suspended' && <Pill tone="neg">Suspenso</Pill>}
                </div>
                <p className="num mt-2 text-2xl font-semibold text-app-ink">
                  {curData.price === 0 ? 'Grátis' : money(curData.price, currency)}
                  {curData.price > 0 && <span className="text-sm font-normal text-app-muted"> / mês</span>}
                </p>
                <p className="mt-1 text-sm text-app-muted">
                  {curData.agents} agente{curData.agents > 1 ? 's' : ''} · {curData.creditsLabel}
                  {tenant.subscriptionExpiresAt && <> · renova a <span className="num">{isoDate(tenant.subscriptionExpiresAt)}</span>{days !== null && days > 0 ? <span className="text-app-faint"> ({days} dias)</span> : null}</>}
                </p>
              </div>
              <div className="md:border-l md:border-app-rule md:pl-10">
                {usage ? (
                  <UsageBar used={usage.used} total={usage.total} />
                ) : (
                  <p className="text-sm text-app-muted">Créditos incluídos: <span className="num font-medium text-app-ink">{fmt(curData.credits)}</span>{currentPlan === 'free' ? ' (únicos)' : ' por mês'}.</p>
                )}
              </div>
            </div>
          </Panel>

          {/* Comparação: tabela de colunas, uma só marcada */}
          <section aria-label="Comparação de planos">
            <MobilePlanPicker />
            {/* Mobile: um plano de cada vez */}
            <div className="md:hidden">
              {PLANS_DATA.filter(p => p.id === mp).map(plan => (
                <div key={plan.id}>
                  <div className={cx('mb-3 rounded-xl border p-4', plan.highlight ? 'border-app-accent' : 'border-app-edge')}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-app-ink">{plan.label}</h3>
                      {plan.highlight && <Pill tone="accent">Recomendado</Pill>}
                    </div>
                    <p className="num mt-1 text-2xl font-semibold text-app-ink">{plan.price === 0 ? 'Grátis' : money(plan.price, currency)}{plan.price > 0 && <span className="text-sm font-normal text-app-muted"> / mês</span>}</p>
                    <div className="mt-3"><PlanAction plan={plan} full /></div>
                  </div>
                  <dl>
                    {INFRA_FEATURES.slice(1).map((f, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 border-t border-app-rule py-2.5 text-sm">
                        <dt className="min-w-0 text-app-muted">{f.label}</dt>
                        <dd className="shrink-0 text-right"><Cell ok={f.values[PLANS_DATA.findIndex(p => p.id === plan.id)]} /></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="w-[26%] pb-3 pr-4 text-left align-bottom text-xs font-medium text-app-muted">Funcionalidade</th>
                    {PLANS_DATA.map((plan, j) => (
                      <th key={plan.id} className={cx('px-4 pb-4 pt-4 text-left align-bottom font-normal', colEdge(j, 'top'), curTint(j))}>
                        <div className="flex h-5 items-center gap-2">
                          <span className="text-base font-semibold text-app-ink">{plan.label}</span>
                          {plan.highlight && <Pill tone="accent">Recomendado</Pill>}
                          {plan.id === currentPlan && <Pill>Atual</Pill>}
                        </div>
                        <p className="num mt-2 text-2xl font-semibold text-app-ink">{plan.price === 0 ? 'Grátis' : money(plan.price, currency)}</p>
                        <p className="text-xs text-app-faint">{plan.price === 0 ? 'sem prazo' : 'por mês'}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INFRA_FEATURES.slice(1).map((feature, i) => (
                    <tr key={i}>
                      <td className="border-t border-app-rule py-2.5 pr-4 align-top">
                        <span className="text-app-ink">{feature.label}</span>
                        {feature.note && <p className="mt-0.5 text-xs leading-snug text-app-faint">{feature.note}</p>}
                      </td>
                      {feature.values.map((val, j) => (
                        <td key={j} className={cx('border-t border-app-rule px-4 py-2.5 align-top', colEdge(j, 'mid'), curTint(j))}>
                          <Cell ok={val} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border-t border-app-rule" />
                    {PLANS_DATA.map((plan, j) => (
                      <td key={plan.id} className={cx('border-t border-app-rule px-4 py-4', colEdge(j, 'bottom'), curTint(j))}>
                        <PlanAction plan={plan} block />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Consequências de mudar */}
          <Panel title="O que muda se mudar de plano">
            <div className="divide-y divide-app-rule">
              {PLANS_DATA.filter(p => p.id !== currentPlan).map(p => {
                const up = PLANS_DATA.findIndex(x => x.id === p.id) > currentIdx;
                return (
                  <div key={p.id} className="grid gap-1 py-3 first:pt-0 last:pb-0 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6">
                    <p className="text-sm font-medium text-app-ink">{up ? 'Subir para' : 'Descer para'} {p.label}</p>
                    <ul className="space-y-0.5 text-sm text-app-muted">
                      {consequences(currentPlan, p.id as PlanId, currency).map((c, k) => <li key={k}>{c}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 border-t border-app-rule pt-3 text-sm text-app-muted">
              A mudança só fica ativa depois de o pagamento ser confirmado. A subscrição renova todos os meses até ser cancelada.
            </p>
          </Panel>

          {/* Créditos */}
          <Panel title="Como funcionam os créditos">
            <dl className="grid gap-x-8 text-sm md:grid-cols-2">
              {[
                { label: 'Conversa simples (1-2 trocas)', cost: '~10-20 créditos' },
                { label: 'Conversa média (3-5 trocas)', cost: '~30-50 créditos' },
                { label: 'Pedido com pagamento', cost: '~50-80 créditos + créditos/tx' },
                { label: 'Conversa complexa (6+ trocas)', cost: '~80+ créditos' },
              ].map(ex => (
                <div key={ex.label} className="flex items-baseline justify-between gap-4 border-t border-app-rule py-2.5">
                  <dt className="text-app-muted">{ex.label}</dt>
                  <dd className="num font-medium text-app-ink">{ex.cost}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-app-muted">
              1 crédito corresponde a cerca de 1.000 tokens no Claude Haiku. Modelos mais capazes consomem mais (Sonnet e GPT-4o ×3, Opus ×5); o auto-routing escolhe o modelo para cada mensagem.
            </p>
          </Panel>

          <div className="space-y-1 text-xs text-app-faint">
            <p>¹ Créditos Free são atribuídos uma única vez e não renovam. Suba de plano para ter créditos mensais renováveis.</p>
            <p>² Starter: máx. 3 agentes no total · Business: máx. 10 · Enterprise: ilimitados.</p>
            <p>1 agente = 1 número WhatsApp. Um agente pode integrar várias plataformas (Shopify, iFood, etc.) em simultâneo.</p>
          </div>
        </div>
      )}

      {/* ── Skills por plano ── */}
      {mainTab === 'skills' && (
        <div>
          <p className="mb-5 max-w-2xl text-sm text-app-muted">
            As skills são capacidades adicionais que diferenciam cada agente. Cada agente pode ter um conjunto diferente de skills ativas.
          </p>
          <MobilePlanPicker />
          {/* Mobile */}
          <div className="md:hidden">
            {categories.map(cat => (
              <div key={cat} className="mb-5">
                <h3 className="mb-1 text-sm font-semibold text-app-ink">{CATEGORY_LABELS[cat]}</h3>
                {SKILLS.filter(s => s.category === cat).map(skill => (
                  <div key={skill.id} className="flex items-start justify-between gap-4 border-t border-app-rule py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-app-ink">{skill.name}</p>
                      <p className="text-xs text-app-faint">{skill.desc}</p>
                    </div>
                    <div className="shrink-0 text-right"><SkillBadge avail={skill.plans[mp]} price={skill.addonPrice[mp]} creditsPerTx={skill.creditsPerTx?.[mp]} currency={currency} /></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Desktop */}
          <div className="hidden md:block">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-app-muted">
                  <th className="w-[40%] py-2 pr-4 font-medium">Skill</th>
                  {PLANS_DATA.map((plan, j) => (
                    <th key={plan.id} className={cx('px-4 py-2 text-right font-medium', curTint(j), plan.id === currentPlan && 'text-app-ink')}>
                      {plan.label}{plan.id === currentPlan && <span className="ml-1.5 font-normal text-app-faint">atual</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <>
                    <tr key={`cat-${cat}`}>
                      <td colSpan={5} className="border-t border-app-rule pb-1 pt-5 text-sm font-semibold text-app-ink">{CATEGORY_LABELS[cat]}</td>
                    </tr>
                    {SKILLS.filter(s => s.category === cat).map(skill => (
                      <tr key={skill.id}>
                        <td className="border-t border-app-rule py-2.5 pr-4 align-top">
                          <p className="font-medium text-app-ink">{skill.name}</p>
                          <p className="text-xs leading-snug text-app-faint">{skill.desc}</p>
                          {skill.creditsPerTx && <p className="text-xs text-app-muted">Mais créditos por transação, conforme o plano.</p>}
                        </td>
                        {PLANS_DATA.map((plan, j) => (
                          <td key={plan.id} className={cx('border-t border-app-rule px-4 py-2.5 text-right align-top', curTint(j))}>
                            <SkillBadge avail={skill.plans[plan.id as PlanId]} price={skill.addonPrice[plan.id]} creditsPerTx={skill.creditsPerTx?.[plan.id]} currency={currency} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs text-app-faint">
            Incluído: vem com o plano, sem custo extra. {currency === 'BRL' ? '+R$X/mês' : '+€X/mês'}: addon, compra no marketplace. —: não disponível neste plano.
          </p>
        </div>
      )}

      {/* ── Marketplace ── */}
      {mainTab === 'marketplace' && (
        <div>
          {availableAddons.length > 0 ? (
            <>
              <p className="mb-5 text-sm text-app-muted">Skills que pode adicionar ao plano {PLAN_LABELS[currentPlan as Plan]}.</p>
              {categories.map(cat => {
                const catSkills = availableAddons.filter(s => s.category === cat);
                if (!catSkills.length) return null;
                return (
                  <section key={cat} className="mb-7">
                    <h3 className="mb-1 text-base font-semibold text-app-ink">{CATEGORY_LABELS[cat]}</h3>
                    {catSkills.map(skill => {
                      const price = skill.addonPrice[currentPlan];
                      const crTx = skill.creditsPerTx?.[currentPlan];
                      return (
                        <div key={skill.id} className="grid gap-3 border-t border-app-rule py-4 md:grid-cols-[minmax(0,1fr)_14rem_9rem] md:items-start md:gap-8">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-app-ink">{skill.name}</p>
                            <p className="mt-1 text-sm text-app-muted">{skill.detail}</p>
                          </div>
                          <dl className="space-y-1 text-sm">
                            {price !== undefined && (
                              <div className="flex justify-between gap-3"><dt className="text-app-muted">Mensalidade</dt><dd className="num font-medium text-app-ink">{money(addonPrice(price, currency), currency)}/mês</dd></div>
                            )}
                            <div className="flex justify-between gap-3">
                              <dt className="text-app-muted">{crTx !== undefined ? 'Por transação' : 'Por uso'}</dt>
                              <dd className="num text-right font-medium text-app-ink">{crTx !== undefined ? `${crTx} créditos` : <span className="font-normal text-app-muted">Nos créditos do plano</span>}</dd>
                            </div>
                          </dl>
                          <a
                            href={`mailto:contact@solutions.shaklabs.tech?subject=Ativar Skill ${encodeURIComponent(skill.name)}&body=Olá, gostaria de ativar a skill ${encodeURIComponent(skill.name)} no meu plano ${PLAN_LABELS[currentPlan as Plan]}.`}
                            className="btn-secondary w-full md:w-auto md:justify-self-end"
                          >
                            Ativar skill
                          </a>
                        </div>
                      );
                    })}
                  </section>
                );
              })}
              <p className="border-t border-app-rule pt-4 text-sm text-app-muted">
                A compra de skills em self-service chega em breve. Por agora, "Ativar skill" abre um email e ativamos manualmente em menos de 2 h.
              </p>
            </>
          ) : (
            <EmptyState
              title="O seu plano já inclui todas as skills disponíveis."
              body={currentPlan !== 'enterprise' ? 'Suba para Enterprise para desbloquear as restantes.' : undefined}
              action={currentPlan !== 'enterprise' ? <button onClick={() => openModal('enterprise', PLAN_PRICING.enterprise[currency].price)} className="btn-primary">Subir para Enterprise</button> : undefined}
            />
          )}
        </div>
      )}

      {/* ─── Subscribe Modal ─── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-app-edge bg-app-sheet shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-app-rule p-5">
              <div>
                <h3 className="text-base font-semibold text-app-ink">
                  {step === 'instructions' ? 'Instruções de pagamento' : `Subscrever plano ${PLAN_LABELS[modal.plan as Plan]}`}
                </h3>
                {modal.price > 0 && step !== 'instructions' && (
                  <p className="num mt-0.5 text-sm text-app-muted">{money(modal.price, currency)} / mês · renovação mensal</p>
                )}
              </div>
              <button onClick={closeModal} aria-label="Fechar" className="text-2xl leading-none text-app-faint hover:text-app-ink">×</button>
            </div>

            <div className="p-5">
              {step === 'method' && (
                <div className="space-y-2">
                  <p className="mb-3 text-sm text-app-muted">Como quer pagar?</p>
                  {(currency === 'BRL' ? [
                    { id: 'pix' as const,                  label: 'PIX',                  sub: 'Brasil · ativação após confirmação do pagamento', badge: 'Recomendado' },
                    { id: 'stripe' as const,               label: 'Cartão de crédito',    sub: 'Visa, Mastercard', badge: undefined },
                  ] : [
                    { id: 'ifthenpay_mbway' as const,      label: 'MB Way',               sub: 'Portugal · 0,7% + €0,07', badge: 'Mais barato' },
                    { id: 'ifthenpay_multibanco' as const, label: 'Multibanco / ATM',     sub: 'Portugal · 1,5% + €0,20', badge: undefined },
                    { id: 'stripe' as const,               label: 'Cartão internacional', sub: 'Visa, Mastercard · 1,4% + €0,25', badge: undefined },
                  ]).map(m => (
                    <button key={m.id} onClick={() => handleMethodChosen(m.id)} disabled={loading}
                      className="flex w-full items-center gap-3 rounded-xl border border-app-control p-4 text-left transition-colors hover:border-app-accent disabled:opacity-60">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-app-ink">{m.label}</span>
                          {m.badge && <Pill tone="pos">{m.badge}</Pill>}
                        </div>
                        <span className="text-xs text-app-muted">{m.sub}</span>
                      </div>
                      <span className="text-app-faint" aria-hidden="true">›</span>
                    </button>
                  ))}
                  {modalError && <p className="mt-2 text-sm text-app-neg">{modalError}</p>}
                </div>
              )}

              {step === 'phone' && (
                <div className="space-y-4">
                  <p className="text-sm text-app-muted">Introduza o número MB Way para receber o pedido de pagamento.</p>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+351 9XXXXXXXX" autoFocus className="input w-full" />
                  {modalError && <p className="text-sm text-app-neg">{modalError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setStep('method')} className="btn-secondary flex-1">Voltar</button>
                    <button onClick={handlePhoneSubmit} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                      {loading ? 'A processar…' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}

              {step === 'instructions' && instructions && (
                <div className="space-y-4">
                  {instructions.mock && (
                    <p className="rounded-lg bg-app-warn-soft p-3 text-xs text-app-warn"><strong>Modo teste.</strong> Sem credenciais reais. O admin pode confirmar o pagamento.</p>
                  )}
                  {instructions.method === 'ifthenpay_multibanco' && (
                    <div className="space-y-3 rounded-xl bg-app-raised p-4">
                      <p className="text-sm font-semibold text-app-ink">Referência Multibanco</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[{ label: 'Entidade', value: instructions.multibancoEntity }, { label: 'Referência', value: instructions.multibancoReference }, { label: 'Montante', value: money(instructions.amount, instructions.currency ?? 'EUR', 2) }]
                          .map(({ label, value }) => (
                            <div key={label}>
                              <p className="text-xs text-app-muted">{label}</p>
                              <p className="num mt-0.5 text-sm font-semibold text-app-ink">{value}</p>
                            </div>
                          ))}
                      </div>
                      {instructions.multibancoExpiry && <p className="text-xs text-app-muted">Válido até <span className="num">{instructions.multibancoExpiry}</span></p>}
                    </div>
                  )}
                  {instructions.method === 'ifthenpay_mbway' && (
                    <div className="rounded-xl bg-app-raised p-4">
                      <p className="text-sm font-semibold text-app-ink">MB Way</p>
                      <p className="mt-1 text-xs text-app-muted">Pedido enviado para <strong className="num text-app-ink">{instructions.mbwayPhone}</strong></p>
                      <p className="num mt-2 text-2xl font-semibold text-app-ink">{money(instructions.amount, instructions.currency ?? 'EUR', 2)}</p>
                      <p className="mt-1 text-xs text-app-muted">Confirme na app MB Way.</p>
                    </div>
                  )}
                  {instructions.method === 'pix' && (
                    <div className="space-y-2 rounded-xl bg-app-raised p-4">
                      <p className="text-sm font-semibold text-app-ink">Pagamento PIX</p>
                      <p className="num text-2xl font-semibold text-app-ink">{money(instructions.amount, 'BRL', 2)}</p>
                      <p className="text-xs text-app-muted">Chave PIX: <strong className="num break-all text-app-ink">{instructions.pixKey}</strong></p>
                      <p className="text-xs text-app-muted">Na descrição do PIX indique a referência <strong className="num text-app-ink">{instructions.pixReference}</strong></p>
                      <p className="text-xs text-app-faint">O plano é ativado assim que confirmarmos a receção (normalmente em menos de 2 h úteis).</p>
                    </div>
                  )}
                  {instructions.method === 'stripe' && (
                    <div className="space-y-3">
                      <p className="text-sm text-app-muted">Clique abaixo para pagar com cartão.</p>
                      {instructions.checkoutUrl ? (
                        <a href={instructions.checkoutUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
                          Pagar {money(instructions.amount, instructions.currency ?? 'EUR', 2)}
                        </a>
                      ) : (
                        <p className="text-xs text-app-faint">Checkout não disponível (modo teste).</p>
                      )}
                    </div>
                  )}
                  {instructions.notes && <p className="rounded-lg bg-app-raised p-3 text-xs text-app-muted">{instructions.notes}</p>}
                  <button onClick={closeModal} className="btn-secondary w-full">Fechar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
