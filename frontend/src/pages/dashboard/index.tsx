import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES } from '../../utils/constants';
import { Plan, PLAN_LABELS } from '../../types';
import api from '../../utils/api';

interface BusinessMetrics {
  agents: { total: number; active: number };
  conversations: { total: number; today: number; open: number };
  messages: { total: number };
  credits: { total: number; used: number; available: number; usedPercent: number };
  orders: {
    total: number;
    today: number;
    thisMonth: number;
    totalRevenue: number;
    thisMonthRevenue: number;
  };
  visitors: { identified: number };
}

function KpiCard({
  label, value, sub, accent, icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon: string;
}) {
  return (
    <div className="card flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-lg shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5 leading-tight">{label}</p>
        <p className={`text-xl font-bold leading-tight ${accent ?? 'text-gray-900 dark:text-gray-100'}`}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { tenant, loadMe } = useAuth();
  const { agents, total, loading, fetchAgents } = useAgent();
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    loadMe();
    fetchAgents(0, 5);
    api.get('/api/admin/metrics')
      .then((r) => setMetrics(r.data))
      .catch(() => {});
  }, []);

  if (!tenant) return null;

  const usedPercent = metrics?.credits.usedPercent
    ?? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100);
  const creditsAvail = metrics?.credits.available
    ?? (tenant.creditsTotal - tenant.creditsUsed);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Head><title>Agentfy — Dashboard</title></Head>
      <Navigation />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-8">

          {/* Header */}
          <div className="mb-5 sm:mb-7 flex items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Olá, {tenant.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                Plano <span className="font-semibold text-brand-600">{PLAN_LABELS[tenant.plan as Plan]}</span>
                {metrics && metrics.conversations.open > 0 && (
                  <span className="ml-2 text-gray-400 text-xs">
                    · {metrics.conversations.open} em aberto
                  </span>
                )}
              </p>
            </div>
            <Link href={ROUTES.createAgent} className="btn-primary text-sm shrink-0">
              + Agente
            </Link>
          </div>

          {/* KPI grid — 2 cols on mobile, 3 on tablet+ */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5 sm:mb-7">
            <KpiCard
              icon="💬"
              label="Conversas hoje"
              value={metrics?.conversations.today ?? '—'}
              sub={`${metrics?.conversations.total.toLocaleString('pt-PT') ?? '—'} total`}
            />
            <KpiCard
              icon="🛒"
              label="Pedidos"
              value={metrics?.orders.total.toLocaleString('pt-PT') ?? '—'}
              sub={`${metrics?.orders.today ?? '—'} hoje`}
            />
            <KpiCard
              icon="💶"
              label="Faturado este mês"
              value={metrics ? `€${metrics.orders.thisMonthRevenue.toFixed(2)}` : '—'}
              sub={`€${metrics?.orders.totalRevenue.toFixed(2) ?? '—'} total`}
              accent="text-green-600 dark:text-green-400"
            />
            <KpiCard
              icon="👥"
              label="Clientes identificados"
              value={metrics?.visitors.identified.toLocaleString('pt-PT') ?? '—'}
              sub="via WhatsApp"
            />
            {/* Credits card — custom with progress bar */}
            <div className="card flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-lg shrink-0">
                ⚡
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Créditos</p>
                <p className={`text-xl font-bold leading-tight ${
                  usedPercent >= 90 ? 'text-red-500' : usedPercent >= 70 ? 'text-yellow-600' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {creditsAvail.toLocaleString('pt-PT')}
                </p>
                <div className="mt-1.5 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${Math.min(usedPercent, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{usedPercent}% usado</p>
              </div>
            </div>
            <KpiCard
              icon="🤖"
              label="Agentes ativos"
              value={metrics ? `${metrics.agents.active}/${metrics.agents.total}` : String(total)}
              sub="configurados"
            />
          </div>

          {/* Agent list */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Agentes</h2>
            <Link href={ROUTES.agents} className="text-sm text-brand-600 hover:underline">Ver todos</Link>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm py-6 text-center">A carregar...</p>
          ) : agents.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-gray-400 mb-4">Ainda não tens agentes. Cria o primeiro!</p>
              <Link href={ROUTES.createAgent} className="btn-primary">Criar agente</Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={ROUTES.agentDetail(agent.id)}
                  className="card flex items-center gap-3 hover:border-brand-200 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-base shrink-0">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{agent.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {agent.description || agent.model}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      agent.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-gray-400 text-xs hidden sm:inline">{agent.totalConversations} conv.</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
