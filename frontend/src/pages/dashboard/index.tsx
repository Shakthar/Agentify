import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, KpiStrip, PageHeader, Panel, Pill, Skeleton } from '../../components/app/ui';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES } from '../../utils/constants';
import api from '../../utils/api';

interface BusinessMetrics {
  agents: { total: number; active: number };
  conversations: {
    total: number;
    today: number;
    open: number;
    /** Conversas iniciadas por hora do dia (0-23), últimos 7 dias. Opcional: backends antigos não enviam. */
    byHour?: number[];
    /** Horário de atendimento humano do negócio, para sombrear as horas "fechado". */
    openHours?: { from: number; to: number } | null;
  };
  messages: { total: number };
  credits: { total: number; used: number; available: number; usedPercent: number };
  orders: { total: number; today: number; thisMonth: number; totalRevenue: number; thisMonthRevenue: number };
  visitors: { identified: number };
}

const eur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const int = (v: number) => v.toLocaleString('pt-PT');

/** Canais realmente ligados do agente (não assume WhatsApp). */
function agentChannels(a: any): string {
  const l: string[] = [];
  if (a.whatsappEnabled) l.push('WhatsApp');
  if (a.instagramEnabled) l.push('Instagram');
  if (a.telegramEnabled) l.push('Telegram');
  if (a.webChatEnabled) l.push('Web');
  return l.length ? l.join(' · ') : 'Sem canais ligados';
}

/**
 * Elemento-assinatura: o dia em 24 horas. Cada coluna é o nº de conversas que
 * o agente atendeu nessa hora (últimos 7 dias); as horas fora do horário do
 * negócio ficam num tom mais escuro - é a promessa "atende mesmo fechado"
 * medida nos dados do próprio cliente.
 */
