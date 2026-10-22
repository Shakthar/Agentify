import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, KpiStrip, PageHeader, Panel, Pill, Skeleton, Tabs } from '../../components/app/ui';
import type { PillTone } from '../../components/app/ui';
import SeoPanel from '../../components/admin/SeoPanel';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { ROUTES } from '../../utils/constants';
import { AuditLogEntry } from '../../types';
import api from '../../utils/api';
import { startImpersonation } from '../../utils/auth';

// ─── WhatsApp diagnostics types ──────────────────────────────────────────────
interface WpAgentDiag {
  id: string;
  name: string;
  tenant: string;
  tenantEmail: string;
  plan: string;
  isActive: boolean;
  whatsappEnabled: boolean;
  phoneNumberId: string | null;
  hasAgentToken: boolean;
  hasGlobalToken: boolean;
  conversations: number;
  status: 'ok' | 'warning' | 'error';
  issues: string[];
  warnings: string[];
}
interface WhatsAppDiagnostics {
  env: Record<string, string | null>;
  agents: WpAgentDiag[];
  summary: { total: number; ok: number; warning: number; error: number };
}

// ─── PricingConfig (mirrors backend) ─────────────────────────────────────────
interface FeaturePlanConfig {
  mode: 'disabled' | 'addon' | 'included';
  price?: number;
  creditsPerTx?: number;
}
interface PricingConfig {
  version?: number;
  fx?: { BRLperEUR: number };
  plans: Record<string, PC>;
  topUp?: Record<string, { credits: number; price: number; priceBRL?: number }>;
  features: {
    scheduling:     Record<string, FeaturePlanConfig>;
    fileUpload:     Record<string, FeaturePlanConfig>;
    humorDetection: Record<string, FeaturePlanConfig>;
    payments:       Record<string, FeaturePlanConfig>;
    whitelabel:     Record<string, FeaturePlanConfig>;
    vendas:         Record<string, FeaturePlanConfig>;
    feedback?:      Record<string, FeaturePlanConfig>;
    analytics?:     Record<string, FeaturePlanConfig>;
    leadGen?:       Record<string, FeaturePlanConfig>;
    customSkills?:  Record<string, FeaturePlanConfig>;
    extraAgents?:   Record<string, FeaturePlanConfig>;
  };
}
interface PC { price: number; credits: number; agents: number; priceBRL?: number; creditsBRL?: number }

// ─── Tenant detail ────────────────────────────────────────────────────────────
interface AgentDetail {
  id: string; name: string; model: string; isActive: boolean; whitelabelEnabled: boolean;
  skillHandoff: boolean; skillDataCollection: boolean; skillScheduling: boolean;
  skillFileUpload: boolean; skillHumorDetection: boolean; skillVendas: boolean;
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
interface AddonStat {
  key: string; label: string; count: number; pct: number;
}
interface PlatformMetrics {
  tenants: { total: number; byPlan: Record<string, number> };
  agents: { total: number; active: number };
  conversations: { total: number; today: number; thisMonth: number; thisYear: number };
  messages: { total: number };
  revenue: { mrr: number; arr: number; byPlan?: Record<string, number> };
  expenses: { monthly: number; items: Expense[] };
  usage: {
    creditsConsumed: number;
    inputTokens: number;
    outputTokens: number;
    realApiCostEur: number;
  };
  balance: number;
  addons: AddonStat[];
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


const TABS = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'seo', label: 'SEO e visitas' },
  { id: 'financas', label: 'Receitas e despesas' },
  { id: 'precos', label: 'Preços' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'auditoria', label: 'Auditoria' },
] as const;
type TabId = (typeof TABS)[number]['id'];
// Aceita também as chaves antigas (?tab=dashboard, etc.).
const TAB_ALIASES: Record<string, TabId> = { dashboard: 'geral', tenants: 'clientes', balance: 'financas', pricing: 'precos', logs: 'auditoria' };
function parseTab(q: unknown): TabId {
  const v = Array.isArray(q) ? q[0] : q;
  if (typeof v !== 'string') return 'geral';
  if (TAB_ALIASES[v]) return TAB_ALIASES[v];
  return (TABS.find((t) => t.id === v)?.id ?? 'geral') as TabId;
}

const eur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const int = (v: number) => v.toLocaleString('pt-PT');
const tok = (v: number) => `${(v / 1000).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;

const PLAN_LABELS_LOCAL: Record<string, string> = {
  free: 'Free', starter: 'Starter', business: 'Business', enterprise: 'Enterprise',
};
const PLAN_TONES: Record<string, PillTone> = { free: 'neutral', starter: 'neutral', business: 'accent', enterprise: 'accent' };
const CATEGORY_LABELS: Record<string, string> = {
  hosting: 'Hosting', api: 'APIs', support: 'Suporte', marketing: 'Marketing', misc: 'Outros',
};
const ACTION_LABELS: Record<string, string> = {
  tenant_signup: 'Conta criada', agent_created: 'Agente criado',
  agent_deleted: 'Agente eliminado', agent_activated: 'Agente ativado',
  agent_deactivated: 'Agente desativado', conversation_created: 'Conversa iniciada',
  conversation_closed: 'Conversa fechada',
};
const ACTION_TONES: Record<string, PillTone> = {
  tenant_signup: 'accent', agent_created: 'pos', agent_deleted: 'neg', agent_activated: 'pos',
  agent_deactivated: 'warn', conversation_created: 'neutral', conversation_closed: 'neutral',
};

// ─── Small components ─────────────────────────────────────────────────────────
function PlanPill({ plan }: { plan: string }) {
  return <Pill tone={PLAN_TONES[plan] ?? 'neutral'}>{PLAN_LABELS_LOCAL[plan] ?? plan}</Pill>;
}

function SkillBadge({ label, active, highlight }: { label: string; active: boolean; highlight?: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      !active ? 'bg-app-raised text-app-faint line-through' : highlight ? 'bg-app-accent-soft text-app-accent' : 'bg-app-raised text-app-ink'
    }`}>{label}</span>
  );
}

