import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
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
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agentes</h1>
              <p className="text-gray-500 text-sm mt-0.5">{total} agente{total !== 1 ? 's' : ''} no total</p>
            </div>
            <Link href={ROUTES.createAgent} className="btn-primary">+ Novo agente</Link>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              className="input max-w-xs"
              placeholder="Pesquisar por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          {/* List */}
          {loading ? (
            <p className="text-gray-400 text-sm">A carregar...</p>
          ) : agents.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-gray-400 mb-4">
                {search ? `Nenhum agente encontrado para "${search}"` : 'Ainda não tens agentes'}
              </p>
              {!search && <Link href={ROUTES.createAgent} className="btn-primary">Criar agente</Link>}
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="card flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg shrink-0">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{agent.name}</p>
                    <p className="text-xs text-gray-500 truncate">{agent.description || agent.model}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      <span>{agent.totalConversations} conversas</span>
                      <span>{agent.totalMessages} mensagens</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAgent(agent.id)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        agent.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
              <span className="flex items-center text-sm text-gray-500">
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
