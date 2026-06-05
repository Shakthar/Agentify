import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES } from '../../utils/constants';
import { Plan, PLAN_LABELS } from '../../types';

export default function Dashboard() {
  const router = useRouter();
  const { tenant, loadMe } = useAuth();
  const { agents, total, loading, fetchAgents } = useAgent();

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    loadMe();
    fetchAgents(0, 5);
  }, []);

  if (!tenant) return null;

  const usedPercent = Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100);

  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Olá, {tenant.name?.split(' ')[0]} 👋</h1>
            <p className="text-gray-500 text-sm mt-1">
              Plano: <span className="font-medium">{PLAN_LABELS[tenant.plan as Plan]}</span>
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="card">
              <p className="text-sm text-gray-500 mb-1">Agentes</p>
              <p className="text-3xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 mb-1">Créditos disponíveis</p>
              <p className="text-3xl font-bold text-gray-900">{tenant.creditsTotal - tenant.creditsUsed}</p>
              <div className="mt-2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-yellow-500' : 'bg-brand-500'}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{usedPercent}% utilizado</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500 mb-1">Total créditos</p>
              <p className="text-3xl font-bold text-gray-900">{tenant.creditsTotal}</p>
            </div>
          </div>

          {/* Recent agents */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Agentes recentes</h2>
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
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{agent.name}</p>
                    <p className="text-xs text-gray-500 truncate">{agent.description || agent.model}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-gray-400">{agent.totalConversations} conv.</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {agents.length > 0 && (
            <div className="mt-6 text-center">
              <Link href={ROUTES.createAgent} className="btn-primary">+ Novo agente</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
