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
    <div className="card flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${accent ?? 'text-gray-900 dark:text-gray-100'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
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
      .catch(() => {/* silently ignore */});
  }, []);

  if (!tenant) return null;

  const usedPercent = metrics?.credits.usedPercent
    ?? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100);
  const creditsAvail = metrics?.credits.available
    ?? (tenant.creditsTotal - tenant.creditsUsed);

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentify — Dashboard</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Olá, {tenant.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Plano <span className="font-medium text-brand-600">{PLAN_LABELS[tenant.plan as Plan]}</span>
                {metrics && (
                  <span className="ml-3 text-gray-400">
                    · {metrics.conversations.open} conversa{metrics.conversations.open !== 1 ? 's' : ''} em aberto
                  </span>
                )}
              </p>
            </div>
            <Link href={ROUTES.createAgent} className="btn-primary hidden sm:inline-flex">
              + Novo agente
            </Link>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <KpiCard
              icon="💬"
              label="Conversas hoje"
              value={metrics?.conversations.today ?? '—'}
              sub={`${metrics?.conversations.total.toLocaleString('pt-PT') ?? '—'} no total`}
            />
            <KpiCard
              icon="🛒"
              label="Pedidos processados"
              value={metrics?.orders.total.toLocaleString('pt-PT') ?? '—'}
              sub={`${metrics?.orders.today ?? '—'} hoje · ${metrics?.orders.thisMonth ?? '—'} este mês`}
            />
            <KpiCard
              icon="💶"
              label="Valor faturado pelo agente"
              value={metrics ? `€${metrics.orders.thisMonthRevenue.toFixed(2)}` : '—'}
              sub={`este mês · €${metrics?.orders.totalRevenue.toFixed(2) ?? '—'} total`}
              accent="text-green-600 dark:text-green-400"
            />
            <KpiCard
              icon="👥"
              label="Clientes atendidos"
              value={metrics?.visitors.identified.toLocaleString('pt-PT') ?? '—'}
              sub="conversas com cliente identificado"
            />
            <div className="card flex items-start gap-4 col-span-1">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl shrink-0">
                ⚡
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Créditos disponíveis</p>
                <p className={`text-2xl font-bold leading-tight ${
                  usedPercent >= 90 ? 'text-red-500' : usedPercent >= 70 ? 'text-yellow-600' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {creditsAvail.toLocaleString('pt-PT')}
                </p>
                <div className="mt-1.5 w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${Math.min(usedPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{usedPercent}% utilizado</p>
              </div>
            </div>
            <KpiCard
              icon="🤖"
              label="Agentes ativos"
              value={metrics ? `${metrics.agents.active} / ${metrics.agents.total}` : `${total}`}
              sub="agentes configurados"
            />
          </div>

          {/* Recent agents */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agentes</h2>
            <Link href={ROUTES.agents} className="text-sm text-brand-600 hover:underline">Ver todos</Link>
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">A carregar...</p>
          ) : agents.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 mb-4">Ainda não tens agentes. Cria o primeiro!</p>
              <Link href={ROUTES.createAgent} className="btn-primary">Criar agente</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={ROUTES.agentDetail(agent.id)}
                  className="card flex items-center gap-4 hover:border-brand-200 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-lg">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{agent.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {agent.description || agent.model}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      agent.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-gray-400 text-xs">{agent.totalConversations} conv.</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {agents.length > 0 && (
            <div className="mt-6 sm:hidden text-center">
              <Link href={ROUTES.createAgent} className="btn-primary">+ Novo agente</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
