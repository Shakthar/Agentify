import { useState } from 'react';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { Plan, PLAN_LABELS, PLAN_COLORS } from '../../types';
import api from '../../utils/api';

// ─── Planos ───────────────────────────────────────────────────────────────────
const PLANS_DATA = [
  { id: 'free',       label: 'Free',       price: 0,   credits: 1000,  creditsLabel: '1.000 (única vez)', agents: 1,  whatsapp: 1,  renewable: false, highlight: false, badge: null,             creditsPerEur: null      },
  { id: 'starter',    label: 'Starter',    price: 59,  credits: 5000,  creditsLabel: '5.000 / mês',       agents: 1,  whatsapp: 1,  renewable: true,  highlight: true,  badge: 'Mais popular',   creditsPerEur: 0.0118    },
  { id: 'business',   label: 'Business',   price: 159, credits: 15000, creditsLabel: '15.000 / mês',      agents: 3,  whatsapp: 3,  renewable: true,  highlight: false, badge: 'Para crescer',   creditsPerEur: 0.0106    },
  { id: 'enterprise', label: 'Enterprise', price: 399, credits: 40000, creditsLabel: '40.000 / mês',      agents: 10, whatsapp: 10, renewable: true,  highlight: false, badge: 'Grande operação', creditsPerEur: 0.00998   },
] as const;

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
  {
    id: 'delivery',
    name: 'Delivery / Pedidos',
    icon: '🛵',
    category: 'base',
    desc: 'Recebe e processa pedidos de entrega com itens e morada',
    detail: 'O agente recolhe os itens do pedido, morada de entrega e confirma o pedido. Integra com sistemas POS ou envia para o e-mail/painel.',
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
    name: 'Vendas + Pedidos/KDS',
    icon: '🏷️',
    category: 'revenue',
    desc: 'Upselling inteligente, cliente recorrente e gestão de pedidos com KDS',
    detail: 'Addon de vendas com boas práticas integradas + sistema Pedidos/KDS incluído:\n\n• Trata sempre o cliente pelo nome — usa o histórico para personalizar cada conversa\n• Clientes recorrentes: analisa o histórico de pedidos e sugere automaticamente o que o cliente costuma pedir ("Olá João! Queres o teu habitual — pizza margherita + sumo?")\n• Upselling natural — sugere itens adicionais no momento certo, de forma amigável e assertiva, sem ser invasivo\n• Cross-sell contextual — recomenda produtos complementares com base no pedido atual\n• Histórico de preferências — aprende com as conversas anteriores para afinar sugestões ao longo do tempo\n• Inclui sistema de Pedidos/KDS: painel de cozinha em tempo real, gestão de estados e notificações',
    plans: { free: 'unavailable', starter: 'addon', business: 'addon', enterprise: 'addon' },
    addonPrice: { starter: 15, business: 15, enterprise: 15 },
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
    name: 'Feedback Automático',
    icon: '⭐',
    category: 'analytics',
    desc: 'Recolhe avaliações pós-conversa e envia relatórios semanais',
    detail: 'Após cada conversa, o agente pede feedback ao cliente (1-5 estrelas + comentário). Relatórios automáticos no painel com tendências e alertas de satisfação baixa.',
    plans: { free: 'unavailable', starter: 'addon', business: 'addon', enterprise: 'included' },
    addonPrice: { starter: 12, business: 12 },
  },
  {
    id: 'analytics',
    name: 'Análises Avançadas',
    icon: '📊',
    category: 'analytics',
    desc: 'Dashboard com métricas, conversões, padrões e insights',
    detail: 'Relatórios detalhados: volume de conversas, taxa de resolução, produtos mais pedidos, horários de pico, motivos de handoff, funil de conversão e mais.',
    plans: { free: 'unavailable', starter: 'addon', business: 'addon', enterprise: 'included' },
    addonPrice: { starter: 18, business: 18 },
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
    plans: { free: 'unavailable', starter: 'unavailable', business: 'addon', enterprise: 'included' },
    addonPrice: { business: 30 },
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  base: '🧱 Skills Base',
  automation: '⚙️ Automação',
  revenue: '💰 Revenue',
  analytics: '📊 Analytics',
  custom: '🛠️ Custom',
};