function DayClock({ byHour, openHours }: { byHour: number[]; openHours: { from: number; to: number } | null }) {
  const max = Math.max(1, ...byHour);
  const top = Math.ceil(max / 10) * 10 || 10;
  const closed = (h: number) => (openHours ? h < openHours.from || h >= openHours.to : false);
  const closedTotal = byHour.reduce((s, v, h) => s + (closed(h) ? v : 0), 0);
  const total = byHour.reduce((s, v) => s + v, 0);
  const share = total ? Math.round((closedTotal / total) * 100) : 0;

  return (
    <div>
      {openHours && total > 0 && (
        <p className="mb-4 text-sm text-app-muted">
          <span className="font-semibold text-app-ink">{int(closedTotal)} conversas ({share}%)</span> chegaram com o negócio fechado
          ({String(openHours.to).padStart(2, '0')}h–{String(openHours.from).padStart(2, '0')}h). O agente respondeu a todas.
        </p>
      )}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 flex h-[200px] flex-col justify-between" aria-hidden="true">
          {[top, top / 2, 0].map((v) => (
            <div key={v} className="flex items-center gap-2">
              <span className="num w-6 text-right text-xs text-app-faint">{v}</span>
              <span className="h-px flex-1 bg-app-rule" />
            </div>
          ))}
        </div>
        <div className="relative ml-8 flex h-[200px] items-end gap-[3px]" role="img" aria-label={`Conversas por hora, últimos 7 dias, total ${total}`}>
          {byHour.map((v, h) => (
            <div key={h} className={`flex h-full flex-1 items-end rounded-sm ${closed(h) ? 'bg-app-raised' : ''}`} title={`${h}h: ${v} conversas`}>
              <div className={`w-full rounded-t-[3px] ${closed(h) ? 'bg-app-accent' : 'bg-app-accent/45'}`} style={{ height: `${(v / top) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="ml-8 mt-2 flex justify-between text-xs text-app-faint num">
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}h</span>
          ))}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-app-muted">
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-app-accent" />Com o negócio fechado</li>
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-app-accent/45" />No horário de atendimento</li>
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { tenant, loadMe } = useAuth();
  const { agents, total, loading, fetchAgents } = useAgent();
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);

  function loadMetrics() {
    setMetricsError(false);
    api.get('/api/admin/metrics').then((r) => setMetrics(r.data)).catch(() => setMetricsError(true));
  }

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    loadMe();
    fetchAgents(0, 6);
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byHour = useMemo(() => {
    const raw = metrics?.conversations.byHour;
    return raw && raw.length === 24 ? raw : null;
  }, [metrics]);

  if (!tenant) return null;

  const usedPercent = metrics?.credits.usedPercent ?? Math.round((tenant.creditsUsed / Math.max(1, tenant.creditsTotal)) * 100);
  const creditsAvail = metrics?.credits.available ?? tenant.creditsTotal - tenant.creditsUsed;
  const open = metrics?.conversations.open ?? 0;

  return (
    <AppLayout wide>
      <Head><title>Painel · Agentfy</title></Head>

      <PageHeader
        title="Painel"
        subtitle={
          metrics
            ? open > 0
              ? `${int(open)} conversa${open === 1 ? '' : 's'} à espera de alguém da equipa.`
              : 'Nenhuma conversa à espera da equipa. O agente está a tratar de tudo.'
            : 'O resumo do seu negócio no WhatsApp, Instagram e Telegram.'
        }
        actions={
          <>
            {open > 0 && <Link href={ROUTES.crm} className="btn-secondary">Ver conversas em aberto</Link>}
            <Link href={ROUTES.createAgent} className="btn-primary">Criar agente</Link>
          </>
        }
      />

      {metricsError ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-app-neg-soft px-4 py-3 text-sm text-app-neg">
          Não foi possível carregar os números agora.
          <button type="button" onClick={loadMetrics} className="font-semibold underline underline-offset-2">Tentar de novo</button>
        </div>
      ) : (
        <div className="mb-6">
          <KpiStrip
            items={[
              { label: 'Conversas hoje', value: metrics ? int(metrics.conversations.today) : <Skeleton className="h-8 w-16" />, caption: metrics ? `${int(metrics.conversations.total)} desde o início` : undefined },
              { label: 'Pedidos hoje', value: metrics ? int(metrics.orders.today) : <Skeleton className="h-8 w-16" />, caption: metrics ? `${int(metrics.orders.thisMonth)} este mês` : undefined },
              { label: 'Faturado este mês', value: metrics ? eur(metrics.orders.thisMonthRevenue) : <Skeleton className="h-8 w-28" />, caption: metrics ? `${eur(metrics.orders.totalRevenue)} desde o início` : undefined },
              {
                label: 'Créditos disponíveis',
                value: int(creditsAvail),
                caption: `${usedPercent}% do plano usado`,
                tone: usedPercent >= 90 ? 'neg' : usedPercent >= 70 ? 'warn' : 'default',
              },
            ]}
          />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_384px]">
        <Panel title="O seu dia em 24 horas" action="Últimos 7 dias">
          {!metrics && !metricsError ? (
            <Skeleton className="h-[200px] w-full" />
          ) : byHour ? (
            <DayClock byHour={byHour} openHours={metrics?.conversations.openHours ?? null} />
          ) : (
            <EmptyState
              title="Ainda não há conversas suficientes para desenhar o dia."
              body="Quando o agente atender as primeiras mensagens, vê aqui a que horas os clientes escrevem, com e sem a loja aberta."
            />
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-app-ink">Agentes</h2>
              <span className="num text-sm text-app-muted">
                {metrics ? `${metrics.agents.active} ativos de ${metrics.agents.total}` : `${total}`}
              </span>
            </div>
            <div className="rounded-xl border border-app-edge bg-app-sheet">
              {loading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ) : agents.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="Ainda não tem agentes."
                    body="Crie o primeiro em 10 minutos: diga o que o negócio vende e ligue o WhatsApp."
                    action={<Link href={ROUTES.createAgent} className="btn-primary">Criar agente</Link>}
                  />
                </div>
              ) : (
                <ul>
                  {agents.slice(0, 5).map((agent, i) => (
                    <li key={agent.id} className={i > 0 ? 'border-t border-app-rule' : ''}>
                      <Link href={ROUTES.agentDetail(agent.id)} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-app-raised">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-raised text-sm font-semibold text-app-ink">
                          {agent.name[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-app-ink">{agent.name}</span>
                          <span className="block truncate text-xs text-app-muted">
                            {agentChannels(agent)} · <span className="num">{int(agent.totalConversations ?? 0)}</span> conversas
                          </span>
                        </span>
                        <Pill tone={agent.isActive ? 'pos' : 'neutral'} dot>{agent.isActive ? 'Ativo' : 'Pausado'}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {agents.length > 0 && (
              <Link href={ROUTES.agents} className="btn-secondary mt-2 h-9 w-full">Ver todos os agentes</Link>
            )}
          </section>

          <Panel title="Clientes identificados">
            <p className="num text-2xl font-semibold text-app-ink">{metrics ? int(metrics.visitors.identified) : '—'}</p>
            <p className="mt-1 text-sm text-app-muted">Contactos que deixaram nome ou número numa conversa. Estão no CRM.</p>
            <Link href={ROUTES.crm} className="mt-3 inline-block text-sm font-semibold text-app-accent hover:underline">Abrir CRM</Link>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
