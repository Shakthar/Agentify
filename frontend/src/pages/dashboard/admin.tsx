import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { ROUTES } from '../../utils/constants';
import { AuditLogEntry } from '../../types';
import api from '../../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlatformMetrics {
  tenants: { total: number; byPlan: Record<string, number> };
  agents: { total: number; active: number };
  conversations: { total: number; today: number };
  messages: { total: number };
  revenue: { mrr: number; arr: number };
  expenses: { monthly: number; items: Expense[] };
  balance: number;
}

interface TenantRow {
  id: string; name: string; email: string; plan: string;
  creditsTotal: number; creditsUsed: number; creditsUsedPercent: number;
  isAdmin: boolean; planPrice: number;
  _count: { agents: number; conversations: number };
  createdAt: string;
}

interface Expense {
  id: string; category: string; description: string;
  amount: number; recurring: boolean; period: string; createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAN_LABELS_LOCAL: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise',
};
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  business: 'bg-brand-100 text-brand-700',
  enterprise: 'bg-amber-100 text-amber-700',
};
const CATEGORY_LABELS: Record<string, string> = {
  hosting: '🖥️ Hosting', api: '🔌 APIs', support: '🛟 Suporte',
  marketing: '📣 Marketing', misc: '📦 Outros',
};
const ACTION_LABELS: Record<string, string> = {
  tenant_signup: 'Conta criada', agent_created: 'Agente criado',
  agent_deleted: 'Agente eliminado', agent_activated: 'Agente ativado',
  agent_deactivated: 'Agente desativado', conversation_created: 'Conversa iniciada',
  conversation_closed: 'Conversa fechada',
};
const ACTION_COLORS: Record<string, string> = {
  tenant_signup: 'bg-blue-100 text-blue-700', agent_created: 'bg-green-100 text-green-700',
  agent_deleted: 'bg-red-100 text-red-700', agent_activated: 'bg-green-100 text-green-700',
  agent_deactivated: 'bg-yellow-100 text-yellow-700', conversation_created: 'bg-purple-100 text-purple-700',
  conversation_closed: 'bg-gray-100 text-gray-700',
};

