import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, InlineError, PageHeader, Skeleton, Tabs, cx } from '../../components/app/ui';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES } from '../../utils/constants';

type StatusFilter = 'all' | 'active' | 'inactive';

const int = (v: number | undefined) => (v ?? 0).toLocaleString('pt-PT');

/** Canais ligados, em texto pequeno ("WhatsApp · Instagram"). */
function channelsOf(a: any): string {
  const list: string[] = [];
  if (a.whatsappEnabled) list.push('WhatsApp');
  if (a.instagramEnabled) list.push('Instagram');
  if (a.telegramEnabled) list.push('Telegram');
  if (a.webChatEnabled) list.push('Web');
  return list.length ? list.join(' · ') : 'Sem canais ligados';
}

const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_96px_96px_104px_132px] md:items-center md:gap-4';

export default function AgentsPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const { agents, total, loading, error, fetchAgents, deleteAgent, toggleAgent } = useAgent();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<StatusFilter>('all');
  const take = 10;

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    fetchAgents(page * take, take, search || undefined);
  }, [tenant, page, search]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar agente "${name}"? Esta ação é irreversível.`)) return;
    await deleteAgent(id);
  };

  const visible = useMemo(
    () => agents.filter((a) => (status === 'all' ? true : status === 'active' ? a.isActive : !a.isActive)),
    [agents, status],
  );
  const activeCount = agents.filter((a) => a.isActive).length;

  if (!tenant) return null;

  return (
    <AppLayout>
      <Head><title>Agentfy — Agentes</title></Head>
      <PageHeader
        title="Agentes"
        subtitle={loading && agents.length === 0 ? 'A carregar…' : `${int(total)} agente${total !== 1 ? 's' : ''} no total${agents.length ? `, ${activeCount} ativo${activeCount !== 1 ? 's' : ''} nesta página` : ''}`}
        actions={<Link href={ROUTES.createAgent} className="btn-primary text-sm">Criar agente</Link>}
      />

      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs
          label="Estado do agente"
          value={status}
          onChange={(id) => setStatus(id as StatusFilter)}
          tabs={[
            { id: 'all', label: 'Todos' },
            { id: 'active', label: 'Ativos' },
            { id: 'inactive', label: 'Inativos' },
          ]}
        />
        <input
          className="input mb-5 w-full sm:max-w-xs"
          placeholder="Pesquisar por nome…"
          aria-label="Pesquisar agentes por nome"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {error && <div className="mb-4"><InlineError message={error} onRetry={() => fetchAgents(page * take, take, search || undefined)} /></div>}

      {loading && agents.length === 0 ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-t border-app-rule pt-4">
              <div className="space-y-2"><Skeleton className="h-4 w-56" /><Skeleton className="h-3 w-36" /></div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={search ? `Nenhum agente encontrado para "${search}"` : status !== 'all' ? 'Nenhum agente neste estado' : 'Ainda não há agentes'}
          body={search || status !== 'all' ? 'Experimente outra pesquisa ou outro estado.' : 'Descreva o negócio e o primeiro agente fica pronto em minutos.'}
          action={!search && status === 'all' ? <Link href={ROUTES.createAgent} className="btn-primary text-sm">Criar agente</Link> : undefined}
        />
      ) : (
        <div>
          <div className="hidden gap-4 border-b border-app-rule pb-2 text-xs text-app-muted md:grid md:grid-cols-[minmax(0,1fr)_96px_96px_104px_132px]">
            <span>Agente</span>
            <span className="text-right">Conversas</span>
            <span className="text-right">Mensagens</span>
            <span>Estado</span>
            <span />
          </div>
          <ul>
            {visible.map((agent) => {
              const a = agent as any;
              const stateBtn = (
                <button
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  title={agent.isActive ? 'Clique para desativar' : 'Clique para ativar'}
                  className={cx(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    agent.isActive ? 'bg-app-pos-soft text-app-pos hover:opacity-80' : 'bg-app-raised text-app-muted hover:text-app-ink',
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {agent.isActive ? 'Ativo' : 'Inativo'}
                </button>
              );
              return (
                <li key={agent.id} className={cx('border-b border-app-rule py-4 last:border-b-0', ROW_GRID)}>
                  <div className="flex items-start justify-between gap-3 md:block">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={ROUTES.agentDetail(agent.id)} className="truncate text-sm font-semibold text-app-ink hover:text-app-accent">{agent.name}</Link>
                        {a.testMode && <span className="rounded-full bg-app-warn-soft px-2 py-0.5 text-xs font-medium text-app-warn">Teste</span>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-app-muted">{channelsOf(a)}</p>
                      {(agent.description || agent.model) && <p className="truncate text-xs text-app-faint">{agent.description || agent.model}</p>}
                    </div>
                    <div className="md:hidden">{stateBtn}</div>
                  </div>

                  <p className="num mt-2 text-xs text-app-muted md:hidden">
                    {int(agent.totalConversations)} conversas · {int(agent.totalMessages)} mensagens
                  </p>
                  <span className="num hidden text-right text-sm text-app-ink md:block">{int(agent.totalConversations)}</span>
                  <span className="num hidden text-right text-sm text-app-muted md:block">{int(agent.totalMessages)}</span>
                  <div className="hidden md:block">{stateBtn}</div>

                  <div className="mt-3 flex items-center gap-4 text-sm md:mt-0 md:justify-end">
                    <Link href={ROUTES.agentDetail(agent.id)} className="font-medium text-app-accent hover:underline">Abrir</Link>
                    <button type="button" onClick={() => handleDelete(agent.id, agent.name)} className="text-app-muted hover:text-app-neg">Eliminar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {total > take && (
        <div className="mt-6 flex items-center justify-between border-t border-app-rule pt-4">
          <button className="btn-secondary text-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Anterior</button>
          <span className="num text-sm text-app-muted">Página {page + 1} de {Math.ceil(total / take)}</span>
          <button className="btn-secondary text-sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * take >= total}>Próxima</button>
        </div>
      )}
    </AppLayout>
  );
}
