import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { ROUTES } from '../../utils/constants';
import { AuditLogEntry } from '../../types';

const ACTION_LABELS: Record<string, string> = {
  tenant_signup: 'Conta criada',
  agent_created: 'Agente criado',
  agent_deleted: 'Agente eliminado',
  agent_activated: 'Agente ativado',
  agent_deactivated: 'Agente desativado',
  conversation_created: 'Conversa iniciada',
  conversation_closed: 'Conversa fechada',
};

const ACTION_COLORS: Record<string, string> = {
  tenant_signup: 'bg-blue-100 text-blue-700',
  agent_created: 'bg-green-100 text-green-700',
  agent_deleted: 'bg-red-100 text-red-700',
  agent_activated: 'bg-green-100 text-green-700',
  agent_deactivated: 'bg-yellow-100 text-yellow-700',
  conversation_created: 'bg-purple-100 text-purple-700',
  conversation_closed: 'bg-gray-100 text-gray-700',
};

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function LogRow({ log }: { log: AuditLogEntry }) {
  const label = ACTION_LABELS[log.action] ?? log.action;
  const color = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700';
  const date = new Date(log.createdAt);

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
