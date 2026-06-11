import { useState } from 'react';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { Plan, PLAN_LABELS, PLAN_COLORS } from '../../types';
import api from '../../utils/api';

// ─── Planos ───────────────────────────────────────────────────────────────────
const PLANS_DATA = [
  {
    id: 'free',
    label: 'Free',
    price: 0,
    credits: 1000,
    creditsLabel: '1.000 (única vez)',
    agents: 1,
    whatsapp: 1,
    renewable: false,
    highlight: false,
    badge: null,
    creditsPerEur: null,
  },
  {
    id: 'starter',
    label: 'Starter',
    price: 59,
    credits: 5000,
    creditsLabel: '5.000 / mês',
    agents: 1,
    whatsapp: 1,
    renewable: true,
    highlight: false,
    badge: 'Para começar',
    creditsPerEur: 0.0118,
  },
  {
    id: 'business',
    label: 'Business',
    price: 159,
    credits: 15000,
    creditsLabel: '15.000 / mês',
    agents: 3,
    whatsapp: 3,
    renewable: true,
    highlight: true,
    badge: 'Mais popular',
    creditsPerEur: 0.0106,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 399,
    credits: 40000,
    creditsLabel: '40.000 / mês',
    agents: 10,
    whatsapp: 10,
    renewable: true,
    highlight: false,
    badge: 'Grande operação',
    creditsPerEur: 0.00998,
  },
] as const;

interface FeatureRow {
  label: string;
  icon: string;
  values: (string | boolean | null)[];
  note?: string;
}

const FEATURES: FeatureRow[] = [
  { label: 'Preço/mês',            icon: '💶', values: ['Grátis', '€59', '€159', '€399'] },
  { label: 'Créditos',             icon: '💳', values: ['1.000 ¹', '5.000/mês', '15.000/mês', '40.000/mês'] },
  { label: 'Custo/crédito',        icon: '📊', values: ['—', '€0.0118', '€0.0106', '€0.01'], note: 'Quanto mais alto o plano, mais barato fica cada crédito' },
  { label: 'Agentes',              icon: '🤖', values: ['1', '1', '3', '10'], note: '1 agente = 1 número WhatsApp. Pode adicionar mais como addon.' },
  { label: 'Números WhatsApp',     icon: '📱', values: ['1', '1', '3', '10'] },
  { label: 'Chat Web',             icon: '🌐', values: [true, true, true, true] },
  { label: 'Modelos IA',           icon: '⚡', values: ['Haiku / GPT-mini', '+ Sonnet', '+ GPT-4o + Gemini', '+ Claude Opus'], note: 'Auto-routing escolhe o modelo mais barato para cada tipo de conversa' },
  { label: 'Base de conhecimento', icon: '📚', values: [true, true, true, true], note: 'PDF, Word, Excel, PPT, YouTube, Páginas web' },
  // Skills
  { label: 'Skill: Handoff para humano', icon: '🔀', values: [true, true, true, true] },
  { label: 'Skill: Recolha de dados',    icon: '📋', values: [true, true, true, true] },
  { label: 'Skill: Delivery / pedidos',  icon: '🛵', values: [true, true, true, true] },
  { label: 'Skill: Upload de ficheiros', icon: '📁', values: ['+€8/mês ➕', 'Incluído', 'Incluído', 'Incluído'] },
  { label: 'Skill: Detecção de humor',   icon: '😊', values: ['—', '+€9/mês ➕', 'Incluído', 'Incluído'],
    note: 'Detecta frustração, irritação e outros estados. Aciona handoff automático.' },
  { label: 'Skill: Vendas / Upselling',  icon: '🏷️', values: ['—', '+€20/mês ➕', 'Incluído', 'Incluído'] },
  { label: 'Skill: Pagamentos — acesso', icon: '💳', values: ['—', '+€15/mês ➕', 'Incluído', 'Incluído'],
    note: 'MB Way, PIX, Cartão e outros em breve. Ativa o processamento de pagamentos.' },
  { label: 'Skill: Pagamentos — por tx', icon: '💸', values: ['—', '50 crd/tx', '20 crd/tx', '10 crd/tx'],
    note: 'Créditos debitados por cada transação processada.' },
  { label: 'Skill: Feedback',            icon: '⭐', values: ['—', '+€12/mês ➕', '+€12/mês ➕', 'Incluído'] },
  { label: 'Skill: Análises avançadas',  icon: '📊', values: ['—', '+€18/mês ➕', '+€18/mês ➕', 'Incluído'] },
  { label: 'Skill: Lead Generation',     icon: '🎯', values: ['—', '—', '+€25/mês ➕', 'Incluído'] },
  { label: 'Skill: Custom',              icon: '⚙️', values: ['—', '—', '+€30/mês ➕', 'Incluído'] },
  { label: 'Rollover de créditos',       icon: '🔄', values: ['—', '➕ Addon', '➕ Addon', '➕ Addon'],
    note: 'Paga 85% do valor dos créditos não usados para os transferir para o mês seguinte. Válido 2 meses.' },
  { label: 'Créditos extras (on-demand)', icon: '⚡', values: ['—', '€0.0118/crd', '€0.0106/crd', '€0.01/crd'],
    note: 'Compra créditos adicionais quando precisas. Disponíveis de imediato.' },
  { label: 'Agentes extras (addon)',     icon: '🤖', values: ['—', '+€20/agente/mês ²', '+€15/agente/mês ²', '+€10/agente/mês'] },
  { label: 'White-label / Portal',       icon: '🎨', values: ['—', '+€5/agente/mês ➕', '+€3/agente/mês ➕', 'Incluído'],
    note: 'Página pública por agente sem branding Agentfy.' },
  { label: 'API Access',                 icon: '🔌', values: [false, false, true, true] },
  { label: 'Histórico de conversas',     icon: '💬', values: ['30 dias', '90 dias', '1 ano', 'Ilimitado'] },
  { label: 'Suporte',                    icon: '🛟', values: ['Comunidade', 'Email', 'Email prioritário', 'SLA 24h'] },
];

