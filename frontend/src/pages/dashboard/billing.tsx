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

const PLANS = [
  { id: 'free',       price: '€0',    agents: 3,  credits: '3.000',   label: 'Free' },
  { id: 'starter',    price: '€39',   agents: 10, credits: '10.000',  label: 'Starter' },
  { id: 'pro',        price: '€89',   agents: 20, credits: '30.000',  label: 'Pro' },
  { id: 'business',   price: '€159',  agents: 30, credits: '60.000',  label: 'Business' },
  { id: 'enterprise', price: '€259',  agents: 999, credits: '75.000+', label: 'Enterprise' },
];

export default function BillingPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    api.get('/api/billing/credits').then(({ data: d }) => setData(d)).finally(() => setLoading(false));
  }, [tenant]);

  if (!tenant) return null;

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Faturação</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Créditos & Plano</h1>
          <p className="text-gray-500 text-sm mb-8">Plano atual: <span className="font-medium">{PLAN_LABELS[tenant.plan as Plan]}</span></p>

          {loading ? <p className="text-gray-400 text-sm">A carregar...</p> : data && (
            <>
              {/* Credits summary */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="card"><p className="text-sm text-gray-500">Total</p><p className="text-3xl font-bold">{data.total.toLocaleString()}</p></div>
                <div className="card"><p className="text-sm text-gray-500">Utilizados</p><p className="text-3xl font-bold">{data.used.toLocaleString()}</p></div>
                <div className="card">
                  <p className="text-sm text-gray-500">Disponíveis</p>
                  <p className={`text-3xl font-bold ${data.usedPercent >= 90 ? 'text-red-600' : data.usedPercent >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {data.available.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Bar */}
              <div className="card mb-8">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Utilização</span>
                  <span className="font-medium">{data.usedPercent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${data.usedPercent >= 90 ? 'bg-red-500' : data.usedPercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                    style={{ width: `${data.usedPercent}%` }}
                  />
                </div>
                {data.usedPercent >= 70 && (
                  <p className={`text-xs mt-2 ${data.usedPercent >= 90 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {data.usedPercent >= 90 ? '⚠️ Créditos quase esgotados!' : '⚡ Tens menos de 30% dos créditos restantes'}
                  </p>
                )}
              </div>

              {/* History */}
              {data.history.length > 0 && (
                <div className="card mb-8">
                  <h2 className="text-base font-semibold mb-4">Histórico recente</h2>
                  <div className="space-y-2">
                    {data.history.map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="font-medium capitalize">{log.reason}</span>
                          <span className="text-gray-400 text-xs ml-2">{new Date(log.createdAt).toLocaleDateString('pt-PT')}</span>
                        </div>
                        <span className={`font-semibold ${log.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {log.amount > 0 ? '+' : ''}{log.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Plans */}
          <h2 className="text-lg font-semibold mb-4">Planos disponíveis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`card relative ${tenant.plan === plan.id ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}
              >
                {tenant.plan === plan.id && (
                  <span className="absolute -top-2.5 left-4 bg-brand-600 text-white text-xs px-2 py-0.5 rounded-full">Atual</span>
                )}
                <p className="font-semibold text-gray-900 mb-1">{plan.label}</p>
                <p className="text-2xl font-bold text-brand-700 mb-3">
                  {plan.price}
                  {plan.id !== 'free' && <span className="text-sm text-gray-400 font-normal">/mês</span>}
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>✓ {plan.agents === 999 ? '30+ agentes' : `${plan.agents} agentes`}</li>
                  <li>✓ {plan.credits} créditos{plan.id === 'free' ? ' (único, sem reset)' : '/mês'}</li>
                </ul>
                {tenant.plan !== plan.id && (
                  <button className="btn-primary w-full mt-4 text-sm" disabled>
                    {plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
