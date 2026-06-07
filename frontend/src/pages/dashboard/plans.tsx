import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import { Plan, PLAN_LABELS, PLAN_COLORS } from '../../types';

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
  { label: 'Skill: Agendamento', icon: '📅', values: [false, true, true, true, true] },
  { label: 'Skill: Upload de ficheiros', icon: '📁', values: [false, true, true, true, true] },
  { label: 'Skill: Deteção de humor', icon: '😊', values: [false, false, true, true, true] },
  { label: 'Skill: Cobrança MB Way', icon: '💳', values: ['Bloqueado', '25 crd/uso', '15 crd/uso', 'Incluído', 'Incluído'],
    note: 'Créditos debitados por transação iniciada pelo agente' },
  { label: 'Pedidos / Orders', icon: '🧾', values: [false, true, true, true, true] },
  { label: 'Relatórios avançados', icon: '📊', values: [false, false, true, true, true] },
  { label: 'API access',      icon: '🔌', values: [false, false, true, true, true] },
  { label: 'White-label',     icon: '🎨', values: [false, false, false, true, true] },
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
                          className={`w-full text-xs py-2 px-3 rounded-lg font-medium transition-colors ${
                            PLANS_DATA.findIndex(p => p.id === tenant.plan) < PLANS_DATA.findIndex(p => p.id === plan.id)
                              ? 'bg-brand-600 hover:bg-brand-700 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                          disabled
                        >
                          {PLANS_DATA.findIndex(p => p.id === tenant.plan) < PLANS_DATA.findIndex(p => p.id === plan.id)
                            ? 'Upgrade'
                            : 'Downgrade'}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            ¹ Créditos do plano Free são atribuídos uma única vez no registo e não são renovados mensalmente.
            Para obter mais créditos, faz upgrade para um plano pago.
          </p>
        </div>
      </main>
    </div>
  );
}
