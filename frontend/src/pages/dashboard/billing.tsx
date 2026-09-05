import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import { CreditLog, Plan, PLAN_LABELS } from '../../types';
import api from '../../utils/api';

interface BillingData {
  total: number;
  used: number;
  available: number;
  usedPercent: number;
  plan: string;
  refreshDate: string;
  history: CreditLog[];
}

interface AgentUsage {
  agentId: string;
  agentName: string;
  creditsUsed: number;
}

const PLANS = [
  { id: 'free',       price: '€0',    agents: 1,  credits: '1.000 (único)',  label: 'Free' },
  { id: 'starter',    price: '€59',   agents: 1,  credits: '5.000/mês',      label: 'Starter' },
  { id: 'business',   price: '€159',  agents: 3,  credits: '15.000/mês',     label: 'Business' },
  { id: 'enterprise', price: '€399',  agents: 10, credits: '40.000/mês',     label: 'Enterprise' },
];

// SVG pie chart (no external lib)
function PieChart({ used, total }: { used: number; total: number }) {
  if (total === 0) return <div className="w-40 h-40 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto" />;
  const pct = Math.min(used / total, 1);
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;
  const usedArc = circumference * pct;
  const freeArc = circumference * (1 - pct);
  const color = pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#3b57f0';
  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {/* Background circle (available) */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="20" />
        {/* Used arc */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="20"
          strokeDasharray={`${usedArc} ${freeArc}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-2xl font-bold" fill={color} fontSize="22" fontWeight="700">
          {Math.round(pct * 100)}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#9ca3af" fontSize="10">usado</text>
      </svg>
      <div className="flex gap-4 text-xs mt-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />Usado: {used.toLocaleString()}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-gray-600" />Livre: {(total - used).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [data, setData] = useState<BillingData | null>(null);
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'history'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    Promise.all([
      api.get('/api/billing/credits'),
      api.get('/api/billing/usage-by-agent'),
    ]).then(([credRes, agentRes]) => {
      setData(credRes.data);
      setAgentUsage(agentRes.data.usage ?? []);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  if (!tenant) return null;

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Faturação</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Créditos & Plano</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Plano atual: <span className="font-medium">{PLAN_LABELS[tenant.plan as Plan]}</span></p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1">
            {([
              { key: 'overview', label: '📊 Visão geral' },
              { key: 'agents',   label: '🤖 Por agente' },
              { key: 'history',  label: '🕒 Histórico' },
            ] as { key: typeof activeTab; label: string }[]).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 pb-2 text-sm font-medium transition-colors ${
                  activeTab === t.key ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? <p className="text-gray-400 text-sm">A carregar...</p> : data && (
            <>
              {/* ─── Visão geral ─── */}
              {activeTab === 'overview' && (
                <>
                  {/* Pie chart + stats */}
                  <div className="card mb-6 flex flex-col sm:flex-row items-center gap-8">
                    <PieChart used={data.used} total={data.total} />
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-500 dark:text-gray-400">Total alocado</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{data.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-500 dark:text-gray-400">Consumidos</span>
                        <span className="font-semibold text-red-500">{data.used.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Disponíveis</span>
                        <span className={`font-semibold ${data.usedPercent >= 90 ? 'text-red-600' : data.usedPercent >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {data.available.toLocaleString()}
                        </span>
                      </div>
                      {data.usedPercent >= 70 && (
                        <p className={`text-xs px-3 py-2 rounded-lg ${data.usedPercent >= 90 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'}`}>
                          {data.usedPercent >= 90 ? '⚠️ Créditos quase esgotados!' : '⚡ Tens menos de 30% dos créditos restantes'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Plans */}
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Planos disponíveis</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PLANS.map((plan) => (
                      <div key={plan.id} className={`card relative ${tenant.plan === plan.id ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}>
                        {tenant.plan === plan.id && (
                          <span className="absolute -top-2.5 left-4 bg-brand-600 text-white text-xs px-2 py-0.5 rounded-full">Atual</span>
                        )}
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{plan.label}</p>
                        <p className="text-2xl font-bold text-brand-700 mb-3">
                          {plan.price}{plan.id !== 'free' && <span className="text-sm text-gray-400 font-normal">/mês</span>}
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                          <li>✓ {plan.agents === 999 ? '30+ agentes' : `${plan.agents} agentes`}</li>
                          <li>✓ {plan.credits} créditos{plan.id === 'free' ? ' (único, sem reset)' : '/mês'}</li>
                        </ul>
                        {tenant.plan !== plan.id && (
                          <button className="btn-primary w-full mt-4 text-sm" disabled>{plan.id === 'free' ? 'Downgrade' : 'Upgrade'}</button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ─── Por agente ─── */}
              {activeTab === 'agents' && (
                <div className="card p-0 overflow-hidden">
                  {agentUsage.length === 0 ? (
                    <p className="text-center py-10 text-sm text-gray-400">Sem dados de consumo por agente ainda.</p>
                  ) : (
                    <>
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <span>Agente</span><span>Créditos consumidos</span>
                      </div>
                      {agentUsage
                        .slice()
                        .sort((a, b) => b.creditsUsed - a.creditsUsed)
                        .map((au) => {
                          const pct = data.used > 0 ? Math.round((au.creditsUsed / data.used) * 100) : 0;
                          return (
                            <div key={au.agentId} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                              <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-sm shrink-0">
                                {au.agentName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{au.agentName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[14px] text-gray-400 shrink-0">{pct}% do total</span>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">
                                {au.creditsUsed.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                    </>
                  )}
                </div>
              )}

              {/* ─── Histórico ─── */}
              {activeTab === 'history' && (
                <div className="card p-0 overflow-hidden">
                  {data.history.length === 0 ? (
                    <p className="text-center py-10 text-sm text-gray-400">Sem histórico ainda.</p>
                  ) : (
                    data.history.map((log) => (
                      <div key={log.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{log.reason}</span>
                          <span className="text-gray-400 text-xs ml-2">{new Date(log.createdAt).toLocaleDateString('pt-PT')}</span>
                        </div>
                        <span className={`text-sm font-semibold ${log.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