// ─── Infra features (tabela de planos, sem skills) ─────────────────────────
interface FeatureRow { label: string; icon: string; values: (string | boolean | null)[]; note?: string; }
const INFRA_FEATURES: FeatureRow[] = [
  { label: 'Preço/mês',              icon: '💶', values: ['Grátis', '€59', '€159', '€399'] },
  { label: 'Créditos',               icon: '💳', values: ['1.000 ¹', '5.000/mês', '15.000/mês', '40.000/mês'] },
  { label: 'Custo/crédito',          icon: '📊', values: ['—', '€0.0118', '€0.0106', '€0.01'], note: 'Quanto mais alto o plano, mais barato fica cada crédito' },
  { label: 'Agentes',                icon: '🤖', values: ['1', '1', '3', '10'], note: '1 agente = 1 número WhatsApp. Podes adicionar mais como addon.' },
  { label: 'Números WhatsApp',       icon: '📱', values: ['1', '1', '3', '10'] },
  { label: 'Chat Web',               icon: '🌐', values: [true, true, true, true] },
  { label: 'Modelos IA',             icon: '⚡', values: ['Haiku / GPT-mini', '+ Sonnet', '+ GPT-4o + Gemini', '+ Claude Opus'], note: 'Auto-routing escolhe o modelo mais barato para cada tipo de mensagem' },
  { label: 'Base de conhecimento',   icon: '📚', values: [true, true, true, true], note: 'PDF, Word, Excel, PPT, YouTube, Páginas web' },
  { label: 'Rollover de créditos',   icon: '🔄', values: ['—', '🔜 Em breve', '🔜 Em breve', '🔜 Em breve'], note: 'Em breve: paga 85% dos créditos não usados para os transferir para o mês seguinte (válido 2 meses).' },
  { label: 'Créditos extra (demand)', icon: '⚡', values: ['—', '€0.0118/crd', '€0.0106/crd', '€0.01/crd'] },
  { label: 'Agentes extras (addon)', icon: '➕', values: ['—', '+€20/ag/mês ²', '+€15/ag/mês ²', '+€10/ag/mês'] },
  { label: 'White-label',            icon: '🎨', values: ['—', '+€5/ag/mês ➕', '+€3/ag/mês ➕', 'Incluído'] },
  { label: 'API Access',             icon: '🔌', values: [false, false, true, true] },
  { label: 'Histórico conversas',    icon: '💬', values: ['30 dias', '90 dias', '1 ano', 'Ilimitado'] },
  { label: 'Suporte',                icon: '🛟', values: ['Comunidade', 'Email', 'Email prioritário', 'SLA 24h'] },
];

