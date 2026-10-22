import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, InlineError, KpiStrip, PageHeader, Panel, Skeleton, Tabs } from '../../components/app/ui';
import { REASON_LABEL, UsageBar, fmt, isoDate } from '../../components/app/billingParts';
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

type Tab = 'overview' | 'agents' | 'history';
const DAYS = 30;

/** Consumo por dia (créditos gastos = entradas negativas), últimos 30 dias, com zeros nos dias vazios. */
function dailyUsage(history: CreditLog[]) {
  const byDay = new Map<string, number>();
  for (const l of history) if (l.amount < 0) byDay.set(isoDate(l.createdAt), (byDay.get(isoDate(l.createdAt)) ?? 0) + -l.amount);
  const out: { day: string; label: string; used: number }[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, used: byDay.get(key) ?? 0 });
  }
  return out;
}

function UsageChart({ data }: { data: { day: string; label: string; used: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const max = Math.max(...data.map((d) => d.used), 1);
  const step = [10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((x) => x * 4 >= max) ?? Math.ceil(max / 4);
  const top = step * 4;
  const ticks = [0, step, step * 2, step * 3, top];
  return (
    <div className="h-56 w-full" role="img" aria-label="Créditos consumidos por dia nos últimos 30 dias">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="rgb(var(--app-rule))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} tick={{ fill: 'rgb(var(--app-faint))', fontSize: 12 }} tickMargin={8} />
            <YAxis width={44} tickLine={false} axisLine={false} domain={[0, top]} ticks={ticks} tickFormatter={(v: number) => fmt(v)} tick={{ fill: 'rgb(var(--app-faint))', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'rgb(var(--app-raised))' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-app-edge bg-app-sheet px-3 py-2 text-xs">
                    <p className="num text-app-faint">{(payload[0].payload as { day: string }).day}</p>
                    <p className="num font-semibold text-app-ink">{fmt(payload[0].value as number)} créditos</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="used" fill="rgb(var(--app-accent))" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [data, setData] = useState<CreditData | null>(null);
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setLoading(true); setFailed(false);
    Promise.all([
      api.get('/api/billing/credits'),
      api.get('/api/billing/usage-by-agent'),
    ]).then(([credRes, agentRes]) => {
      setData(credRes.data);
      setAgentUsage(agentRes.data.usage ?? []);
    }).catch(() => setFailed(true)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const daily = useMemo(() => dailyUsage(data?.history ?? []), [data]);
  const dailyTotal = daily.reduce((s, d) => s + d.used, 0);

  if (!tenant) return null;

  const agentTotal = agentUsage.reduce((s, x) => s + x.totalCreditsUsed, 0);

  return (
    <AppLayout>
      <Head><title>Agentfy — Créditos</title></Head>
      <PageHeader
        title="Créditos"
        subtitle={<>Plano {PLAN_LABELS[tenant.plan as Plan]}{data?.refreshDate ? <> · renova a <span className="num">{isoDate(data.refreshDate)}</span></> : null}</>}
        actions={<button onClick={() => router.push(ROUTES.plans)} className="btn-primary">Ver planos</button>}
      />

      <Tabs<Tab>
        label="Créditos"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Resumo' },
          { id: 'agents', label: 'Por agente', count: agentUsage.length },
          { id: 'history', label: 'Histórico', count: data?.history.length },
        ]}
      />

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {!loading && failed && <InlineError message="Não foi possível carregar os créditos." onRetry={load} />}

      {!loading && data && (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <Panel title="Utilização do ciclo">
                <UsageBar
                  used={data.used}
                  total={data.total}
                  caption={data.usedPercent >= 90 ? 'Créditos quase esgotados. Faça upgrade ou compre um pacote extra para não interromper os agentes.' : data.usedPercent >= 70 ? 'Restam menos de 30% dos créditos do ciclo.' : undefined}
                />
              </Panel>
              <KpiStrip
                items={[
                  { label: 'Total do plano', value: fmt(data.total), caption: 'créditos no ciclo' },
                  { label: 'Consumidos', value: fmt(data.used), caption: `${Math.round(data.usedPercent)}% do total` },
                  { label: 'Disponíveis', value: fmt(data.available), caption: 'até à renovação', tone: data.usedPercent >= 90 ? 'neg' : data.usedPercent >= 70 ? 'warn' : 'default' },
                ]}
              />
              <Panel title="Consumo por dia" action={<span className="num">{fmt(dailyTotal)} nos últimos {DAYS} dias</span>}>
                {dailyTotal > 0 ? (
                  <UsageChart data={daily} />
                ) : (
                  <EmptyState title="Sem consumo nos últimos 30 dias" body="Quando os agentes responderem a clientes, o consumo diário aparece aqui." />
                )}
              </Panel>
            </div>
          )}

          {activeTab === 'agents' && (
            <Panel bodyClassName="p-0">
              {agentUsage.length === 0 ? (
                <div className="p-5"><EmptyState title="Sem consumo por agente" body="Os agentes ainda não gastaram créditos neste ciclo." /></div>
              ) : (
                <>
                  <div className="hidden grid-cols-[1fr_6rem_6rem_6rem] gap-3 px-5 py-3 text-xs text-app-muted md:grid">
                    <span>Agente</span><span className="text-right">Quota</span><span className="text-right">Créditos IA</span><span className="text-right">Msgs WhatsApp</span>
                  </div>
                  {agentUsage.slice().sort((a, b) => b.totalCreditsUsed - a.totalCreditsUsed).map((au) => {
                    const pct = agentTotal > 0 ? (au.totalCreditsUsed / agentTotal) * 100 : 0;
                    return (
                      <div key={au.agentId} className="border-t border-app-rule px-5 py-3">
                        <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 md:grid-cols-[1fr_6rem_6rem_6rem]">
                          <p className="truncate text-sm font-medium text-app-ink">{au.agentName}</p>
                          <p className="num hidden text-right text-sm text-app-muted md:block">{Math.round(pct)}%</p>
                          <p className="num text-right text-sm font-medium text-app-ink">{fmt(au.creditsUsed)}<span className="text-xs font-normal text-app-faint md:hidden"> créditos</span></p>
                          <p className="num hidden text-right text-sm text-app-muted md:block">{fmt(au.waMsgsSent)}</p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-raised">
                          <div className="h-full rounded-full bg-app-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="num mt-1 text-xs text-app-faint md:hidden">{fmt(au.waMsgsSent)} msgs WhatsApp · {Math.round(pct)}% do total</p>
                      </div>
                    );
                  })}
                  <p className="border-t border-app-rule px-5 py-3 text-xs text-app-faint">
                    Créditos IA são gastos em tokens do modelo. As mensagens WhatsApp/Instagram não consomem créditos: as tarifas da Meta são faturadas pela Meta ao dono do número.
                  </p>
                </>
              )}
            </Panel>
          )}

          {activeTab === 'history' && (
            <Panel bodyClassName="p-0">
              {data.history.length === 0 ? (
                <div className="p-5"><EmptyState title="Sem movimentos" body="Os consumos, renovações e compras de créditos ficam registados aqui." /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-app-muted">
                      <th className="px-5 py-3 font-medium">Movimento</th>
                      <th className="px-3 py-3 text-right font-medium">Data</th>
                      <th className="px-5 py-3 text-right font-medium">Créditos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((log) => (
                      <tr key={log.id} className="border-t border-app-rule">
                        <td className="px-5 py-3 text-app-ink">{REASON_LABEL[log.reason] ?? log.reason}</td>
                        <td className="num px-3 py-3 text-right text-app-muted">{isoDate(log.createdAt)}</td>
                        <td className={`num px-5 py-3 text-right font-medium ${log.amount > 0 ? 'text-app-pos' : 'text-app-ink'}`}>
                          {log.amount > 0 ? '+' : '−'}{fmt(Math.abs(log.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          )}
        </>
      )}
    </AppLayout>
  );
}
