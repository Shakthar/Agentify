import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES } from '../../utils/constants';

export default function AgentsPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const { agents, total, loading, fetchAgents, deleteAgent, toggleAgent } = useAgent();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const take = 10;

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    fetchAgents(page * take, take, search || undefined);
  }, [tenant, page, search]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar agente "${name}"? Esta ação é irreversível.`)) return;
    await deleteAgent(id);
  };

  if (!tenant) return null;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Head><title>Agentfy — Agentes</title></Head>
      <Navigation />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-8">
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between mb-5 gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Agentes</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{total} agente{total !== 1 ? 's' : ''} no total</p>
            </div>
            <Link href={ROUTES.createAgent} className="btn-primary text-sm shrink-0">+ Novo agente</Link>
          </div>

          {/* Search */}
          <div className="mb-5">
            <input
              className="input w-full sm:max-w-xs"
              placeholder="Pesquisar por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          {/* List */}
          {loading ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">A carregar...</p>
          ) : agents.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-gray-400 dark:text-gray-500 mb-4">
                {search ? `Nenhum agente encontrado para "${search}"` : 'Ainda não tens agentes'}
              </p>
              {!search && <Link href={ROUTES.createAgent} className="btn-primary">Criar agente</Link>}
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="card flex items-start sm:items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-lg shrink-0">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{agent.name}</p>
                      {(agent as any).testMode && <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">🧪 Teste</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{agent.description || agent.model}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      <span>{agent.totalConversations} conversas</span>
                      <span>{agent.totalMessages} mensagens</span>
                    </div>
                    {/* Action buttons — shown inline on mobile below info */}
                    <div className="flex items-center gap-2 mt-2 sm:hidden flex-wrap">
                      <button
                        onClick={() => toggleAgent(agent.id)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          agent.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {agent.isActive ? 'Ativo' : 'Inativo'}
                      </button>
                      <Link href={ROUTES.agentDetail(agent.id)} className="btn-secondary py-1 px-3 text-xs">Ver</Link>
                      <button
                        onClick={() => handleDelete(agent.id, agent.name)}
                        className="text-red-400 hover:text-red-600 transition-colors text-xs px-2 py-1"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                  {/* Action buttons — desktop only (right side) */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAgent(agent.id)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        agent.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                    <Link href={ROUTES.agentDetail(agent.id)} className="btn-secondary py-1 px-3 text-xs">Ver</Link>
                    <button
                      onClick={() => handleDelete(agent.id, agent.name)}
                      className="text-red-400 hover:text-red-600 transition-colors text-xs px-2 py-1"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > take && (
            <div className="flex justify-center gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                Anterior
              </button>
              <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                Página {page + 1} de {Math.ceil(total / take)}
              </span>
              <button className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * take >= total}>
                Próxima
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
