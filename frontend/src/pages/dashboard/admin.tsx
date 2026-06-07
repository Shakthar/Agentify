import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { ROUTES } from '../../utils/constants';
import { AuditLogEntry } from '../../types';
import api from '../../utils/api';

// ─── PricingConfig (mirrors backend) ─────────────────────────────────────────
interface FeaturePlanConfig {
  mode: 'disabled' | 'addon' | 'included';
  price?: number;
  creditsPerTx?: number;
}
interface PricingConfig {
  plans: Record<string, PC>;
  features: {
    scheduling:     Record<string, FeaturePlanConfig>;
    fileUpload:     Record<string, FeaturePlanConfig>;
    humorDetection: Record<string, FeaturePlanConfig>;
    payments:       Record<string, FeaturePlanConfig>;
    whitelabel:     Record<string, FeaturePlanConfig>;
  };
}
interface PC { price: number; credits: number; agents: number }

// ─── Tenant detail ────────────────────────────────────────────────────────────
interface AgentDetail {
  id: string; name: string; model: string; isActive: boolean; whitelabelEnabled: boolean;
  skillHandoff: boolean; skillDataCollection: boolean; skillScheduling: boolean;
  skillFileUpload: boolean; skillHumorDetection: boolean;
  whatsappEnabled: boolean; webChatEnabled: boolean;
  _count: { conversations: number; orders: number };
  createdAt: string;
}
interface TenantDetail {
  id: string; name: string; email: string; plan: string; companyName: string | null;
  phone: string | null; vatNumber: string | null; addressCity: string | null; addressCountry: string | null;
  creditsTotal: number; creditsUsed: number; creditsAvailable: number; creditsUsedPercent: number;
  planPrice: number; isAdmin: boolean; paymentStatus: string; twoFactorEnabled: boolean;
  brandColor: string | null; logoUrl: string | null; domain: string | null;
  agents: AgentDetail[];
  _count: { conversations: number; orders: number };
  createdAt: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlatformMetrics {
  tenants: { total: number; byPlan: Record<string, number> };
  agents: { total: number; active: number };
  conversations: { total: number; today: number };
  messages: { total: number };
  revenue: { mrr: number; arr: number };
  expenses: { monthly: number; items: Expense[] };
  usage: {
    creditsConsumed: number;   // créditos internos (unidade virtual)
    inputTokens: number;       // tokens reais enviados ao LLM
    outputTokens: number;      // tokens reais recebidos do LLM
    realApiCostEur: number;    // custo real em EUR pago à Anthropic/OpenAI
  };
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

function SkillBadge({ label, active, highlight }: { label: string; active: boolean; highlight?: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      !active ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 line-through' :
      highlight ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' :
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    }`}>{label}</span>
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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'balance' | 'pricing' | 'logs'>('dashboard');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [skip, setSkip] = useState(0);
  const PAGE_SIZE = 50;

  const [expForm, setExpForm] = useState({ category: 'hosting', description: '', amount: '', recurring: true, period: 'monthly' });
  const [expSaving, setExpSaving] = useState(false);

  // Pricing config state
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMsg, setPricingMsg] = useState('');

  // Tenant detail state
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [tenantDetailLoading, setTenantDetailLoading] = useState(false);
  const [planChanging, setPlanChanging] = useState(false);

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

  async function loadPricing() {
    try { const r = await api.get('/api/superadmin/config'); setPricing(r.data); } catch { /* ignore */ }
  }

  async function savePricing() {
    if (!pricing) return;
    setPricingSaving(true); setPricingMsg('');
    try {
      const r = await api.patch('/api/superadmin/config', pricing);
      setPricing(r.data);
      setPricingMsg('Guardado com sucesso!');
      setTimeout(() => setPricingMsg(''), 3000);
    } catch { setPricingMsg('Erro ao guardar.'); }
    finally { setPricingSaving(false); }
  }

  // Draft values: track raw string while typing so inputs don't snap back to 0
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  function getDraftVal(path: string[], committed: number | undefined): string {
    const k = path.join('.');
    return draftValues[k] !== undefined ? draftValues[k] : String(committed ?? 0);
  }

  function handleNumBlur(path: string[], val: string) {
    const k = path.join('.');
    const v = parseFloat(val);
    if (isNaN(v) || v < 0) commitNum(path, 0);
    setDraftValues(d => { const next = { ...d }; delete next[k]; return next; });
  }

  function pNum(path: string[], val: string) {
    setDraftValues(d => ({ ...d, [path.join('.')]: val }));
    const v = parseFloat(val);
    if (!isNaN(v) && v >= 0) commitNum(path, v);
  }

  function commitNum(path: string[], v: number) {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as PricingConfig;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = v;
      return next;
    });
  }

  function pMode(feature: string, plan: string, val: string) {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as PricingConfig;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next.features as any)[feature][plan].mode = val;
      return next;
    });
  }

  async function openTenantDetail(id: string) {
    if (selectedTenant?.id === id) { setSelectedTenant(null); return; }
    setTenantDetailLoading(true);
    try {
      const r = await api.get(`/api/superadmin/tenants/${id}`);
      setSelectedTenant(r.data);
    } catch { /* ignore */ }
    finally { setTenantDetailLoading(false); }
  }

  async function changePlan(tenantId: string, plan: string) {
    setPlanChanging(true);
    try {
      await api.patch(`/api/superadmin/tenants/${tenantId}/plan`, { plan });
      await openTenantDetail(tenantId);
      await loadDashboard();
    } catch { /* ignore */ }
    finally { setPlanChanging(false); }
  }

  const tabList = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'tenants',   label: '🏢 Contas' },
    { key: 'balance',   label: '💰 Balanço' },
    { key: 'pricing',   label: '🏷️ Preços' },
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
              <button key={t.key} onClick={() => {
                setActiveTab(t.key);
                if (t.key === 'logs') fetchAuditLogs(0, PAGE_SIZE);
                if (t.key === 'pricing' && !pricing) loadPricing();
              }}
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
                  sub={`Despesas fixas: €${metrics.expenses.monthly.toFixed(2)}/mês`}
                />
              </div>
              {/* Créditos vs custo real LLM */}
              <div className="card">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  🤖 Consumo LLM — créditos internos vs custo real API
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Créditos consumidos</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {(metrics.usage?.creditsConsumed ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">unidade virtual</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Tokens enviados</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {((metrics.usage?.inputTokens ?? 0) / 1000).toFixed(1)}K
                    </p>
                    <p className="text-[10px] text-gray-400">input tokens</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Tokens recebidos</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {((metrics.usage?.outputTokens ?? 0) / 1000).toFixed(1)}K
                    </p>
                    <p className="text-[10px] text-gray-400">output tokens</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Custo real API</p>
                    <p className="text-xl font-bold text-red-500">
                      €{(metrics.usage?.realApiCostEur ?? 0).toFixed(4)}
                    </p>
                    <p className="text-[10px] text-gray-400">EUR pago à Anthropic/OpenAI</p>
                  </div>
                </div>
                {(metrics.usage?.creditsConsumed ?? 0) > 0 && (
                  <p className="text-[10px] text-gray-400 mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                    💡 Eficiência: €{((metrics.usage?.realApiCostEur ?? 0) / (metrics.usage?.creditsConsumed ?? 1) * 1000).toFixed(4)} por 1 000 créditos consumidos
                    {' · '}Receita por 1 000 créditos: €{(metrics.revenue.mrr / ((metrics.usage?.creditsConsumed ?? 1) / 1000)).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <PlanBar byPlan={metrics.tenants.byPlan} />
              </div>
            </div>
          )}

          {/* ─── Contas ─── */}
          {activeTab === 'tenants' && (
            <div className="space-y-2">
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      {['Conta', 'Plano', 'Agentes', 'Conversas', 'Créditos', 'MRR', 'Criada', ''].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <Fragment key={t.id}>
                        <tr key={t.id} className={`border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${selectedTenant?.id === t.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                          onClick={() => openTenantDetail(t.id)}>
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
                          </td>
                          <td className="py-2 px-3 text-xs font-medium text-green-600">€{t.planPrice}/mês</td>
                          <td className="py-2 px-3 text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString('pt-PT')}</td>
                          <td className="py-2 px-3 text-xs text-brand-500">{selectedTenant?.id === t.id ? '▲' : '▼'}</td>
                        </tr>

                        {/* Inline detail row */}
                        {selectedTenant?.id === t.id && (
                          <tr key={`detail-${t.id}`}>
                            <td colSpan={8} className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 p-0">
                              {tenantDetailLoading ? (
                                <div className="py-6 text-center text-xs text-gray-400">A carregar...</div>
                              ) : (
                                <div className="p-4 space-y-4">
                                  {/* Header info */}
                                  <div className="flex flex-wrap gap-4 items-start">
                                    <div className="flex-1 min-w-[200px]">
                                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedTenant.companyName || selectedTenant.name}</p>
                                      <p className="text-[10px] text-gray-400">{selectedTenant.email}</p>
                                      {selectedTenant.phone && <p className="text-[10px] text-gray-400">📱 {selectedTenant.phone}</p>}
                                      {selectedTenant.vatNumber && <p className="text-[10px] text-gray-400">NIF: {selectedTenant.vatNumber}</p>}
                                      {selectedTenant.domain && <p className="text-[10px] text-gray-400">🌐 {selectedTenant.domain}</p>}
                                      <div className="flex gap-2 mt-1">
                                        {selectedTenant.twoFactorEnabled && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">2FA ✓</span>}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedTenant.paymentStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                          Billing: {selectedTenant.paymentStatus}
                                        </span>
                                      </div>
                                    </div>
                                    {/* Credits */}
                                    <div className="min-w-[160px]">
                                      <p className="text-[10px] text-gray-500 mb-1">Créditos</p>
                                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-1">
                                        <div className={`h-full rounded-full ${selectedTenant.creditsUsedPercent >= 90 ? 'bg-red-500' : selectedTenant.creditsUsedPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                          style={{ width: `${selectedTenant.creditsUsedPercent}%` }} />
                                      </div>
                                      <p className="text-[10px] text-gray-500">{selectedTenant.creditsUsed.toLocaleString()} / {selectedTenant.creditsTotal.toLocaleString()} ({selectedTenant.creditsUsedPercent}%)</p>
                                      <p className="text-[10px] text-gray-400">Disponível: {selectedTenant.creditsAvailable.toLocaleString()}</p>
                                    </div>
                                    {/* Plan change */}
                                    <div className="min-w-[160px]">
                                      <p className="text-[10px] text-gray-500 mb-1">Alterar plano</p>
                                      <div className="flex gap-1">
                                        <select
                                          defaultValue={selectedTenant.plan}
                                          id={`plan-select-${selectedTenant.id}`}
                                          className="input text-xs flex-1"
                                        >
                                          {['free','starter','pro','business','enterprise'].map(p => (
                                            <option key={p} value={p}>{PLAN_LABELS_LOCAL[p]}</option>
                                          ))}
                                        </select>
                                        <button
                                          disabled={planChanging}
                                          onClick={() => {
                                            const sel = document.getElementById(`plan-select-${selectedTenant.id}`) as HTMLSelectElement;
                                            changePlan(selectedTenant.id, sel.value);
                                          }}
                                          className="btn-primary text-xs px-2 py-1"
                                        >
                                          {planChanging ? '...' : '✓'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Agents + skills */}
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                      Agentes ({selectedTenant.agents.length}) · Conversas: {selectedTenant._count.conversations} · Pedidos: {selectedTenant._count.orders}
                                    </p>
                                    {selectedTenant.agents.length === 0 && (
                                      <p className="text-xs text-gray-400">Sem agentes criados.</p>
                                    )}
                                    <div className="space-y-2">
                                      {selectedTenant.agents.map((agent) => (
                                        <div key={agent.id} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-1.5 h-1.5 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                              <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{agent.name}</span>
                                              <span className="text-[10px] text-gray-400">{agent.model.split('-').slice(0,2).join('-')}</span>
                                            </div>
                                            <div className="flex gap-1 text-[10px]">
                                              <span className="text-gray-400">{agent._count.conversations} conv.</span>
                                              {agent._count.orders > 0 && <span className="text-green-600">{agent._count.orders} pedidos</span>}
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {agent.webChatEnabled   && <SkillBadge label="Web"       active />}
                                            {agent.whatsappEnabled  && <SkillBadge label="WA"        active />}
                                            <SkillBadge label="Handoff"    active={agent.skillHandoff} />
                                            <SkillBadge label="Dados"      active={agent.skillDataCollection} />
                                            <SkillBadge label="Agenda"     active={agent.skillScheduling} />
                                            <SkillBadge label="Upload"     active={agent.skillFileUpload} />
                                            <SkillBadge label="Humor"      active={agent.skillHumorDetection} />
                                            <SkillBadge label="Whitelabel" active={agent.whitelabelEnabled} highlight />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                {tenants.length === 0 && !loadingData && (
                  <p className="text-center py-10 text-sm text-gray-400">Nenhuma conta encontrada</p>
                )}
              </div>
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
                  <p className="text-xs text-gray-500 mb-1">❤️ Despesas fixas/mês</p>
                  <p className="text-3xl font-bold text-red-500">€{metrics.expenses.monthly.toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-1">{metrics.expenses.items.length} itens registados</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">⚖️ Balanço líquido</p>
                  <p className={`text-3xl font-bold ${metrics.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {metrics.balance >= 0 ? '+' : ''}€{metrics.balance.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{metrics.balance >= 0 ? 'Positivo ✓' : '⚠️ Negativo'}</p>
                </div>
              </div>

              {/* Custo real LLM (variável) */}
              <div className="card border border-orange-100 dark:border-orange-900/30">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3">
                  🔌 Custo variável LLM — rastreado automaticamente
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Créditos consumidos</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {(metrics.usage?.creditsConsumed ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">unidades internas</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Input tokens</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {((metrics.usage?.inputTokens ?? 0) / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Output tokens</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {((metrics.usage?.outputTokens ?? 0) / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Custo real pago (EUR)</p>
                    <p className="text-lg font-bold text-orange-600">
                      €{(metrics.usage?.realApiCostEur ?? 0).toFixed(4)}
                    </p>
                    <p className="text-[10px] text-gray-400">à Anthropic / OpenAI</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 bg-orange-50 dark:bg-orange-900/10 rounded p-2">
                  ℹ️ Os créditos são a moeda interna da plataforma. O custo real EUR é calculado pelos tokens efetivamente processados × preço do modelo.
                  Os planos de Anthropic/OpenAI nas despesas abaixo são estimativas manuais — compare com este valor rastreado.
                </p>
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

          {/* ─── Preços ─── */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              {!pricing && <div className="text-center py-10 text-gray-400 text-sm">A carregar configuração...</div>}
              {pricing && (
                <>
                  {pricingMsg && (
                    <div className={`text-sm px-4 py-2 rounded-lg ${pricingMsg.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {pricingMsg}
                    </div>
                  )}

                  {/* Planos base */}
                  <div className="card">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">📦 Planos — preço, créditos e agentes</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <th className="text-left py-2 text-xs text-gray-500 w-24">Plano</th>
                            <th className="text-left py-2 text-xs text-gray-500">Preço (€/mês)</th>
                            <th className="text-left py-2 text-xs text-gray-500">Créditos/mês</th>
                            <th className="text-left py-2 text-xs text-gray-500">Agentes máx.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(['free','starter','pro','business','enterprise'] as const).map((plan) => (
                            <tr key={plan} className="border-b border-gray-50 dark:border-gray-700/50">
                              <td className="py-2 pr-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[plan]}`}>{PLAN_LABELS_LOCAL[plan]}</span>
                              </td>
                              <td className="py-2 pr-3"><input type="number" min="0" step="1" className="input text-xs w-24"
                                value={getDraftVal(['plans', plan, 'price'], pricing.plans[plan]?.price)}
                                onChange={(e) => pNum(['plans', plan, 'price'], e.target.value)}
                                onBlur={(e) => handleNumBlur(['plans', plan, 'price'], e.target.value)} /></td>
                              <td className="py-2 pr-3"><input type="number" min="0" step="100" className="input text-xs w-28"
                                value={getDraftVal(['plans', plan, 'credits'], pricing.plans[plan]?.credits)}
                                onChange={(e) => pNum(['plans', plan, 'credits'], e.target.value)}
                                onBlur={(e) => handleNumBlur(['plans', plan, 'credits'], e.target.value)} /></td>
                              <td className="py-2"><input type="number" min="1" step="1" className="input text-xs w-20"
                                value={getDraftVal(['plans', plan, 'agents'], pricing.plans[plan]?.agents)}
                                onChange={(e) => pNum(['plans', plan, 'agents'], e.target.value)}
                                onBlur={(e) => handleNumBlur(['plans', plan, 'agents'], e.target.value)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Features per plan */}
                  {([
                    ['scheduling',     '📅 Agendamento',        false],
                    ['fileUpload',     '📁 Upload ficheiros',    false],
                    ['humorDetection', '😊 Deteção de humor',   false],
                    ['payments',       '💳 Pagamentos',          true ],
                    ['whitelabel',     '🎨 White-label',         false],
                  ] as [string, string, boolean][]).map(([featureKey, featureLabel, hasCredits]) => (
                    <div key={featureKey} className="card">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{featureLabel}</h3>
                      <p className="text-[10px] text-gray-400 mb-4">
                        {featureKey === 'whitelabel' ? 'Preço = €/agente/mês' :
                         featureKey === 'payments'   ? 'Preço = mensalidade €/mês · Créditos = por transação' :
                         'Preço = addon €/mês (só relevante se mode=addon)'}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[500px]">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700">
                              <th className="text-left py-1.5 text-xs text-gray-500 w-24">Plano</th>
                              <th className="text-left py-1.5 text-xs text-gray-500 w-40">Modo</th>
                              <th className="text-left py-1.5 text-xs text-gray-500">Preço (€)</th>
                              {hasCredits && <th className="text-left py-1.5 text-xs text-gray-500">Crd/tx</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(['free','starter','pro','business','enterprise'] as const).map((plan) => {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const feat = (pricing.features as any)[featureKey]?.[plan] as FeaturePlanConfig | undefined;
                              const mode = feat?.mode ?? 'disabled';
                              return (
                                <tr key={plan} className="border-b border-gray-50 dark:border-gray-700/50">
                                  <td className="py-1.5 pr-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[plan]}`}>{PLAN_LABELS_LOCAL[plan]}</span>
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <select
                                      value={mode}
                                      onChange={(e) => pMode(featureKey, plan, e.target.value)}
                                      className={`input text-xs w-36 ${
                                        mode === 'disabled' ? 'text-gray-400' :
                                        mode === 'included' ? 'text-green-600' : 'text-orange-600'
                                      }`}
                                    >
                                      <option value="disabled">🚫 Desativado</option>
                                      <option value="addon">➕ Addon (cobra)</option>
                                      <option value="included">✅ Incluído</option>
                                    </select>
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-400">€</span>
                                      <input type="number" min="0" step="1" className="input text-xs w-20"
                                        disabled={mode !== 'addon'}
                                        value={getDraftVal(['features', featureKey, plan, 'price'], feat?.price)}
                                        onChange={(e) => pNum(['features', featureKey, plan, 'price'], e.target.value)}
                                        onBlur={(e) => handleNumBlur(['features', featureKey, plan, 'price'], e.target.value)} />
                                    </div>
                                  </td>
                                  {hasCredits && (
                                    <td className="py-1.5">
                                      <input type="number" min="0" step="1" className="input text-xs w-20"
                                        disabled={mode === 'disabled'}
                                        value={getDraftVal(['features', featureKey, plan, 'creditsPerTx'], feat?.creditsPerTx)}
                                        onChange={(e) => pNum(['features', featureKey, plan, 'creditsPerTx'], e.target.value)}
                                        onBlur={(e) => handleNumBlur(['features', featureKey, plan, 'creditsPerTx'], e.target.value)} />
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button onClick={savePricing} disabled={pricingSaving} className="btn-primary">
                      {pricingSaving ? 'A guardar...' : '💾 Guardar alterações'}
                    </button>
                  </div>
                </>
              )}
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