/** Barra fina de percentagem; só muda de tom quando o estado pede atenção. */
function UsageBar({ pct, className = 'w-16' }: { pct: number; className?: string }) {
  const tone = pct >= 90 ? 'bg-app-neg' : pct >= 70 ? 'bg-app-warn' : 'bg-app-accent';
  return (
    <span className={`block h-1 rounded-full bg-app-raised ${className}`}>
      <span className={`block h-1 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </span>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'neg' }) {
  return (
    <div>
      <p className="text-sm text-app-muted">{label}</p>
      <p className={`num mt-0.5 text-xl font-semibold ${tone === 'neg' ? 'text-app-neg' : 'text-app-ink'}`}>{value}</p>
      {note && <p className="text-xs text-app-faint">{note}</p>}
    </div>
  );
}

function Th({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <th className={`pb-2 text-xs font-normal text-app-muted ${right ? 'text-right' : 'text-left'} ${className ?? ''}`}>{children}</th>;
}

function BarRow({ label, value, max, trailing }: { label: string; value: number; max: number; trailing: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
      <span className="truncate text-app-ink">{label}</span>
      <span className="h-1 rounded-full bg-app-raised"><span className="block h-1 rounded-full bg-app-accent" style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%` }} /></span>
      <span className="num text-right text-app-muted">{trailing}</span>
    </li>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { tenant, loadMe } = useAuth();
  const { auditLogs, auditTotal, loading: auditLoading, fetchAuditLogs } = useAdmin();

  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [tabInit, setTabInit] = useState(false);
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
  const [impersonating, setImpersonating] = useState<string | null>(null);

  // WhatsApp diagnostics state
  const [wpData, setWpData] = useState<WhatsAppDiagnostics | null>(null);
  const [wpLoading, setWpLoading] = useState(false);
  const [wpTestId, setWpTestId] = useState<string | null>(null);
  const [wpTestResult, setWpTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

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

  async function loadWhatsApp() {
    setWpLoading(true);
    try { const r = await api.get('/api/superadmin/whatsapp'); setWpData(r.data); } catch { /* ignore */ }
    finally { setWpLoading(false); }
  }

  async function testAgent(agentId: string, phoneNumberId: string | null) {
    if (!phoneNumberId) {
      setWpTestResult(prev => ({ ...prev, [agentId]: { ok: false, msg: 'Phone Number ID não configurado — impossível testar routing.' } }));
      return;
    }
    setWpTestId(agentId);
    try {
      // Usa /simulate que faz o routing REAL por phone_number_id (igual ao webhook do Meta)
      const r = await api.post('/api/webhooks/whatsapp/simulate', { phoneNumberId, text: 'Olá, teste de diagnóstico.' });
      const routedTo: string = r.data.agent;
      const agentName = wpData?.agents.find(a => a.id === agentId)?.name ?? '';
      const routingOk = routedTo === agentName;
      const msg = routingOk
        ? `Routing OK → "${routedTo}" respondeu. Resposta: ${String(r.data.agentResponse ?? '').slice(0, 200)}`
        : `Routing ERRADO! Phone ID ${phoneNumberId} foi para "${routedTo}" em vez de "${agentName}". Verifica se o Phone Number ID está correto no agente.`;
      setWpTestResult(prev => ({ ...prev, [agentId]: { ok: routingOk, msg } }));
    } catch (e: any) {
      const errData = e?.response?.data;
      const agentes = errData?.agentesWhatsAppAtivos as Array<{name: string; whatsappNumber: string}> | undefined;
      const msg = agentes
        ? `Nenhum agente encontrado para ID "${phoneNumberId}". Ativos: ${agentes.map(a => `${a.name} → ${a.whatsappNumber}`).join(' | ')}`
        : errData?.error ?? 'Erro desconhecido';
      setWpTestResult(prev => ({ ...prev, [agentId]: { ok: false, msg } }));
    } finally { setWpTestId(null); }
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
      for (let i = 0; i < path.length - 1; i++) {
        if (obj[path[i]] === undefined || obj[path[i]] === null) obj[path[i]] = {};
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = v;
      return next;
    });
  }

  function pMode(feature: string, plan: string, val: string) {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as PricingConfig;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = next.features as any;
      if (!f[feature]) f[feature] = {};
      if (!f[feature][plan]) f[feature][plan] = { mode: 'disabled' };
      f[feature][plan].mode = val;
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

  async function impersonateTenant(tenantId: string, tenantName: string) {
    setImpersonating(tenantId);
    try {
      const r = await api.post(`/api/superadmin/impersonate/${tenantId}`);
      startImpersonation(r.data.token, tenantName);
      // Reload auth state with the new token, then navigate to the agent list
      await loadMe();
      router.push(ROUTES.agents);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Erro ao personificar conta');
    } finally {
      setImpersonating(null);
    }
  }


  function selectTab(id: TabId, push = true) {
    setActiveTab(id);
    if (push) router.replace({ pathname: router.pathname, query: id === 'geral' ? {} : { tab: id } }, undefined, { shallow: true });
    if (id === 'auditoria') fetchAuditLogs(0, PAGE_SIZE);
    if (id === 'precos' && !pricing) loadPricing();
    if (id === 'whatsapp') loadWhatsApp();
  }

  // Aplica ?tab= (também em navegação para trás/frente).
  useEffect(() => {
    if (!router.isReady || !isAdmin) return;
    const t = parseTab(router.query.tab);
    if (t !== activeTab || !tabInit) {
      setTabInit(true);
      selectTab(t, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.tab, isAdmin]);

  if (!tenant || !isAdmin) return null;

  function renderTenantDetail(t: TenantDetail) {
    return (
      <div className="space-y-5 px-1 py-4">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="min-w-[200px] flex-1">
            <p className="text-sm font-semibold text-app-ink">{t.companyName || t.name}</p>
            <p className="text-xs text-app-muted">{t.email}</p>
            {t.phone && <p className="text-xs text-app-muted">Telefone: <span className="num">{t.phone}</span></p>}
            {t.vatNumber && <p className="text-xs text-app-muted">NIF: <span className="num">{t.vatNumber}</span></p>}
            {t.domain && <p className="text-xs text-app-muted">Domínio: {t.domain}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.twoFactorEnabled && <Pill tone="pos">2FA ativo</Pill>}
              <Pill tone={t.paymentStatus === 'active' ? 'pos' : 'neutral'}>Faturação: {t.paymentStatus}</Pill>
            </div>
          </div>
          <div className="min-w-[180px]">
            <p className="mb-1 text-xs text-app-muted">Créditos</p>
            <UsageBar pct={t.creditsUsedPercent} className="mb-1.5 w-full" />
            <p className="num text-xs text-app-ink">{int(t.creditsUsed)} / {int(t.creditsTotal)} ({t.creditsUsedPercent}%)</p>
            <p className="num text-xs text-app-faint">Disponível: {int(t.creditsAvailable)}</p>
          </div>
          <div className="min-w-[200px]">
            <p className="mb-1 text-xs text-app-muted">Alterar plano</p>
            <div className="flex gap-2">
              <select defaultValue={t.plan} id={`plan-select-${t.id}`} className="input flex-1">
                {['free', 'starter', 'business', 'enterprise'].map((p) => (
                  <option key={p} value={p}>{PLAN_LABELS_LOCAL[p]}</option>
                ))}
              </select>
              <button
                disabled={planChanging}
                onClick={() => {
                  const sel = document.getElementById(`plan-select-${t.id}`) as HTMLSelectElement;
                  changePlan(t.id, sel.value);
                }}
                className="btn-secondary"
              >
                {planChanging ? 'A aplicar…' : 'Aplicar'}
              </button>
            </div>
          </div>
          {!t.isAdmin && (
            <div className="min-w-[140px]">
              <p className="mb-1 text-xs text-app-muted">Acesso direto</p>
              <button disabled={impersonating === t.id} onClick={() => impersonateTenant(t.id, t.name)} className="btn-secondary w-full">
                {impersonating === t.id ? 'A entrar…' : 'Entrar como'}
              </button>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs text-app-muted">
            Agentes <span className="num">({t.agents.length})</span> · Conversas: <span className="num">{int(t._count.conversations)}</span> · Pedidos: <span className="num">{int(t._count.orders)}</span>
          </p>
          {t.agents.length === 0 && <p className="text-sm text-app-muted">Sem agentes criados.</p>}
          <ul className="rounded-lg border border-app-edge bg-app-sheet">
            {t.agents.map((agent, i) => (
              <li key={agent.id} className={`p-3 ${i > 0 ? 'border-t border-app-rule' : ''}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill tone={agent.isActive ? 'pos' : 'neutral'} dot>{agent.isActive ? 'Ativo' : 'Pausado'}</Pill>
                    <span className="text-sm font-semibold text-app-ink">{agent.name}</span>
                    <span className="text-xs text-app-faint">{agent.model.split('-').slice(0, 2).join('-')}</span>
                  </div>
                  <span className="num text-xs text-app-muted">
                    {agent._count.conversations} conversas{agent._count.orders > 0 && ` · ${agent._count.orders} pedidos`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {agent.webChatEnabled && <SkillBadge label="Web" active />}
                  {agent.whatsappEnabled && <SkillBadge label="WhatsApp" active />}
                  <SkillBadge label="Handoff" active={agent.skillHandoff} />
                  <SkillBadge label="Dados" active={agent.skillDataCollection} />
                  <SkillBadge label="Agenda" active={agent.skillScheduling} />
                  <SkillBadge label="Upload" active={agent.skillFileUpload} />
                  <SkillBadge label="Humor" active={agent.skillHumorDetection} />
                  <SkillBadge label="Vendas+KDS" active={agent.skillVendas} highlight />
                  <SkillBadge label="Whitelabel" active={agent.whitelabelEnabled} highlight />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const planMax = metrics ? Math.max(1, ...['free', 'starter', 'business', 'enterprise'].map((p) => metrics.tenants.byPlan[p] ?? 0)) : 1;
  const paidPlans = ['starter', 'business', 'enterprise'];
  const usage = metrics?.usage;

  return (
    <AppLayout wide>
      <Head><title>Administração · Agentfy</title></Head>

      <PageHeader
        title="Administração"
        subtitle="Contas, receitas, visitas ao site e diagnósticos da plataforma."
        actions={<Pill tone="neutral">{tenant.email}</Pill>}
      />

      <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} value={activeTab} onChange={(id) => selectTab(id)} label="Áreas da administração" />

      {loadingData && !metrics && activeTab !== 'seo' && activeTab !== 'auditoria' && activeTab !== 'whatsapp' && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {/* ─── Visão geral ─── */}
      {activeTab === 'geral' && metrics && (
        <div className="space-y-4">
          <KpiStrip
            items={[
              { label: 'Contas', value: int(metrics.tenants.total), caption: `${int(metrics.tenants.total - (metrics.tenants.byPlan.free ?? 0))} com plano pago` },
              { label: 'Agentes', value: int(metrics.agents.total), caption: `${int(metrics.agents.active)} ativos` },
              { label: 'Conversas totais', value: int(metrics.conversations.total), caption: `${int(metrics.messages.total)} mensagens` },
              { label: 'Conversas este ano', value: int(metrics.conversations.thisYear), caption: `${int(metrics.conversations.thisMonth)} este mês · ${int(metrics.conversations.today)} hoje` },
            ]}
          />
          <KpiStrip
            items={[
              { label: 'Receita mensal recorrente', value: eur(metrics.revenue.mrr), caption: 'Soma das mensalidades ativas' },
              { label: 'Receita anual recorrente', value: eur(metrics.revenue.arr), caption: 'MRR × 12' },
              { label: 'Balanço mensal', value: eur(metrics.balance), tone: metrics.balance < 0 ? 'neg' : 'default', caption: `Receita menos ${eur(metrics.expenses.monthly)}/mês de despesas fixas` },
            ]}
          />

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title="Consumo de LLM" action="Créditos internos vs. custo real">
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Créditos consumidos" value={int(usage?.creditsConsumed ?? 0)} note="unidade virtual" />
                <Stat label="Custo real da API" value={`€${(usage?.realApiCostEur ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 4 })}`} note="pago à Anthropic/OpenAI" />
                <Stat label="Tokens enviados" value={tok(usage?.inputTokens ?? 0)} note="input" />
                <Stat label="Tokens recebidos" value={tok(usage?.outputTokens ?? 0)} note="output" />
              </div>
              {(usage?.creditsConsumed ?? 0) > 0 && (
                <p className="mt-4 border-t border-app-rule pt-3 text-xs text-app-muted">
                  Custo real: <span className="num font-semibold text-app-ink">{eur(((usage?.realApiCostEur ?? 0) / (usage?.creditsConsumed ?? 1)) * 1000)}</span> por 1 000 créditos consumidos.
                  {' '}Receita mensal: <span className="num font-semibold text-app-ink">{eur(metrics.revenue.mrr / ((usage?.creditsConsumed ?? 1) / 1000))}</span> por 1 000 créditos.
                </p>
              )}
            </Panel>

            <Panel title="Conversas por período" action="% do total desde o início">
              <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'Hoje', value: metrics.conversations.today },
                  { label: 'Este mês', value: metrics.conversations.thisMonth },
                  { label: 'Este ano', value: metrics.conversations.thisYear },
                  { label: 'Total', value: metrics.conversations.total },
                ].map(({ label, value }) => (
                  <Stat key={label} label={label} value={int(value)} note={metrics.conversations.total > 0 ? `${Math.round((value / metrics.conversations.total) * 100)}% do total` : undefined} />
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title="Contas por plano" action={`${int(metrics.tenants.total)} contas`}>
              <ul className="space-y-3">
                {['free', 'starter', 'business', 'enterprise'].map((p) => (
                  <BarRow key={p} label={PLAN_LABELS_LOCAL[p]} value={metrics.tenants.byPlan[p] ?? 0} max={planMax} trailing={int(metrics.tenants.byPlan[p] ?? 0)} />
                ))}
              </ul>
            </Panel>
            {metrics.addons && metrics.addons.length > 0 && (
              <Panel title="Addons e skills ativos" action={`Adoção em ${int(metrics.agents.total)} agentes`}>
                <ul className="space-y-3">
                  {metrics.addons.map((a) => (
                    <BarRow key={a.key} label={a.label} value={a.pct} max={100} trailing={<>{a.count} agente{a.count !== 1 ? 's' : ''} <span className="text-app-faint">({a.pct}%)</span></>} />
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ─── Clientes ─── */}
      {activeTab === 'clientes' && (
        <Panel title="Contas" action={`${int(tenants.length)} contas`} bodyClassName="!pt-1">
          {tenants.length === 0 && !loadingData ? (
            <EmptyState title="Nenhuma conta encontrada." body="Quando alguém criar conta, aparece aqui." />
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Conta</Th><Th>Plano</Th><Th right className="pl-4">Agentes</Th><Th right className="pl-4">Conversas</Th><Th className="pl-6">Créditos usados</Th><Th right className="pl-4">Mensalidade</Th><Th right className="pl-4">Criada</Th><Th />
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <Fragment key={t.id}>
                        <tr className={`cursor-pointer border-t border-app-rule transition-colors hover:bg-app-raised ${selectedTenant?.id === t.id ? 'bg-app-raised' : ''}`} onClick={() => openTenantDetail(t.id)}>
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-app-ink">{t.name}</p>
                            <p className="text-xs text-app-muted">{t.email}{t.isAdmin && ' · administrador'}</p>
                          </td>
                          <td className="py-3 pr-3"><PlanPill plan={t.plan} /></td>
                          <td className="num py-3 pl-4 text-right text-app-ink">{t._count.agents}</td>
                          <td className="num py-3 pl-4 text-right text-app-ink">{int(t._count.conversations)}</td>
                          <td className="py-3 pl-6">
                            <span className="flex items-center gap-2"><UsageBar pct={t.creditsUsedPercent} className="w-20" /><span className="num text-xs text-app-muted">{t.creditsUsedPercent}%</span></span>
                          </td>
                          <td className="num whitespace-nowrap py-3 pl-4 text-right text-app-ink">{eur(t.planPrice)}/mês</td>
                          <td className="num py-3 pl-4 text-right text-app-muted">{new Date(t.createdAt).toLocaleDateString('pt-PT')}</td>
                          <td className="py-3 pl-3 text-right text-xs font-semibold text-app-accent">{selectedTenant?.id === t.id ? 'Fechar' : 'Abrir'}</td>
                        </tr>
                        {selectedTenant?.id === t.id && (
                          <tr>
                            <td colSpan={8} className="bg-app-raised/60 px-4">
                              {tenantDetailLoading ? <div className="py-6"><Skeleton className="h-16 w-full" /></div> : renderTenantDetail(selectedTenant)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="md:hidden">
                {tenants.map((t, i) => (
                  <li key={t.id} className={i > 0 ? 'border-t border-app-rule' : ''}>
                    <button type="button" onClick={() => openTenantDetail(t.id)} className="flex w-full items-start gap-3 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-app-ink">{t.name}</span>
                        <span className="block truncate text-xs text-app-muted">{t.email}</span>
                        <span className="num mt-1 block text-xs text-app-muted">{t._count.agents} agentes · {int(t._count.conversations)} conversas · {eur(t.planPrice)}/mês · {t.creditsUsedPercent}% créditos</span>
                      </span>
                      <PlanPill plan={t.plan} />
                    </button>
                    {selectedTenant?.id === t.id && (tenantDetailLoading ? <Skeleton className="mb-3 h-16 w-full" /> : <div className="mb-3 rounded-lg bg-app-raised px-3">{renderTenantDetail(selectedTenant)}</div>)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}

      {/* ─── SEO e visitas ─── */}
      {activeTab === 'seo' && <SeoPanel />}

      {/* ─── Receitas e despesas ─── */}
      {activeTab === 'financas' && metrics && (
        <div className="space-y-4">
          <KpiStrip
            items={[
              { label: 'Receita mensal recorrente', value: eur(metrics.revenue.mrr), caption: `Anual: ${eur(metrics.revenue.arr)}` },
              { label: 'Despesas fixas por mês', value: eur(metrics.expenses.monthly), caption: `${metrics.expenses.items.length} itens registados` },
              { label: 'Balanço líquido', value: `${metrics.balance >= 0 ? '+' : ''}${eur(metrics.balance)}`, tone: metrics.balance < 0 ? 'neg' : 'default', caption: metrics.balance >= 0 ? 'Positivo' : 'Negativo: as despesas superam a receita' },
            ]}
          />

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title="Custo variável de LLM" action="Rastreado automaticamente">
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Créditos consumidos" value={int(usage?.creditsConsumed ?? 0)} note="unidades internas" />
                <Stat label="Custo real pago" value={`€${(usage?.realApiCostEur ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 4 })}`} note="à Anthropic / OpenAI" />
                <Stat label="Tokens enviados" value={tok(usage?.inputTokens ?? 0)} />
                <Stat label="Tokens recebidos" value={tok(usage?.outputTokens ?? 0)} />
              </div>
              <p className="mt-4 text-xs text-app-muted">
                Os créditos são a moeda interna. O custo real em euros vem dos tokens efetivamente processados × preço do modelo. As despesas de Anthropic/OpenAI abaixo são estimativas manuais: compare-as com este valor.
              </p>
            </Panel>

            <Panel title="Receita por plano">
              {paidPlans.every((p) => !(metrics.tenants.byPlan[p] ?? 0)) ? (
                <p className="text-sm text-app-muted">Sem contas pagas ainda.</p>
              ) : (
                <ul>
                  {paidPlans.map((plan) => {
                    const count = metrics.tenants.byPlan[plan] ?? 0;
                    const rev = metrics.revenue.byPlan?.[plan] ?? 0;
                    if (!count) return null;
                    return (
                      <li key={plan} className="flex items-center justify-between border-t border-app-rule py-2.5 first:border-t-0">
                        <span className="flex items-center gap-2"><PlanPill plan={plan} /><span className="num text-sm text-app-muted">{count} conta{count !== 1 ? 's' : ''}</span></span>
                        <span className="num text-sm font-semibold text-app-ink">{eur(rev)}/mês</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Despesas registadas">
            {metrics.expenses.items.length === 0 ? (
              <p className="mb-4 text-sm text-app-muted">Nenhuma despesa registada ainda. Use o formulário abaixo.</p>
            ) : (
              <ul className="mb-5">
                {metrics.expenses.items.map((exp) => (
                  <li key={exp.id} className="flex items-center justify-between gap-3 border-t border-app-rule py-2.5 first:border-t-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app-ink">{CATEGORY_LABELS[exp.category] ?? exp.category} · {exp.description}</p>
                      <p className="text-xs text-app-muted">{exp.recurring ? `Recorrente (${exp.period === 'monthly' ? 'mensal' : 'anual'})` : 'Pontual'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="num text-sm font-semibold text-app-ink">
                        {eur(exp.period === 'yearly' ? exp.amount / 12 : exp.amount)}/mês
                        {exp.period === 'yearly' && <span className="ml-1 text-xs font-normal text-app-faint">({eur(exp.amount)}/ano)</span>}
                      </span>
                      <button onClick={() => removeExpense(exp.id)} className="text-sm text-app-muted hover:text-app-neg" aria-label={`Remover ${exp.description}`}>Remover</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addExpense} className="grid grid-cols-2 gap-3 border-t border-app-rule pt-4 sm:grid-cols-6">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs text-app-muted">Categoria</label>
                <select className="input" value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-app-muted">Descrição</label>
                <input className="input" placeholder="ex.: Railway hosting" value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-app-muted">Valor (€)</label>
                <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-app-muted">Período</label>
                <select className="input" value={expForm.period} onChange={(e) => setExpForm((f) => ({ ...f, period: e.target.value }))}>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div className="col-span-full flex items-center justify-end gap-4">
                <label className="flex h-10 items-center gap-1.5 text-sm text-app-muted">
                  <input type="checkbox" checked={expForm.recurring} onChange={(e) => setExpForm((f) => ({ ...f, recurring: e.target.checked }))} />
                  Recorrente
                </label>
                <button type="submit" disabled={expSaving} className="btn-primary">{expSaving ? 'A guardar…' : 'Adicionar'}</button>
              </div>
            </form>
            <p className="mt-4 text-xs text-app-faint">
              Despesas típicas a registar: Railway ~€20/mês · Supabase Pro €25/mês · Vercel Pro €20/mês · Anthropic e OpenAI (variável) · Meta WhatsApp (grátis até 1000 conversas/mês).
            </p>
          </Panel>
        </div>
      )}

      {/* ─── Preços ─── */}
      {activeTab === 'precos' && (
        <div className="space-y-4">
          {!pricing && <Skeleton className="h-48 w-full" />}
          {pricing && (
            <>
              {pricingMsg && (
                <div className={`rounded-lg px-4 py-2 text-sm ${pricingMsg.includes('Erro') ? 'bg-app-neg-soft text-app-neg' : 'bg-app-pos-soft text-app-pos'}`}>{pricingMsg}</div>
              )}

              <Panel title="Planos" action="Preço, créditos e agentes">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-app-muted">
                  <span>Câmbio € → R$ (o € é a base; R$ arredonda para cima até final 9):</span>
                  <input type="number" min="0.1" step="0.01" className="input w-24"
                    value={getDraftVal(['fx', 'BRLperEUR'], pricing.fx?.BRLperEUR ?? 5.61)}
                    onChange={(e) => pNum(['fx', 'BRLperEUR'], e.target.value)}
                    onBlur={(e) => handleNumBlur(['fx', 'BRLperEUR'], e.target.value)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-sm">
                    <thead>
                      <tr>
                        <Th className="w-28">Plano</Th><Th>Preço (€/mês)</Th><Th>Créditos/mês</Th><Th>Preço R$ (€ × {pricing.fx?.BRLperEUR ?? 5.61})</Th><Th>Agentes máx.</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['free', 'starter', 'business', 'enterprise'] as const).map((plan) => (
                        <tr key={plan} className="border-t border-app-rule">
                          <td className="py-2 pr-3"><PlanPill plan={plan} /></td>
                          <td className="py-2 pr-3"><input type="number" min="0" step="1" className="input w-24"
                            value={getDraftVal(['plans', plan, 'price'], pricing.plans[plan]?.price)}
                            onChange={(e) => pNum(['plans', plan, 'price'], e.target.value)}
                            onBlur={(e) => handleNumBlur(['plans', plan, 'price'], e.target.value)} /></td>
                          <td className="py-2 pr-3"><input type="number" min="0" step="100" className="input w-28"
                            value={getDraftVal(['plans', plan, 'credits'], pricing.plans[plan]?.credits)}
                            onChange={(e) => pNum(['plans', plan, 'credits'], e.target.value)}
                            onBlur={(e) => handleNumBlur(['plans', plan, 'credits'], e.target.value)} /></td>
                          <td className="num py-2 pr-3 text-app-muted">
                            {(() => { const e = pricing.plans[plan]?.price ?? 0; const r = pricing.fx?.BRLperEUR ?? 5.61;
                              return e > 0 ? `R$${Math.ceil((e * r + 1) / 10) * 10 - 1}` : 'R$0'; })()}
                          </td>
                          <td className="py-2"><input type="number" min="1" step="1" className="input w-20"
                            value={getDraftVal(['plans', plan, 'agents'], pricing.plans[plan]?.agents)}
                            onChange={(e) => pNum(['plans', plan, 'agents'], e.target.value)}
                            onBlur={(e) => handleNumBlur(['plans', plan, 'agents'], e.target.value)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {([
                ['scheduling',     'Agendamento',            false],
                ['fileUpload',     'Upload de ficheiros',    false],
                ['humorDetection', 'Deteção de humor',       false],
                ['payments',       'Pagamentos',             true ],
                ['whitelabel',     'White-label',            false],
                ['vendas',         'Vendas + Pedidos/KDS',   false],
                ['feedback',       'Recolha de feedback',    false],
                ['analytics',      'Análises avançadas',     false],
                ['leadGen',        'Lead generation',        false],
                ['customSkills',   'Custom skills',          false],
                ['extraAgents',    'Agentes extra',          false],
              ] as [string, string, boolean][]).map(([featureKey, featureLabel, hasCredits]) => (
                <Panel key={featureKey} title={featureLabel}
                  action={
                    featureKey === 'whitelabel' || featureKey === 'extraAgents' ? 'Preço = €/agente/mês' :
                    featureKey === 'payments'   ? 'Preço = mensalidade €/mês · Créditos = por transação' :
                    featureKey === 'vendas'     ? 'Sempre addon, inclui Pedidos/KDS. Preço = €/mês' :
                    'Preço = addon €/mês (só se o modo for addon)'
                  }>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr>
                          <Th className="w-28">Plano</Th><Th className="w-44">Modo</Th><Th>Preço (€)</Th>{hasCredits && <Th>Créditos/tx</Th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(['free', 'starter', 'business', 'enterprise'] as const).map((plan) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const feat = (pricing.features as any)[featureKey]?.[plan] as FeaturePlanConfig | undefined;
                          const mode = feat?.mode ?? 'disabled';
                          return (
                            <tr key={plan} className="border-t border-app-rule">
                              <td className="py-1.5 pr-3"><PlanPill plan={plan} /></td>
                              <td className="py-1.5 pr-3">
                                <select value={mode} onChange={(e) => pMode(featureKey, plan, e.target.value)}
                                  className={`input w-40 ${mode === 'disabled' ? '!text-app-faint' : ''}`}>
                                  <option value="disabled">Desativado</option>
                                  <option value="addon">Addon (cobra)</option>
                                  <option value="included">Incluído</option>
                                </select>
                              </td>
                              <td className="py-1.5 pr-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-app-faint">€</span>
                                  <input type="number" min="0" step="1" className="input w-24 disabled:opacity-50"
                                    disabled={mode !== 'addon'}
                                    value={getDraftVal(['features', featureKey, plan, 'price'], feat?.price)}
                                    onChange={(e) => pNum(['features', featureKey, plan, 'price'], e.target.value)}
                                    onBlur={(e) => handleNumBlur(['features', featureKey, plan, 'price'], e.target.value)} />
                                </div>
                              </td>
                              {hasCredits && (
                                <td className="py-1.5">
                                  <input type="number" min="0" step="1" className="input w-24 disabled:opacity-50"
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
                </Panel>
              ))}

              <div className="flex justify-end">
                <button onClick={savePricing} disabled={pricingSaving} className="btn-primary">{pricingSaving ? 'A guardar…' : 'Guardar alterações'}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── WhatsApp ─── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-app-muted">Estado do routing e das credenciais por agente.</p>
            <button onClick={loadWhatsApp} disabled={wpLoading} className="btn-secondary">{wpLoading ? 'A carregar…' : 'Atualizar'}</button>
          </div>

          {wpLoading && !wpData && <Skeleton className="h-40 w-full" />}

          {wpData && (
            <>
              <KpiStrip
                items={[
                  { label: 'Agentes com WhatsApp', value: int(wpData.summary.total) },
                  { label: 'Tudo certo', value: int(wpData.summary.ok), caption: wpData.summary.ok === wpData.summary.total ? 'Todos' : undefined, tone: 'default' },
                  { label: 'Com avisos', value: int(wpData.summary.warning), tone: wpData.summary.warning ? 'warn' : 'default' },
                  { label: 'Com erros', value: int(wpData.summary.error), tone: wpData.summary.error ? 'neg' : 'default' },
                ]}
              />

              <Panel title="Configuração global (ENV)">
                <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {Object.entries(wpData.env).map(([k, v]) => {
                    const ok = !!v && !v.startsWith('✗');
                    return (
                      <li key={k} className="flex items-start gap-2 text-sm">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-app-pos' : 'bg-app-neg'}`} aria-hidden="true" />
                        <span className="min-w-0 break-words">
                          <span className="font-mono text-xs text-app-muted">{k}</span>{' '}
                          <span className="text-app-ink">{v ? v.replace(/^✗\s*/, '') : '—'}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>

              {wpData.agents.length === 0 ? (
                <EmptyState title="Nenhum agente com WhatsApp ativado." body="Quando um cliente ligar o WhatsApp a um agente, aparece aqui." />
              ) : (() => {
                const groups = wpData.agents.reduce<Record<string, { tenant: string; email: string; plan: string; agents: WpAgentDiag[] }>>((acc, a) => {
                  if (!acc[a.tenantEmail]) acc[a.tenantEmail] = { tenant: a.tenant, email: a.tenantEmail, plan: a.plan, agents: [] };
                  acc[a.tenantEmail].agents.push(a);
                  return acc;
                }, {});
                const statusTone = (s: WpAgentDiag['status']): PillTone => (s === 'ok' ? 'pos' : s === 'warning' ? 'warn' : 'neg');
                const statusLabel = (s: WpAgentDiag['status']) => (s === 'ok' ? 'OK' : s === 'warning' ? 'Aviso' : 'Erro');
                return (
                  <div className="space-y-4">
                    {Object.entries(groups).map(([email, group]) => (
                      <Panel key={email} title={group.tenant} action={<>{email} · {group.agents.length} agente{group.agents.length !== 1 ? 's' : ''} · plano {group.plan}</>} bodyClassName="!pt-1">
                        <ul>
                          {group.agents.map((a, i) => {
                            const testRes = wpTestResult[a.id];
                            const isTesting = wpTestId === a.id;
                            return (
                              <li key={a.id} className={`space-y-3 py-4 ${i > 0 ? 'border-t border-app-rule' : ''}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-app-ink">{a.name}</span>
                                    <Pill tone={statusTone(a.status)} dot>{statusLabel(a.status)}</Pill>
                                    {!a.isActive && <Pill>Inativo</Pill>}
                                  </div>
                                  <button
                                    onClick={() => testAgent(a.id, a.phoneNumberId)}
                                    disabled={isTesting || !a.phoneNumberId}
                                    className="btn-secondary disabled:opacity-40"
                                    title={!a.phoneNumberId ? 'Phone Number ID não configurado' : 'Testa o routing real pelo phone_number_id (como o Meta faz)'}
                                  >
                                    {isTesting ? 'A testar…' : 'Testar routing'}
                                  </button>
                                </div>

                                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                                  <div className="min-w-0">
                                    <dt className="text-xs text-app-muted">Phone Number ID</dt>
                                    <dd className="truncate font-mono text-xs text-app-ink">{a.phoneNumberId ?? <span className="text-app-neg">—</span>}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-app-muted">Token</dt>
                                    <dd className={a.hasAgentToken ? 'text-app-pos' : a.hasGlobalToken ? 'text-app-warn' : 'text-app-neg'}>
                                      {a.hasAgentToken ? 'Por agente' : a.hasGlobalToken ? 'Global (env)' : 'Em falta'}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-app-muted">WhatsApp</dt>
                                    <dd className={a.whatsappEnabled ? 'text-app-pos' : 'text-app-neg'}>{a.whatsappEnabled ? 'Ativado' : 'Desativado'}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs text-app-muted">Conversas</dt>
                                    <dd className="num text-app-ink">{int(a.conversations)}</dd>
                                  </div>
                                </dl>

                                {a.issues.map((issue, k) => (
                                  <p key={`i${k}`} className="rounded-lg bg-app-neg-soft px-3 py-2 text-sm text-app-neg">Erro: {issue}</p>
                                ))}
                                {a.warnings.map((w, k) => (
                                  <p key={`w${k}`} className="rounded-lg bg-app-warn-soft px-3 py-2 text-sm text-app-warn">Aviso: {w}</p>
                                ))}
                                {testRes && (
                                  <p className={`rounded-lg px-3 py-2 text-sm ${testRes.ok ? 'bg-app-pos-soft text-app-pos' : 'bg-app-neg-soft text-app-neg'}`}>
                                    <span className="font-semibold">{testRes.ok ? 'Resposta do agente:' : 'Erro:'}</span> {testRes.msg}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </Panel>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ─── Auditoria ─── */}
      {activeTab === 'auditoria' && (
        <Panel title="Registos de auditoria" action={`${int(auditTotal)} entradas`} bodyClassName="!pt-1">
          {auditLogs.length === 0 && !auditLoading ? (
            <EmptyState title="Sem registos de auditoria." body="As ações da plataforma aparecem aqui à medida que acontecem." />
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr><Th>Data</Th><Th>Ação</Th><Th className="hidden sm:table-cell">Tipo</Th><Th right>ID</Th></tr>
                </thead>
                <tbody>
                  {auditLogs.map((log: AuditLogEntry) => {
                    const d = new Date(log.createdAt);
                    return (
                      <tr key={log.id} className="border-t border-app-rule">
                        <td className="num whitespace-nowrap py-2.5 pr-3 text-app-muted">
                          {d.toLocaleDateString('pt-PT')} {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 pr-3"><Pill tone={ACTION_TONES[log.action] ?? 'neutral'}>{ACTION_LABELS[log.action] ?? log.action}</Pill></td>
                        <td className="hidden py-2.5 pr-3 text-app-muted sm:table-cell">{log.resourceType ?? '—'}</td>
                        <td className="py-2.5 text-right font-mono text-xs text-app-faint">{log.resourceId?.slice(-8) ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-app-rule pt-3 text-sm">
                <button onClick={handleAuditPrev} disabled={skip === 0 || auditLoading} className="font-semibold text-app-accent hover:underline disabled:text-app-faint disabled:no-underline">← Anterior</button>
                <span className="num text-xs text-app-muted">{skip + 1}–{Math.min(skip + PAGE_SIZE, auditTotal)} de {auditTotal}</span>
                <button onClick={handleAuditNext} disabled={skip + PAGE_SIZE >= auditTotal || auditLoading} className="font-semibold text-app-accent hover:underline disabled:text-app-faint disabled:no-underline">Seguinte →</button>
              </div>
            </>
          )}
        </Panel>
      )}
    </AppLayout>
  );
}
