import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import { CreditLog, Plan, PLAN_LABELS } from '../../types';
import api from '../../utils/api';

interface CreditData {
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
  waMsgsSent: number;
  waCreditsUsed: number;
  totalCreditsUsed: number;
}

function PieChart({ used, total }: { used: number; total: number }) {
  if (total === 0) return <div className="w-40 h-40 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto" />;
  const pct = Math.min(used / total, 1);
  const r = 60; const cx = 80; const cy = 80;
  const circumference = 2 * Math.PI * r;
  const color = pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#3b57f0';
  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="20" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="20"
          strokeDasharray={`${circumference * pct} ${circumference * (1 - pct)}`}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="22" fontWeight="700">{Math.round(pct * 100)}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#9ca3af" fontSize="10">usado</text>
      </svg>
      <div className="flex gap-4 text-xs mt-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />Usado: {used.toLocaleString()}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 dark:bg-gray-600" />Livre: {(total - used).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [data, setData] = useState<CreditData | null>(null);
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
      <Head><title>Agentfy — Créditos</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Créditos</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                Plano: <span className="font-medium">{PLAN_LABELS[tenant.plan as Plan]}</span>
                {' · '}<button onClick={() => router.push(ROUTES.plans)} className="text-brand-600 hover:underline text-sm">Ver planos →</button>
              </p>
            </div>
          </div>

          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1">
            {([
              { key: 'overview', label: '📊 Visão geral' },
              { key: 'agents',   label: '🤖 Por agente' },
              { key: 'history',  label: '🕒 Histórico' },
            ] as { key: typeof activeTab; label: string }[]).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-3 pb-2 text-sm font-medium transition-colors ${activeTab === t.key ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? <p className="text-gray-400 text-sm">A carregar...</p> : data && (
            <>
              {activeTab === 'overview' && (
                <div className="card flex flex-col sm:flex-row items-center gap-8">
                  <PieChart used={data.used} total={data.total} />
                  <div className="flex-1 space-y-3 w-full">
                    <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-500">Total alocado</span>
                      <span className="font-semibold">{data.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-500">Consumidos</span>
                      <span className="font-semibold text-red-500">{data.used.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm pb-2">
                      <span className="text-gray-500">Disponíveis</span>
                      <span className={`font-semibold ${data.usedPercent >= 90 ? 'text-red-600' : data.usedPercent >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {data.available.toLocaleString()}
                      </span>
                    </div>
                    {data.usedPercent >= 70 && (
                      <p className={`text-xs px-3 py-2 rounded-lg ${data.usedPercent >= 90 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-700'}`}>
                        {data.usedPercent >= 90 ? '⚠️ Créditos quase esgotados! Considera fazer upgrade.' : '⚡ Menos de 30% dos créditos restantes'}
                      </p>
                    )}
                    <button onClick={() => router.push(ROUTES.plans)} className="btn-primary w-full mt-2 text-sm">
                      🚀 Ver planos e fazer upgrade
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'agents' && (
                <div className="card p-0 overflow-hidden">
                  {agentUsage.length === 0 ? (
                    <p className="text-center py-10 text-sm text-gray-400">Sem dados de consumo por agente.</p>
                  ) : (
                    <>
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 grid grid-cols-4 text-xs font-semibold text-gray-500">
                        <span className="col-span-2">Agente</span>
                        <span className="text-right">🤖 LLM</span>
                        <span className="text-right">💬 WA msgs</span>
                      </div>
                      {agentUsage.slice().sort((a, b) => b.totalCreditsUsed - a.totalCreditsUsed).map((au) => {
                        const total = agentUsage.reduce((s, x) => s + x.totalCreditsUsed, 0);
                        const pct = total > 0 ? Math.round((au.totalCreditsUsed / total) * 100) : 0;
                        return (
                          <div key={au.agentId} className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="grid grid-cols-4 items-center gap-2">
                              <div className="col-span-2 flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                                  {au.agentName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{au.agentName}</p>
                                  <p className="text-[14px] text-gray-400">{au.totalCreditsUsed.toLocaleString()} créditos total · {pct}%</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold">{au.creditsUsed.toLocaleString()}</span>
                                <p className="text-[14px] text-gray-400">créditos</p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400">{au.waMsgsSent.toLocaleString()}</span>
                                <p className="text-[14px] text-gray-400">{au.waCreditsUsed.toLocaleString()} créd.</p>
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3b57f0 0%, #10b981 100%)' }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-xs text-gray-400">
                        🤖 LLM = créditos gastos em tokens do modelo de IA &nbsp;·&nbsp; 💬 WA msgs = mensagens enviadas via WhatsApp/Instagram (cada msg debita créditos do plano)
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="card p-0 overflow-hidden">
                  {data.history.length === 0 ? (
                    <p className="text-center py-10 text-sm text-gray-400">Sem histórico ainda.</p>
                  ) : data.history.map((log) => {
                    const reasonLabel: Record<string, string> = {
                      'chat':           '🤖 IA (tokens)',
                      'wamsg':          '💬 Mensagem WA/Instagram',
                      'signup-bonus':   '🎁 Bónus de registo',
                      'purchase':       '💳 Compra de créditos',
                      'refund':         '↩️ Reembolso',
                      'monthly-reset':  '🔄 Reset mensal',
                    };
                    return (
                    <div key={log.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div>
                        <span className="text-sm font-medium">{reasonLabel[log.reason] ?? log.reason}</span>
                        <span className="text-gray-400 text-xs ml-2">{new Date(log.createdAt).toLocaleDateString('pt-PT')}</span>
                      </div>
                      <span className={`text-sm font-semibold ${log.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