function Cell({ ok }: { ok: boolean | string | null | undefined }) {
  if (ok === null || ok === undefined || ok === false)
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  if (typeof ok === 'string') {
    const isAddon = ok.includes('➕');
    return <span className={`text-xs ${isAddon ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>{ok}</span>;
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30">
      <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
    </span>
  );
}

function SkillBadge({ avail, addonPrice, creditsPerTx }: { avail: SkillAvail; addonPrice?: number; creditsPerTx?: number }) {
  if (avail === 'unavailable')
    return <span className="text-xs text-gray-300 dark:text-gray-600">—</span>;
  if (avail === 'included')
    return (
      <span className="inline-flex items-center gap-1 text-[15px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
        ✓ Incluído
      </span>
    );
  // addon
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center text-[15px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full whitespace-nowrap">
        {addonPrice ? `+€${addonPrice}/mês` : 'Addon'}
      </span>
      {creditsPerTx && (
        <span className="text-[14px] text-gray-400">{creditsPerTx} crd/tx</span>
      )}
    </div>
  );
}

export default function PlansPage() {
  const { tenant } = useAuth();

  type MainTab = 'plans' | 'skills' | 'marketplace';
  const [mainTab, setMainTab] = useState<MainTab>('plans');

  // Subscribe modal
  type Step = 'method' | 'phone' | 'instructions';
  type MethodId = 'stripe' | 'ifthenpay_mbway' | 'ifthenpay_multibanco';
  interface PayInstructions {
    invoiceId: string; method: string; amount: number; plan: string; mock: boolean;
    checkoutUrl?: string;
    mbwayPhone?: string; mbwayReference?: string;
    multibancoEntity?: string; multibancoReference?: string; multibancoExpiry?: string;
    notes?: string;
  }

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
      const res = await api.post('/billing/platform-subscribe', { plan: modal.plan, method, phone: mbPhone });
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

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Planos e Skills</title></Head>
      <Navigation />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Planos e Skills</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Plano atual: <span className={`font-medium text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[currentPlan as Plan]}`}>{PLAN_LABELS[currentPlan as Plan]}</span>
              {' · '}{includedSkills.length} skills incluídas · {availableAddons.length} skills disponíveis para adicionar
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1">
            {([
              { key: 'plans',       label: '📋 Planos',           sub: 'Comparar planos e preços' },
              { key: 'skills',      label: '🧩 Skills por plano', sub: 'O que vem com cada plano' },
              { key: 'marketplace', label: '🛒 Marketplace',      sub: `${availableAddons.length} skills disponíveis` },
            ] as { key: MainTab; label: string; sub: string }[]).map(t => (
              <button key={t.key} onClick={() => setMainTab(t.key)}
                className={`group px-4 pb-3 pt-1 text-left transition-colors border-b-2 ${
                  mainTab === t.key
                    ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                <span className="text-sm font-semibold block">{t.label}</span>
                <span className="text-[15px] text-gray-400 hidden sm:block">{t.sub}</span>
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ABA 1 — PLANOS
          ═══════════════════════════════════════════════════════════ */}
          {mainTab === 'plans' && (
            <>
              {/* Plan cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {PLANS_DATA.map((plan) => {
                  const isCurrent = currentPlan === plan.id;
                  const isUpgrade = currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id);
                  return (
                    <div key={plan.id} className={`relative rounded-xl border-2 p-5 flex flex-col gap-3 transition-all
                      ${plan.highlight ? 'border-brand-500 shadow-md' : 'border-gray-200 dark:border-gray-700'}
                      ${isCurrent ? 'bg-brand-50 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-900'}`}>
                      {plan.badge && (
                        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[14px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap
                          ${plan.highlight ? 'bg-brand-600 text-white' : 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'}`}>
                          {plan.badge}
                        </span>
                      )}
                      <div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan.id as Plan]}`}>{plan.label}</span>
                        <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-gray-100">
                          {plan.price === 0 ? 'Grátis' : `€${plan.price}`}
                          {plan.price > 0 && <span className="text-xs text-gray-400 font-normal">/mês</span>}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 flex-1">
                        <p>💳 <strong className="text-gray-700 dark:text-gray-300">{plan.creditsLabel}</strong></p>
                        <p>🤖 <strong className="text-gray-700 dark:text-gray-300">{plan.agents} agente{plan.agents > 1 ? 's' : ''}</strong></p>
                        <p>📱 {plan.whatsapp} WhatsApp{plan.whatsapp > 1 ? 's' : ''}</p>
                        {plan.creditsPerEur && <p className="text-green-600 dark:text-green-400 font-medium">€{plan.creditsPerEur.toFixed(4)}/crédito</p>}
                        {!plan.renewable && <p className="text-amber-600 dark:text-amber-400">⚠️ Créditos únicos</p>}
                      </div>
                      {isCurrent ? (
                        <span className="text-center text-xs text-brand-600 dark:text-brand-400 font-medium py-1.5 bg-brand-100 dark:bg-brand-900/30 rounded-lg">✓ Plano atual</span>
                      ) : (
                        <button onClick={() => plan.price > 0 && openModal(plan.id, plan.price)}
                          className={`text-xs py-2 px-3 rounded-lg font-medium transition-colors ${
                            isUpgrade ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                          {plan.price === 0 ? 'Plano gratuito' : isUpgrade ? 'Fazer upgrade →' : 'Fazer downgrade'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Credits explainer */}
              <div className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Como funcionam os créditos?</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-700 dark:text-blue-300">
                  {[
                    { label: 'Conversa simples (1-2 trocas)', cost: '~5 créditos' },
                    { label: 'Conversa média (3-5 trocas)', cost: '~10 créditos' },
                    { label: 'Pedido com pagamento', cost: '~25-30 créditos' },
                    { label: 'Conversa complexa (6+ trocas)', cost: '~20+ créditos' },
                  ].map(ex => (
                    <div key={ex.label} className="bg-white dark:bg-blue-900/20 rounded-lg p-2.5">
                      <p className="text-blue-500 dark:text-blue-400">{ex.label}</p>
                      <p className="font-bold mt-0.5">{ex.cost}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[15px] text-blue-500 dark:text-blue-400 mt-2">
                  💡 O auto-routing de IA escolhe automaticamente o modelo mais barato para cada mensagem, poupando até 60% dos créditos.
                </p>
              </div>

              {/* Infra comparison table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                <table className="w-full text-sm min-w-[620px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 w-52">Funcionalidade</th>
                      {PLANS_DATA.map(plan => (
                        <th key={plan.id} className={`py-3 px-3 text-center relative ${currentPlan === plan.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                          {currentPlan === plan.id && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[14px] px-2 py-0.5 rounded-full whitespace-nowrap">Atual</span>
                          )}
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan.id as Plan]}`}>{plan.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {INFRA_FEATURES.map((feature, i) => (
                      <tr key={i} className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-gray-800/20'}`}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-start gap-1.5">
                            <span className="text-sm mt-0.5">{feature.icon}</span>
                            <div>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{feature.label}</span>
                              {feature.note && <p className="text-[14px] text-gray-400 mt-0.5 leading-tight">{feature.note}</p>}
                            </div>
                          </div>
                        </td>
                        {feature.values.map((val, j) => (
                          <td key={j} className={`py-2.5 px-3 text-center ${currentPlan === PLANS_DATA[j].id ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}>
                            <Cell ok={val} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                      <td className="py-4 px-4" />
                      {PLANS_DATA.map(plan => (
                        <td key={plan.id} className={`py-4 px-3 text-center ${currentPlan === plan.id ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}>
                          {currentPlan === plan.id ? (
                            <span className="text-xs text-brand-600 font-medium">✓ Atual</span>
                          ) : (
                            <button onClick={() => plan.price > 0 && openModal(plan.id, plan.price)}
                              className={`w-full text-xs py-2 px-3 rounded-lg font-medium transition-colors ${
                                currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id)
                                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {plan.price === 0 ? 'Grátis' : currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id) ? 'Upgrade →' : 'Downgrade'}
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes */}
              <div className="text-[15px] text-gray-400 space-y-1">
                <p>¹ Créditos Free são atribuídos uma única vez e não renovam. Faz upgrade para créditos mensais renováveis.</p>
                <p>² Starter: máx 3 agentes total · Business: máx 10 agentes total · Enterprise: ilimitados.</p>
                <p>· 1 Agente = 1 número WhatsApp. Um agente pode integrar múltiplas plataformas (Shopify, iFood, etc.) em simultâneo.</p>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ABA 2 — SKILLS POR PLANO
          ═══════════════════════════════════════════════════════════ */}
          {mainTab === 'skills' && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                As skills são capacidades adicionais que diferencia cada agente. Cada agente pode ter um conjunto diferente de skills ativas.
              </p>

              {/* Skills matrix table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                <table className="w-full text-sm min-w-[620px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 w-64">Skill</th>
                      {PLANS_DATA.map(plan => (
                        <th key={plan.id} className={`py-3 px-3 text-center relative ${currentPlan === plan.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                          {currentPlan === plan.id && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[14px] px-2 py-0.5 rounded-full whitespace-nowrap">Atual</span>
                                                 )}
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan.id as Plan]}`}>{plan.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <>
                        {/* Category header */}
                        <tr key={`cat-${cat}`} className="bg-gray-100 dark:bg-gray-800">
                          <td colSpan={5} className="py-2 px-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {CATEGORY_LABELS[cat]}
                          </td>
                        </tr>
                        {SKILLS.filter(s => s.category === cat).map((skill, i) => (
                          <tr key={skill.id} className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/10'}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-start gap-2">
                                <span className="text-lg mt-0.5">{skill.icon}</span>
                                <div>
                                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{skill.name}</p>
                                  <p className="text-[15px] text-gray-400 mt-0.5 leading-tight">{skill.desc}</p>
                                  {skill.creditsPerTx && (
                                    <p className="text-[14px] text-purple-500 dark:text-purple-400 mt-0.5">
                                      + créditos por transação conforme plano
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            {PLANS_DATA.map(plan => (
                              <td key={plan.id} className={`py-3 px-3 text-center ${currentPlan === plan.id ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}>
                                <SkillBadge
                                  avail={skill.plans[plan.id as 'free' | 'starter' | 'business' | 'enterprise']}
                                  addonPrice={skill.addonPrice[plan.id]}
                                  creditsPerTx={skill.creditsPerTx?.[plan.id]}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[15px] font-semibold">✓ Incluído</span>
                  <span>Vem com o plano, sem custo extra</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[15px] font-semibold">+€X/mês</span>
                  <span>Addon — compra no marketplace</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-300 font-bold">—</span>
                  <span>Não disponível neste plano</span>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ABA 3 — MARKETPLACE DE SKILLS
          ═══════════════════════════════════════════════════════════ */}
          {mainTab === 'marketplace' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Skills disponíveis para adicionar ao teu plano <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[currentPlan as Plan]}`}>{PLAN_LABELS[currentPlan as Plan]}</span>
                  </p>
                  {availableAddons.length === 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">
                      🎉 O teu plano já inclui todas as skills disponíveis!
                    </p>
                  )}
                </div>
              </div>

              {availableAddons.length > 0 ? (
                <>
                  {categories.map(cat => {
                    const catSkills = availableAddons.filter(s => s.category === cat);
                    if (!catSkills.length) return null;
                    return (
                      <div key={cat} className="mb-8">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                          {CATEGORY_LABELS[cat]}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {catSkills.map(skill => {
                            const price = skill.addonPrice[currentPlan];
                            const crTx = skill.creditsPerTx?.[currentPlan];
                            return (
                              <div key={skill.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                                <div className="flex items-start gap-3">
                                  <span className="text-3xl">{skill.icon}</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{skill.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{skill.detail}</p>
                                  </div>
                                </div>

                                {/* Pricing breakdown */}
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1.5">
                                  {price !== undefined && (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-500 dark:text-gray-400">Mensalidade</span>
                                      <span className="font-bold text-gray-800 dark:text-gray-200">€{price}/mês</span>
                                    </div>
                                  )}
                                  {crTx !== undefined ? (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-500 dark:text-gray-400">Consumo por transação</span>
                                      <span className="font-bold text-purple-600 dark:text-purple-400">{crTx} créditos/tx</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-500 dark:text-gray-400">Consumo por uso</span>
                                      <span className="text-gray-400">Incluído nos créditos do plano</span>
                                    </div>
                                  )}
                                </div>

                                <a
                                  href={`mailto:contact@solutions.shaklabs.tech?subject=Ativar Skill ${encodeURIComponent(skill.name)}&body=Olá, gostaria de ativar a skill ${encodeURIComponent(skill.name)} no meu plano ${PLAN_LABELS[currentPlan as Plan]}.`}
                                  className="w-full text-center text-sm py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors"
                                >
                                  Ativar skill →
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-4 p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10">
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      ⚠️ A compra de skills em self-service está em breve. Por agora, clica em <strong>"Ativar skill"</strong> para enviar um email e ativarmos manualmente em menos de 2h.
                    </p>
                  </div>
                </>
              ) : (
                /* Plano Enterprise ou sem addons — mostrar upgrade */
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">🎉</div>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Tens todas as skills!</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    O teu plano {PLAN_LABELS[currentPlan as Plan]} já inclui todas as skills disponíveis na plataforma.
                    {currentPlan !== 'enterprise' && ' Faz upgrade para Enterprise para desbloqueares as restantes.'}
                  </p>
                  {currentPlan !== 'enterprise' && (
                    <button onClick={() => openModal('enterprise', 399)}
                      className="mt-6 btn-primary px-8 py-3">
                      Upgrade para Enterprise →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* ─── Subscribe Modal ─── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {step === 'instructions' ? '📋 Instruções de Pagamento' : `Subscrever plano ${PLAN_LABELS[modal.plan as Plan]}`}
                </h3>
                {modal.price > 0 && step !== 'instructions' && (
                  <p className="text-sm text-gray-500 mt-0.5">€{modal.price}/mês · renovação automática</p>
                )}
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-5">
              {step === 'method' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Como queres pagar?</p>
                  {[
                    { id: 'ifthenpay_mbway' as const,     icon: '📱', label: 'MB Way',             sub: 'Portugal · 0.7% + €0.07', badge: 'Mais barato' },
                    { id: 'ifthenpay_multibanco' as const, icon: '🏧', label: 'Multibanco / ATM',   sub: 'Portugal · 1.5% + €0.20' },
                    { id: 'stripe' as const,               icon: '💳', label: 'Cartão Internacional', sub: 'Visa, Mastercard · 1.4% + €0.25' },
                  ].map(m => (
                    <button key={m.id} onClick={() => handleMethodChosen(m.id)} disabled={loading}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all text-left">
                      <span className="text-2xl">{m.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{m.label}</span>
                          {m.badge && <span className="text-[14px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">{m.badge}</span>}
                        </div>
                        <span className="text-xs text-gray-500">{m.sub}</span>
                      </div>
                      <span className="text-gray-300">›</span>
                    </button>
                  ))}
                  {modalError && <p className="text-sm text-red-500 mt-2">{modalError}</p>}
                </div>
              )}

              {step === 'phone' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Introduz o teu número MB Way para receber o pedido de pagamento.</p>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+351 9XXXXXXXX" autoFocus
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                  {modalError && <p className="text-sm text-red-500">{modalError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setStep('method')} className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">← Voltar</button>
                    <button onClick={handlePhoneSubmit} disabled={loading}
                      className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50">
                      {loading ? 'A processar…' : 'Confirmar →'}
                    </button>
                  </div>
                </div>
              )}

              {step === 'instructions' && instructions && (
                <div className="space-y-4">
                  {instructions.mock && (
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <span>🧪</span>
                      <p className="text-xs text-amber-700 dark:text-amber-300"><strong>Modo Teste.</strong> Sem credenciais reais. O admin pode confirmar o pagamento.</p>
                    </div>
                  )}
                  {instructions.method === 'ifthenpay_multibanco' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">🏧 Referência Multibanco</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[{ label: 'Entidade', value: instructions.multibancoEntity }, { label: 'Referência', value: instructions.multibancoReference }, { label: 'Montante', value: `€${instructions.amount.toFixed(2)}` }]
                          .map(({ label, value }) => (
                            <div key={label} className="text-center">
                              <p className="text-[14px] text-blue-500 uppercase tracking-wide">{label}</p>
                              <p className="text-sm font-bold text-blue-900 dark:text-blue-100 mt-0.5">{value}</p>
                            </div>
                          ))}
                      </div>
                      {instructions.multibancoExpiry && <p className="text-xs text-blue-500 text-center">Válido até {instructions.multibancoExpiry}</p>}
                    </div>
                  )}
                  {instructions.method === 'ifthenpay_mbway' && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200">📱 MB Way</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">Pedido enviado para <strong>{instructions.mbwayPhone}</strong></p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-2">€{instructions.amount.toFixed(2)}</p>
                      <p className="text-xs text-green-500 mt-1">Confirma na app MB Way</p>
                    </div>
                  )}
                  {instructions.method === 'stripe' && (
                    <div className="text-center space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Clica abaixo para pagar com cartão:</p>
                      {instructions.checkoutUrl ? (
                        <a href={instructions.checkoutUrl} target="_blank" rel="noopener noreferrer"
                          className="block py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
                          Pagar €{instructions.amount.toFixed(2)} →
                        </a>
                      ) : (
                        <p className="text-xs text-gray-400">Checkout não disponível (modo teste)</p>
                      )}
                    </div>
                  )}
                  {instructions.notes && <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono">{instructions.notes}</p>}
                  <button onClick={closeModal} className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200">Fechar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
