import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, InlineError, PageHeader, Panel, Pill, Skeleton, Tabs, cx } from '../../components/app/ui';
import { InvoiceTable, PlatformInvoice, REASON_LABEL, UsageBar, fmt, isoDate } from '../../components/app/billingParts';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import { CreditLog, Plan, PLAN_LABELS } from '../../types';
import api from '../../utils/api';
import { PLAN_PRICING, money, pricePer1k, type Currency, type PlanId } from '../../utils/pricing';

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

const PLAN_IDS: PlanId[] = ['free', 'starter', 'business', 'enterprise'];
type Tab = 'overview' | 'agents' | 'history';

export default function BillingPage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [data, setData] = useState<BillingData | null>(null);
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [currency, setCurrency] = useState<Currency>('EUR');

  const load = () => {
    setLoading(true); setFailed(false);
    api.get('/api/billing/pricing').then(r => { if (r.data?.tenantCurrency === 'BRL') setCurrency('BRL'); }).catch(() => {});
    api.get('/api/billing/platform-invoices').then(r => setInvoices(r.data?.invoices ?? [])).catch(() => {});
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

  if (!tenant) return null;

  const cur = tenant.plan as PlanId;
  const curIdx = PLAN_IDS.indexOf(cur);
  const curData = PLAN_PRICING[cur][currency];
  const status = tenant.subscriptionStatus;
  const days = tenant.subscriptionExpiresAt ? Math.ceil((new Date(tenant.subscriptionExpiresAt).getTime() - Date.now()) / 86400000) : null;

  return (
    <AppLayout>
      <Head><title>Agentfy — Faturação</title></Head>
      <PageHeader
        title="Faturação"
        subtitle="Plano, créditos e faturas da conta."
        actions={<Link href={ROUTES.plans} className="btn-primary">Alterar plano</Link>}
      />

      <Tabs<Tab>
        label="Faturação"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Plano e faturas' },
          { id: 'agents', label: 'Por agente', count: agentUsage.length },
          { id: 'history', label: 'Histórico', count: data?.history.length },
        ]}
      />

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}
      {!loading && failed && <InlineError message="Não foi possível carregar a faturação." onRetry={load} />}

      {!loading && data && (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Plano atual e utilização primeiro */}
              <Panel>
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-app-ink">Plano {PLAN_LABELS[cur as Plan]}</h2>
                      {status === 'active' && <Pill tone="pos" dot>Ativo</Pill>}
                      {status === 'trial' && <Pill tone="accent">Período de teste</Pill>}
                      {status === 'pending_payment' && <Pill tone="warn">Aguarda pagamento</Pill>}
                      {status === 'suspended' && <Pill tone="neg">Suspenso</Pill>}
                    </div>
                    <p className="num mt-2 text-2xl font-semibold text-app-ink">
                      {curData.price === 0 ? 'Grátis' : money(curData.price, currency)}
                      {curData.price > 0 && <span className="text-sm font-normal text-app-muted"> / mês</span>}
                    </p>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-app-muted">Renovação</dt><dd className="num text-app-ink">{tenant.subscriptionExpiresAt ? isoDate(tenant.subscriptionExpiresAt) : '—'}{days !== null && days > 0 ? <span className="text-app-faint"> · {days} dias</span> : null}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-app-muted">Agentes</dt><dd className="num text-app-ink">{PLAN_PRICING[cur].agents}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-app-muted">Créditos</dt><dd className="num text-app-ink">{fmt(curData.credits)}{cur === 'free' ? ' (únicos)' : ' / mês'}</dd></div>
                    </dl>
                  </div>
                  <div className="md:border-l md:border-app-rule md:pl-10">
                    <UsageBar
                      used={data.used}
                      total={data.total}
                      caption={data.usedPercent >= 90 ? 'Créditos quase esgotados.' : data.usedPercent >= 70 ? 'Restam menos de 30% dos créditos.' : data.refreshDate ? <>Restam {fmt(data.available)} até <span className="num">{isoDate(data.refreshDate)}</span>.</> : undefined}
                    />
                  </div>
                </div>
              </Panel>

              {/* Comparação de planos */}
              <Panel title="Planos" action={<Link href={ROUTES.plans} className="font-medium text-app-accent hover:underline">Comparar em detalhe</Link>} bodyClassName="p-0 md:p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-app-muted">
                        <th className="px-5 py-2 font-medium" />
                        {PLAN_IDS.map((id) => (
                          <th key={id} className={cx('px-3 py-2 text-right font-medium', id === cur && 'text-app-ink')}>
                            {PLAN_LABELS[id as Plan]}{id === cur && <span className="ml-1.5 text-app-faint">atual</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: `Preço (${currency}, por mês)`, f: (id: PlanId) => (PLAN_PRICING[id][currency].price === 0 ? 'Grátis' : money(PLAN_PRICING[id][currency].price, currency)) },
                        { label: 'Créditos', f: (id: PlanId) => `${fmt(PLAN_PRICING[id][currency].credits)}${id === 'free' ? ' únicos' : ' / mês'}` },
                        { label: 'Agentes', f: (id: PlanId) => (PLAN_PRICING[id].agents === 999 ? '30+' : String(PLAN_PRICING[id].agents)) },
                        { label: 'Preço por 1.000 créditos', f: (id: PlanId) => (PLAN_PRICING[id][currency].price === 0 ? '—' : pricePer1k(id, currency)) },
                      ].map((row) => (
                        <tr key={row.label} className="border-t border-app-rule">
                          <td className="px-5 py-2.5 text-app-muted">{row.label}</td>
                          {PLAN_IDS.map((id) => (
                            <td key={id} className={cx('num px-3 py-2.5 text-right', id === cur ? 'font-semibold text-app-ink' : 'text-app-muted')}>{row.f(id)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-app-rule px-5 py-3 text-sm text-app-muted">
                  {curIdx < PLAN_IDS.length - 1 ? 'Ao subir de plano ganha mais créditos mensais e agentes; ' : ''}
                  {curIdx > 0 ? 'ao descer, os limites passam a ser os do novo plano. ' : ''}
                  O pagamento é pedido em <Link href={ROUTES.plans} className="font-medium text-app-accent hover:underline">Planos</Link>, no momento da mudança.
                </p>
              </Panel>

              {/* Faturas */}
              <Panel title="Faturas">
                {invoices.length === 0 ? (
                  <EmptyState title="Ainda não há faturas" body="Aparecem aqui assim que subscrever um plano pago." action={<Link href={ROUTES.plans} className="btn-secondary">Ver planos</Link>} />
                ) : (
                  <InvoiceTable invoices={invoices.slice(0, 12)} />
                )}
              </Panel>
            </div>
          )}

          {activeTab === 'agents' && (
            <Panel bodyClassName="p-0">
              {agentUsage.length === 0 ? (
                <div className="p-5"><EmptyState title="Sem consumo por agente" body="Os agentes ainda não gastaram créditos." /></div>
              ) : (
                <>
                  <div className="flex justify-between px-5 py-3 text-xs text-app-muted"><span>Agente</span><span>Créditos consumidos</span></div>
                  {agentUsage.slice().sort((a, b) => b.creditsUsed - a.creditsUsed).map((au) => {
                    const pct = data.used > 0 ? (au.creditsUsed / data.used) * 100 : 0;
                    return (
                      <div key={au.agentId} className="border-t border-app-rule px-5 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-medium text-app-ink">{au.agentName}</p>
                          <p className="num text-sm font-medium text-app-ink">{fmt(au.creditsUsed)}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-raised"><div className="h-full rounded-full bg-app-accent" style={{ width: `${pct}%` }} /></div>
                          <span className="num w-20 shrink-0 text-right text-xs text-app-faint">{Math.round(pct)}% do total</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </Panel>
          )}

          {activeTab === 'history' && (
            <Panel bodyClassName="p-0">
              {data.history.length === 0 ? (
                <div className="p-5"><EmptyState title="Sem histórico" body="Os movimentos de créditos ficam registados aqui." /></div>
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
                        <td className={`num px-5 py-3 text-right font-medium ${log.amount > 0 ? 'text-app-pos' : 'text-app-ink'}`}>{log.amount > 0 ? '+' : '−'}{fmt(Math.abs(log.amount))}</td>
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
