import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import { Plan, PLAN_LABELS, PLAN_COLORS } from '../../types';
import api from '../../utils/api';

const PLANS_DATA = [
  { id: 'free',       price: 0,   label: 'Free',       agents: 3,   credits: 3000,  conversations: 100 },
  { id: 'starter',    price: 39,  label: 'Starter',    agents: 10,  credits: 10000, conversations: null },
  { id: 'pro',        price: 89,  label: 'Pro',        agents: 20,  credits: 30000, conversations: null },
  { id: 'business',   price: 159, label: 'Business',   agents: 30,  credits: 60000, conversations: null },
  { id: 'enterprise', price: 259, label: 'Enterprise', agents: 999, credits: 75000, conversations: null },
] as const;

interface FeatureRow {
  label: string;
  icon: string;
  values: (string | boolean | null)[];
  note?: string;
}

const FEATURES: FeatureRow[] = [
  { label: 'Preço/mês',       icon: '💶', values: ['Grátis', '€39', '€89', '€159', '€259'] },
  { label: 'Agentes',         icon: '🤖', values: [3, 10, 20, 30, '30+'].map(String) },
  { label: 'Créditos/mês',    icon: '💳', values: ['3 000¹', '10 000', '30 000', '60 000', '75 000+'] },
  { label: 'Conversas/mês',   icon: '💬', values: ['100', 'Ilimitadas', 'Ilimitadas', 'Ilimitadas', 'Ilimitadas'] },
  { label: 'Chat Web',        icon: '🌐', values: [true, true, true, true, true] },
  { label: 'WhatsApp',        icon: '📱', values: [true, true, true, true, true] },
  { label: 'Modelos IA',      icon: '⚡', values: ['Haiku / GPT-mini', '+ Sonnet', '+ GPT-4o', '+ Gemini Pro', '+ Claude Opus'] },
  { label: 'Base de conhecimento', icon: '📚', values: [true, true, true, true, true] },
  { label: 'Documentos enviáveis', icon: '📎', values: [true, true, true, true, true] },
  // Skills
  { label: 'Skill: Handoff IA', icon: '🔀', values: [true, true, true, true, true] },
  { label: 'Skill: Recolha de dados', icon: '📋', values: [true, true, true, true, true] },
  { label: 'Skill: Agendamento', icon: '📅', values: ['+€7/mês ➕', 'Incluído', 'Incluído', 'Incluído', 'Incluído'],
    note: 'Addon mensal para plano Free; incluído no Starter+' },
  { label: 'Skill: Upload de ficheiros', icon: '📁', values: ['+€5/mês ➕', 'Incluído', 'Incluído', 'Incluído', 'Incluído'],
    note: 'Addon mensal para plano Free; incluído no Starter+' },
  { label: 'Skill: Deteção de humor', icon: '😊', values: ['+€9/mês ➕', '+€9/mês ➕', 'Incluído', 'Incluído', 'Incluído'],
    note: 'Addon mensal para Free/Starter; incluído no Pro+' },
  { label: 'Skill: Pagamentos — mensalidade', icon: '💳', values: ['—', '+€25/mês ➕', '+€15/mês ➕', '+€5/mês ➕', 'Incluído'],
    note: 'Addon mensal para acesso à skill de cobrança (MB Way, PIX e outros em breve). Incluído no Enterprise.' },
  { label: 'Skill: Pagamentos — por transação', icon: '💸', values: ['—', '50 crd', '35 crd', '20 crd', '10 crd'],
    note: 'Créditos debitados por cada transação processada, independente do método de pagamento.' },
  { label: 'Pedidos / Orders', icon: '🧾', values: [false, true, true, true, true] },
  { label: 'Relatórios avançados', icon: '📊', values: [false, false, true, true, true] },
  { label: 'API access',      icon: '🔌', values: [false, false, true, true, true] },
  { label: 'White-label / Portal próprio', icon: '🎨', values: ['—', '+€5/mês/agente ➕', '+€3/mês/agente ➕', 'Incluído', 'Incluído'],
    note: 'Página pública por agente, sem branding Agentfy. Cobrado por agente ativo.' },
  { label: 'Suporte',         icon: '🛟', values: ['Comunidade', 'Email', 'Prioritário', 'Dedicado', 'SLA 24h'] },
];

function Check({ ok, text }: { ok: boolean | string | null | undefined; text?: boolean }) {
  if (ok === null || ok === undefined || ok === false) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  if (typeof ok === 'string') {
    return <span className="text-sm text-gray-700 dark:text-gray-300">{ok}</span>;
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30">
      <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
    </span>
  );
}