// ─── Small components ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function PlanBar({ byPlan }: { byPlan: Record<string, number> }) {
  const plans = ['free', 'starter', 'pro', 'business', 'enterprise'];
  const total = plans.reduce((s, p) => s + (byPlan[p] ?? 0), 0) || 1;
  const barColors: Record<string, string> = {
    free: 'bg-gray-400', starter: 'bg-blue-500', pro: 'bg-purple-500',
    business: 'bg-brand-600', enterprise: 'bg-amber-500',
  };
  return (
    <div className="card col-span-full">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Distribuição por plano</p>
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {plans.map((p) => {
          const count = byPlan[p] ?? 0;
          const pct = Math.round((count / total) * 100);
          if (!count) return null;
          return <div key={p} className={`${barColors[p]}`} style={{ width: `${pct}%` }} title={`${PLAN_LABELS_LOCAL[p]}: ${count} (${pct}%)`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {plans.map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className={`w-2.5 h-2.5 rounded-sm ${barColors[p]}`} />
            {PLAN_LABELS_LOCAL[p]}: <strong>{byPlan[p] ?? 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const { auditLogs, auditTotal, loading: auditLoading, fetchAuditLogs } = useAdmin();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'balance' | 'logs'>('dashboard');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [skip, setSkip] = useState(0);
  const PAGE_SIZE = 50;

  const [expForm, setExpForm] = useState({ category: 'hosting', description: '', amount: '', recurring: true, period: 'monthly' });
  const [expSaving, setExpSaving] = useState(false);

  const isAdmin = tenant?.isAdmin;

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    if (!isAdmin) { router.replace(ROUTES.agents); return; }
    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function loadDashboard() {
    setLoadingData(true);
    try {
      const [dashRes, tenantsRes] = await Promise.all([
        api.get('/api/superadmin/dashboard'),
        api.get('/api/superadmin/tenants'),
      ]);
      setMetrics(dashRes.data);
      setTenants(tenantsRes.data.tenants);
    } catch { /* ignore */ } finally { setLoadingData(false); }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expForm.description || !expForm.amount) return;
    setExpSaving(true);
    try {
      await api.post('/api/superadmin/expenses', { ...expForm, amount: parseFloat(expForm.amount) });
      setExpForm({ category: 'hosting', description: '', amount: '', recurring: true, period: 'monthly' });
      await loadDashboard();
    } catch { /* ignore */ } finally { setExpSaving(false); }
  }

  async function removeExpense(id: string) {
    await api.delete(`/api/superadmin/expenses/${id}`);
    await loadDashboard();
  }

  const handleAuditPrev = () => { const n = Math.max(0, skip - PAGE_SIZE); setSkip(n); fetchAuditLogs(n, PAGE_SIZE); };
  const handleAuditNext = () => { const n = skip + PAGE_SIZE; setSkip(n); fetchAuditLogs(n, PAGE_SIZE); };

  const tabList = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'tenants',   label: '🏢 Contas' },
    { key: 'balance',   label: '💰 Balanço' },
    { key: 'logs',      label: '📋 Auditoria' },
  ] as { key: typeof activeTab; label: string }[];

  if (!tenant || !isAdmin) return null;

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Administração</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Painel Superadmin</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Visão completa da plataforma Agentfy</p>
            </div>
            <span className="text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-3 py-1.5 rounded-full font-medium">
              🔑 {tenant.email}
            </span>
          </div>

          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1">
            {tabList.map((t) => (
              <button key={t.key} onClick={() => { setActiveTab(t.key); if (t.key === 'logs') fetchAuditLogs(0, PAGE_SIZE); }}
                className={`px-4 pb-2 text-sm font-medium transition-colors ${
                  activeTab === t.key ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {loadingData && !metrics && (
            <div className="text-center py-16 text-gray-400 text-sm">A carregar dados da plataforma...</div>
          )}

          {/* ─── Dashboard ─── */}
          {activeTab === 'dashboard' && metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KpiCard label="Contas" value={metrics.tenants.total} />
                <KpiCard label="Agentes" value={metrics.agents.total} sub={`${metrics.agents.active} ativos`} />
                <KpiCard label="Conversas" value={metrics.conversations.total} sub={`${metrics.conversations.today} hoje`} />
                <KpiCard label="Mensagens" value={metrics.messages.total.toLocaleString()} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="MRR" value={`€${metrics.revenue.mrr.toFixed(2)}`} accent="text-green-600" />
                <KpiCard label="ARR" value={`€${metrics.revenue.arr.toFixed(2)}`} accent="text-green-600" />
                <KpiCard
                  label="Balanço mensal"
                  value={`€${metrics.balance.toFixed(2)}`}
                  accent={metrics.balance >= 0 ? 'text-green-600' : 'text-red-600'}
                  sub={`Despesas: €${metrics.expenses.monthly.toFixed(2)}/mês`}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <PlanBar byPlan={metrics.tenants.byPlan} />
              </div>
            </div>
          )}

          {/* ─── Contas ─── */}
          {activeTab === 'tenants' && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    {['Conta', 'Plano', 'Agentes', 'Conversas', 'Créditos', 'MRR', 'Criada'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-xs">{t.name}</p>
                        <p className="text-[10px] text-gray-400">{t.email}{t.isAdmin && ' 🔑'}</p>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[t.plan] ?? PLAN_COLORS.free}`}>
                          {PLAN_LABELS_LOCAL[t.plan] ?? t.plan}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">{t._count.agents}</td>
                      <td className="py-2 px-3 text-xs text-gray-700 dark:text-gray-300">{t._count.conversations}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${t.creditsUsedPercent >= 90 ? 'bg-red-500' : t.creditsUsedPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${t.creditsUsedPercent}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{t.creditsUsedPercent}%</span>
                        </div>
                        <p className="text-[10px] text-gray-400">{t.creditsUsed.toLocaleString()} / {t.creditsTotal.toLocaleString()}</p>
                      </td>
                      <td className="py-2 px-3 text-xs font-medium text-green-600">€{t.planPrice}/mês</td>
                      <td className="py-2 px-3 text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString('pt-PT')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tenants.length === 0 && !loadingData && (
                <p className="text-center py-10 text-sm text-gray-400">Nenhuma conta encontrada</p>
              )}
            </div>
          )}

          {/* ─── Balanço ─── */}
          {activeTab === 'balance' && metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">💚 Receita mensal (MRR)</p>
                  <p className="text-3xl font-bold text-green-600">€{metrics.revenue.mrr.toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-1">ARR: €{metrics.revenue.arr.toFixed(2)}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">❤️ Despesas mensais</p>
                  <p className="text-3xl font-bold text-red-500">€{metrics.expenses.monthly.toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-1">{metrics.expenses.items.length} itens</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">⚖️ Balanço líquido</p>
                  <p className={`text-3xl font-bold ${metrics.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {metrics.balance >= 0 ? '+' : ''}€{metrics.balance.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{metrics.balance >= 0 ? 'Positivo ✓' : '⚠️ Negativo'}</p>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3">Receita por plano</h3>
                {['starter', 'pro', 'business', 'enterprise'].map((plan) => {
                  const PRICES: Record<string, number> = { starter: 39, pro: 89, business: 159, enterprise: 259 };
                  const count = metrics.tenants.byPlan[plan] ?? 0;
                  const rev = count * (PRICES[plan] ?? 0);
                  if (!count) return null;
                  return (
                    <div key={plan} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[plan]}`}>{PLAN_LABELS_LOCAL[plan]}</span>
                        <span className="text-xs text-gray-500">{count} conta{count !== 1 ? 's' : ''} × €{PRICES[plan]}</span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">€{rev.toFixed(2)}/mês</span>
                    </div>
                  );
                })}
                {['starter', 'pro', 'business', 'enterprise'].every((p) => !(metrics.tenants.byPlan[p] ?? 0)) && (
                  <p className="text-xs text-gray-400 py-2">Sem contas pagas ainda.</p>
                )}
              </div>

              <div className="card">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3">Despesas registadas</h3>
                {metrics.expenses.items.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Nenhuma despesa registada ainda.</p>
                ) : (
                  <div className="space-y-1 mb-4">
                    {metrics.expenses.items.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                            {CATEGORY_LABELS[exp.category] ?? exp.category} — {exp.description}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {exp.recurring ? `Recorrente (${exp.period === 'monthly' ? 'mensal' : 'anual'})` : 'Pontual'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-red-500">
                            €{exp.period === 'yearly' ? (exp.amount / 12).toFixed(2) : exp.amount.toFixed(2)}/mês
                            {exp.period === 'yearly' && <span className="text-[10px] text-gray-400 ml-1">(€{exp.amount}/ano)</span>}
                          </span>
                          <button onClick={() => removeExpense(exp.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={addExpense} className="border-t border-gray-100 dark:border-gray-700 pt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Categoria</label>
                    <select className="input text-xs" value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-1">Descrição</label>
                    <input className="input text-xs" placeholder="ex: Railway hosting" value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Valor (€)</label>
                    <input className="input text-xs" type="number" step="0.01" min="0" placeholder="0.00" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="block text-[10px] text-gray-500">Período</label>
                    <div className="flex gap-1.5">
                      <select className="input text-xs flex-1" value={expForm.period} onChange={(e) => setExpForm((f) => ({ ...f, period: e.target.value }))}>
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        <input type="checkbox" checked={expForm.recurring} onChange={(e) => setExpForm((f) => ({ ...f, recurring: e.target.checked }))} />
                        Rec.
                      </label>
                    </div>
                    <button type="submit" disabled={expSaving} className="btn-primary text-xs mt-0.5">
                      {expSaving ? '...' : '+ Adicionar'}
                    </button>
                  </div>
                </form>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 mb-1">💡 Despesas típicas a registar</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                    <span>🖥️ Railway ~€20/mês</span><span>🗄️ Supabase Pro €25/mês</span>
                    <span>🤖 Anthropic API: variável</span><span>🤖 OpenAI API: variável</span>
                    <span>🌐 Vercel Pro €20/mês</span><span>📱 Meta WA: grátis até 1000/mês</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Auditoria ─── */}
          {activeTab === 'logs' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Registos de Auditoria</h2>
                <span className="text-xs text-gray-400">{auditTotal} entradas</span>
              </div>
              <div className="card overflow-hidden p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      {['Data', 'Ação', 'Tipo', 'ID'].map((h) => (
                        <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: AuditLogEntry) => {
                      const label = ACTION_LABELS[log.action] ?? log.action;
                      const color = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700';
                      const d = new Date(log.createdAt);
                      return (
                        <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="py-2 px-4 text-xs text-gray-400 whitespace-nowrap">
                            {d.toLocaleDateString('pt-PT')} {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span></td>
                          <td className="py-2 px-4 text-xs text-gray-500">{log.resourceType ?? '—'}</td>
                          <td className="py-2 px-4 text-xs text-gray-400 font-mono">{log.resourceId?.slice(-8) ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={handleAuditPrev} disabled={skip === 0 || auditLoading} className="text-xs text-brand-600 disabled:text-gray-300 hover:underline">← Anterior</button>
                  <span className="text-xs text-gray-400">{skip + 1}–{Math.min(skip + PAGE_SIZE, auditTotal)} de {auditTotal}</span>
                  <button onClick={handleAuditNext} disabled={skip + PAGE_SIZE >= auditTotal || auditLoading} className="text-xs text-brand-600 disabled:text-gray-300 hover:underline">Próximo →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-2 px-4 text-xs text-gray-400 whitespace-nowrap">
        {date.toLocaleDateString('pt-PT')} {date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="py-2 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
      </td>
      <td className="py-2 px-4 text-xs text-gray-500">{log.resourceType ?? '—'}</td>
      <td className="py-2 px-4 text-xs text-gray-400 font-mono">{log.resourceId?.slice(-8) ?? '—'}</td>
    </tr>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const { metrics, auditLogs, auditTotal, loading, error, fetchMetrics, fetchAuditLogs } = useAdmin();
  const [skip, setSkip] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    fetchMetrics();
    fetchAuditLogs(0, PAGE_SIZE);
  }, []);

  if (!tenant) return null;

  const handlePrev = () => {
    const newSkip = Math.max(0, skip - PAGE_SIZE);
    setSkip(newSkip);
    fetchAuditLogs(newSkip, PAGE_SIZE);
  };

  const handleNext = () => {
    const newSkip = skip + PAGE_SIZE;
    setSkip(newSkip);
    fetchAuditLogs(newSkip, PAGE_SIZE);
  };

  return (
    <div className="flex min-h-screen">
      <Navigation />
      <Head><title>Agentfy — Administração</title></Head>
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Painel de Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Métricas e registos de auditoria da sua conta</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Metrics */}
          {metrics ? (
            <>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Agentes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <MetricCard label="Total" value={metrics.agents.total} />
                <MetricCard label="Ativos" value={metrics.agents.active} />
                <MetricCard label="Inativos" value={metrics.agents.total - metrics.agents.active} />
              </div>

              <h2 className="text-base font-semibold text-gray-700 mb-3">Conversas</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <MetricCard label="Total" value={metrics.conversations.total} />
                <MetricCard label="Hoje" value={metrics.conversations.today} />
                <MetricCard label="Abertas" value={metrics.conversations.open} />
                <MetricCard label="Mensagens" value={metrics.messages.total} />
              </div>

              <h2 className="text-base font-semibold text-gray-700 mb-3">Créditos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                <MetricCard label="Total" value={metrics.credits.total} />
                <MetricCard label="Usados" value={metrics.credits.used} />
                <MetricCard label="Disponíveis" value={metrics.credits.available} />
                <MetricCard
                  label="Utilização"
                  value={`${metrics.credits.usedPercent}%`}
                  sub={metrics.credits.usedPercent >= 90 ? 'Atenção: quase esgotado' : undefined}
                />
              </div>
            </>
          ) : loading ? (
            <p className="text-gray-400 text-sm mb-8">A carregar métricas...</p>
          ) : null}

          {/* Audit Logs */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">Registos de Auditoria</h2>
            <span className="text-xs text-gray-400">{auditTotal} entradas no total</span>
          </div>

          {auditLogs.length === 0 && !loading ? (
            <div className="card text-center py-10 text-gray-400 text-sm">
              Nenhum registo de auditoria ainda
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Data</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Ação</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Tipo</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <button
                  onClick={handlePrev}
                  disabled={skip === 0 || loading}
                  className="text-xs text-brand-600 disabled:text-gray-300 hover:underline"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-gray-400">
                  {skip + 1}–{Math.min(skip + PAGE_SIZE, auditTotal)} de {auditTotal}
                </span>
                <button
                  onClick={handleNext}
                  disabled={skip + PAGE_SIZE >= auditTotal || loading}
                  className="text-xs text-brand-600 disabled:text-gray-300 hover:underline"
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