function Cell({ ok }: { ok: boolean | string | null | undefined }) {
  if (ok === null || ok === undefined || ok === false) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  if (typeof ok === 'string') {
    const isAddon = ok.includes('➕');
    return (
      <span className={`text-xs ${isAddon ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
        {ok}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30">
      <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
    </span>
  );
}

export default function PlansPage() {
  const { tenant } = useAuth();

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

  const currentIdx = PLANS_DATA.findIndex(p => p.id === tenant.plan);

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentify — Planos e Preços</title></Head>
      <Navigation />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Planos e Preços</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Plano atual: <span className={`font-medium text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[tenant.plan as Plan]}`}>{PLAN_LABELS[tenant.plan as Plan]}</span>
              {' · '}Quanto mais alto o plano, mais barato fica cada crédito.
            </p>
          </div>

          {/* Plan cards (quick overview) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {PLANS_DATA.map((plan) => {
              const isCurrent = tenant.plan === plan.id;
              const isUpgrade = currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id);
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-5 flex flex-col gap-3 transition-all
                    ${plan.highlight ? 'border-brand-500 shadow-md' : 'border-gray-200 dark:border-gray-700'}
                    ${isCurrent ? 'bg-brand-50 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-900'}`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap
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
                    {plan.creditsPerEur && (
                      <p className="text-green-600 dark:text-green-400 font-medium">€{plan.creditsPerEur.toFixed(4)}/crédito</p>
                    )}
                    {!plan.renewable && (
                      <p className="text-amber-600 dark:text-amber-400">⚠️ Créditos únicos</p>
                    )}
                  </div>
                  {isCurrent ? (
                    <span className="text-center text-xs text-brand-600 dark:text-brand-400 font-medium py-1.5 bg-brand-100 dark:bg-brand-900/30 rounded-lg">✓ Plano atual</span>
                  ) : (
                    <button
                      onClick={() => plan.price > 0 && openModal(plan.id, plan.price)}
                      className={`text-xs py-2 px-3 rounded-lg font-medium transition-colors
                        ${isUpgrade
                          ? 'bg-brand-600 hover:bg-brand-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'}`}
                    >
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
                { label: 'Conversa com pedido + pagamento', cost: '~25-30 créditos' },
                { label: 'Conversa complexa (6+ trocas)', cost: '~20+ créditos' },
              ].map(ex => (
                <div key={ex.label} className="bg-white dark:bg-blue-900/20 rounded-lg p-2.5">
                  <p className="text-blue-500 dark:text-blue-400">{ex.label}</p>
                  <p className="font-bold mt-0.5">{ex.cost}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-2">
              💡 O auto-routing de IA escolhe automaticamente o modelo mais barato para cada tipo de mensagem, poupando até 60% dos créditos.
            </p>
          </div>

          {/* Full comparison table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 w-52">Funcionalidade</th>
                  {PLANS_DATA.map((plan) => (
                    <th key={plan.id} className={`py-3 px-3 text-center relative ${tenant.plan === plan.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                      {tenant.plan === plan.id && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">Atual</span>
                      )}
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan.id as Plan]}`}>{plan.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, i) => (
                  <tr key={i} className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-gray-800/20'}`}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-start gap-1.5">
                        <span className="text-sm mt-0.5">{feature.icon}</span>
                        <div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{feature.label}</span>
                          {feature.note && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{feature.note}</p>}
                        </div>
                      </div>
                    </td>
                    {feature.values.map((val, j) => (
                      <td key={j} className={`py-2.5 px-3 text-center ${tenant.plan === PLANS_DATA[j].id ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}>
                        <Cell ok={val} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                  <td className="py-4 px-4" />
                  {PLANS_DATA.map((plan) => (
                    <td key={plan.id} className={`py-4 px-3 text-center ${tenant.plan === plan.id ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}>
                      {tenant.plan === plan.id ? (
                        <span className="text-xs text-brand-600 font-medium">✓ Plano atual</span>
                      ) : (
                        <button
                          onClick={() => plan.price > 0 && openModal(plan.id, plan.price)}
                          className={`w-full text-xs py-2 px-3 rounded-lg font-medium transition-colors
                            ${currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id)
                              ? 'bg-brand-600 hover:bg-brand-700 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                          {plan.price === 0 ? 'Grátis' : currentIdx < PLANS_DATA.findIndex(p => p.id === plan.id) ? 'Upgrade →' : 'Downgrade'}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Addons callout */}
          <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 mb-4">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-3">➕ Addons disponíveis</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { icon: '🤖', name: 'Agentes extras', desc: 'Starter: +€20/agente (máx 3 total) · Business: +€15/agente (máx 10) · Enterprise: +€10/agente' },
                { icon: '⚡', name: 'Créditos extras (on-demand)', desc: 'Starter: €0.0118/créd · Business: €0.0106/créd · Enterprise: €0.01/créd. Disponíveis imediatamente.' },
                { icon: '🔄', name: 'Rollover de créditos', desc: 'Transfere créditos não usados para o mês seguinte com 15% de desconto. Válidos por 2 meses.' },
                { icon: '😊', name: 'Detecção de humor', desc: '€9/mês no Starter. Detecta frustração e aciona handoff automático para humano.' },
                { icon: '🏷️', name: 'Vendas / Upselling', desc: '€20/mês no Starter. Ativa a skill de vendas proativas e cross-selling.' },
                { icon: '💳', name: 'Pagamentos', desc: '€15/mês no Starter. Processamento de pagamentos via MB Way, PIX, Cartão.' },
              ].map((a) => (
                <div key={a.name} className="flex items-start gap-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-orange-100 dark:border-orange-900">
                  <span className="text-xl mt-0.5">{a.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{a.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-3">
              ⚠️ Compra de addons disponível em breve. Contacta contact@solutions.shaklabs.tech para ativar manualmente.
            </p>
          </div>

          {/* Notes */}
          <div className="text-[11px] text-gray-400 space-y-1 mt-2">
            <p>¹ Créditos Free são atribuídos uma única vez no registo e não renovam mensalmente. Faz upgrade para obter créditos renováveis.</p>
            <p>² Starter: máximo 3 agentes total (1 base + 2 extras). Business: máximo 10 agentes total (3 base + 7 extras).</p>
            <p>· 1 Agente = 1 número WhatsApp. Um agente pode conectar a múltiplas plataformas (Shopify, iFood, etc.).</p>
          </div>
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
                    { id: 'ifthenpay_mbway' as const,      icon: '📱', label: 'MB Way',                  sub: 'Portugal · 0.7% + €0.07', badge: 'Mais barato' },
                    { id: 'ifthenpay_multibanco' as const,  icon: '🏧', label: 'Multibanco / ATM',        sub: 'Portugal · 1.5% + €0.20' },
                    { id: 'stripe' as const,                icon: '💳', label: 'Cartão Internacional',    sub: 'Visa, Mastercard · 1.4% + €0.25' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleMethodChosen(m.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all text-left"
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{m.label}</span>
                          {m.badge && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">{m.badge}</span>}
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Introduz o teu número MB Way para receber o pedido de pagamento.
                  </p>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+351 9XXXXXXXX"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                  {modalError && <p className="text-sm text-red-500">{modalError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setStep('method')} className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">← Voltar</button>
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
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Modo Teste.</strong> Sem credenciais reais. O admin pode confirmar o pagamento.
                      </p>
                    </div>
                  )}
                  {instructions.method === 'ifthenpay_multibanco' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">🏧 Referência Multibanco</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Entidade', value: instructions.multibancoEntity },
                          { label: 'Referência', value: instructions.multibancoReference },
                          { label: 'Montante', value: `€${instructions.amount.toFixed(2)}` },
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center">
                            <p className="text-[10px] text-blue-500 uppercase tracking-wide">{label}</p>
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
                  {instructions.notes && (
                    <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono">{instructions.notes}</p>
                  )}
                  <button onClick={closeModal} className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200">
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