export default function PlansPage() {
  const router = useRouter();
  const { tenant } = useAuth();

  // ─── Subscribe modal state ──────────────────────────────────────────────────
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

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Planos</title></Head>
      <Navigation />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Comparar Planos</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              Plano atual: <span className={`font-medium text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[tenant.plan as Plan]}`}>{PLAN_LABELS[tenant.plan as Plan]}</span>
            </p>
          </div>

          {/* Plan header cards */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 w-48">Funcionalidade</th>
                  {PLANS_DATA.map((plan) => (
                    <th key={plan.id} className={`py-4 px-3 text-center relative ${tenant.plan === plan.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                      {tenant.plan === plan.id && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">Atual</span>
                      )}
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan.id as Plan]}`}>{plan.label}</span>
                      <p className="text-lg font-bold mt-1 text-gray-900 dark:text-gray-100">
                        {plan.price === 0 ? 'Grátis' : `€${plan.price}`}
                        {plan.price > 0 && <span className="text-xs text-gray-400 font-normal">/mês</span>}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, i) => (
                  <tr key={i} className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{feature.icon}</span>
                        <div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{feature.label}</span>
                          {feature.note && <p className="text-[10px] text-gray-400 mt-0.5">{feature.note}</p>}
                        </div>
                      </div>
                    </td>
                    {feature.values.map((val, j) => (
                      <td key={j} className={`py-3 px-3 text-center ${tenant.plan === PLANS_DATA[j].id ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                        <Check ok={val} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td className="py-4 px-4" />
                  {PLANS_DATA.map((plan) => (
                    <td key={plan.id} className={`py-4 px-3 text-center ${tenant.plan === plan.id ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                      {tenant.plan === plan.id ? (
                        <span className="text-xs text-brand-600 font-medium">✓ Plano atual</span>
                      ) : (
                        <button
                          onClick={() => openModal(plan.id, plan.price)}
                          className={`w-full text-xs py-2 px-3 rounded-lg font-medium transition-colors ${
                            PLANS_DATA.findIndex(p => p.id === tenant.plan) < PLANS_DATA.findIndex(p => p.id === plan.id)
                              ? 'bg-brand-600 hover:bg-brand-700 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {PLANS_DATA.findIndex(p => p.id === tenant.plan) < PLANS_DATA.findIndex(p => p.id === plan.id)
                            ? 'Upgrade →'
                            : 'Downgrade'}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Addons callout */}
          <div className="mt-6 p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">➕ Addons mensais disponíveis</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: '📅', name: 'Agendamento', price: '€7/mês', plans: 'Free' },
                { icon: '📁', name: 'Upload de ficheiros', price: '€5/mês', plans: 'Free' },
                { icon: '😊', name: 'Deteção de humor', price: '€9/mês', plans: 'Free & Starter' },
                { icon: '🎨', name: 'White-label', price: '€5/agente/mês (Starter) · €3/agente/mês (Pro)', plans: 'Starter & Pro' },
              ].map((a) => (
                <div key={a.name} className="flex items-start gap-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-orange-100 dark:border-orange-900">
                  <span className="text-xl">{a.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{a.name}</p>
                    <p className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">{a.price}</p>
                    <p className="text-[10px] text-gray-400">Para plano {a.plans}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-3">⚠️ Compra de addons disponível em breve. Contacta suporte@agentfy.tech para ativar manualmente.</p>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            ¹ Créditos do plano Free são atribuídos uma única vez no registo e não são renovados mensalmente.
            Para obter mais créditos, faz upgrade para um plano pago.
          </p>
        </div>
      </main>
      {/* ─── Subscribe Modal ─── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
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
              {/* Step 1 — choose method */}
              {step === 'method' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Como queres pagar?</p>
                  {[
                    { id: 'ifthenpay_mbway' as const, icon: '📱', label: 'MB Way', sub: 'Portugal · 0.7% + €0.07', badge: 'Mais barato' },
                    { id: 'ifthenpay_multibanco' as const, icon: '🏧', label: 'Multibanco / ATM', sub: 'Portugal · 1.5% + €0.20' },
                    { id: 'stripe' as const, icon: '💳', label: 'Cartão de Crédito / Débito', sub: 'Internacional · 1.4% + €0.25' },
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

              {/* Step 2 — phone for MB Way */}
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
                    <button
                      onClick={handlePhoneSubmit}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {loading ? 'A processar…' : 'Confirmar →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — payment instructions */}
              {step === 'instructions' && instructions && (
                <div className="space-y-4">
                  {instructions.mock && (
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <span>🧪</span>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Modo Teste.</strong> Sem credenciais reais configuradas. O admin pode confirmar o pagamento em qualquer momento.
                      </p>
                    </div>
                  )}

                  {/* Multibanco */}
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

                  {/* MB Way */}
                  {instructions.method === 'ifthenpay_mbway' && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200">📱 MB Way</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Pedido enviado para <strong>{instructions.mbwayPhone}</strong>
                      </p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-2">€{instructions.amount.toFixed(2)}</p>
                      <p className="text-xs text-green-500 mt-1">Confirma o pagamento na app MB Way</p>
                    </div>
                  )}

                  {/* Stripe */}
                  {instructions.method === 'stripe' && (
                    <div className="text-center space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Clica abaixo para pagar com cartão:</p>
                      {instructions.checkoutUrl ? (
                        <a href={instructions.checkoutUrl} target="_blank" rel="noopener noreferrer"
                          className="block py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
                          Pagar €{instructions.amount.toFixed(2)} com Stripe →
                        </a>
                      ) : (
                        <p className="text-xs text-gray-400">Checkout não disponível (modo teste)</p>
                      )}
                    </div>
                  )}

                  {instructions.notes && (
                    <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono">{instructions.notes}</p>
                  )}

                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}    </div>
  );
}
