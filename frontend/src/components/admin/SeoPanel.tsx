import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../utils/api';
import { cx, InlineError, KpiStrip, Panel, Pill, Skeleton } from '../app/ui';
import type { PillTone } from '../app/ui';

interface Overview {
  range: { from: string; to: string; days: number };
  totals: { views: number; visitors: number; viewsPerVisitor: number; signups: number; signupRate: number };
  previous: { views: number; visitors: number; signups: number };
  byDay: { date: string; views: number; visitors: number; signups: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  referrers: { host: string; visitors: number }[];
  campaigns: { source: string; medium: string; campaign: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  countries: { country: string; visitors: number }[];
  locales: { locale: string; visitors: number }[];
}

interface HealthPage {
  url: string; status: number; title: string | null; titleLength: number; description: string | null; descriptionLength: number;
  h1Count: number; canonical: string | null; hreflang: string[]; ogImage: string | null; jsonLdTypes: string[]; wordCount: number; issues: string[];
}
interface Health {
  checkedAt: string; sitemapUrl: string; pages: HealthPage[];
  summary: { pages: number; withIssues: number; issueCounts: Record<string, number> };
}

const RANGES = [7, 30, 90] as const;
const int = (v: number) => v.toLocaleString('pt-PT');
const dec = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const ISSUE_LABELS: Record<string, string> = {
  missing_title: 'Sem título',
  title_too_short: 'Título curto',
  title_too_long: 'Título longo',
  missing_description: 'Sem descrição',
  description_too_short: 'Descrição curta',
  description_too_long: 'Descrição longa',
  missing_h1: 'Sem H1',
  multiple_h1: 'Vários H1',
  missing_canonical: 'Sem canonical',
  missing_og_image: 'Sem imagem OG',
  missing_hreflang: 'Sem hreflang',
  missing_jsonld: 'Sem JSON-LD',
  missing_json_ld: 'Sem JSON-LD',
  thin_content: 'Pouco texto',
  not_ok: 'Resposta com erro',
  http_error: 'Resposta com erro',
  fetch_failed: 'Não carregou',
  noindex: 'Marcada noindex',
};
const issueLabel = (c: string) => ISSUE_LABELS[c] ?? c.replace(/[_-]+/g, ' ').replace(/^./, (m) => m.toUpperCase());

const DEVICE_LABELS: Record<string, string> = { desktop: 'Computador', mobile: 'Telemóvel', tablet: 'Tablet', unknown: 'Desconhecido' };

function fmtDay(d: string, withYear = false) {
  const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  return dt.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace('.', '');
}

/** Variação em palavras, com a base nomeada. Cor só quando é boa/má. */
function delta(cur: number, prev: number, days: number, unit: string): { text: string; good: boolean } {
  const base = `vs. ${days} dias anteriores`;
  if (!prev) return { text: cur ? `${unit} novos · ${base}` : `Sem dados · ${base}`, good: false };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: `Igual · ${base}`, good: false };
  return { text: `${pct > 0 ? 'Mais' : 'Menos'} ${Math.abs(pct)}% ${base}`, good: pct > 0 };
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { payload: Overview['byDay'][number] }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-app-edge bg-app-sheet px-3 py-2 text-xs text-app-ink">
      <p className="mb-1 font-semibold">{fmtDay(label ?? p.date, true)}</p>
      <p className="num text-app-muted">{int(p.visitors)} visitantes · {int(p.views)} visitas</p>
      <p className="num text-app-muted">{int(p.signups)} registos</p>
    </div>
  );
}

function VisitorsChart({ byDay }: { byDay: Overview['byDay'] }) {
  const max = Math.max(1, ...byDay.map((d) => d.visitors));
  const m = Math.pow(10, Math.floor(Math.log10(Math.max(1, max / 4))));
  const top = 4 * ([1, 2, 5, 10].map((c) => c * m).find((c) => c * 4 >= max) ?? m * 10);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const total = byDay.reduce((s, d) => s + d.visitors, 0);
  return (
    <div className="h-[260px] w-full" role="img" aria-label={`Visitantes por dia, total ${total}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--app-rule))" />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDay(d)} tick={{ fill: 'rgb(var(--app-faint))', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgb(var(--app-rule))' }} minTickGap={28} />
          <YAxis ticks={ticks} domain={[0, top]} tick={{ fill: 'rgb(var(--app-faint))', fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => int(v)} />
          <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgb(var(--app-control))' }} />
          <Line type="linear" dataKey="visitors" stroke="rgb(var(--app-accent))" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'rgb(var(--app-accent))', stroke: 'rgb(var(--app-sheet))' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Lista de barras finas: nome, barra de 4px, valor. Uma só cor. */
function BarList({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-app-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-app-ink">{r.label}</span>
            <span className="num shrink-0 text-app-muted">{int(r.value)}</span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-app-raised">
            <div className="h-1 rounded-full bg-app-accent" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function errMsg(e: unknown, what: string) {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 404) return `${what}: o servidor ainda não tem esta rota (404). Quando a API de SEO estiver publicada, os dados aparecem aqui.`;
  if (status === 500) return `${what}: o servidor devolveu um erro (500).`;
  return `${what}: não foi possível carregar agora.`;
}

function lenTone(n: number, min: number, max: number): string {
  if (n === 0) return 'text-app-neg';
  return n < min || n > max ? 'text-app-warn' : 'text-app-ink';
}

export default function SeoPanel() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [ov, setOv] = useState<Overview | null>(null);
  const [ovErr, setOvErr] = useState<string | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);
  const [hErr, setHErr] = useState<string | null>(null);
  const [hLoading, setHLoading] = useState(true);

  const loadOverview = useCallback(async (d: number) => {
    setOvLoading(true); setOvErr(null);
    try { const r = await api.get('/api/admin/seo/overview', { params: { days: d } }); setOv(r.data); }
    catch (e) { setOv(null); setOvErr(errMsg(e, 'Visitas')); }
    finally { setOvLoading(false); }
  }, []);
  const loadHealth = useCallback(async () => {
    setHLoading(true); setHErr(null);
    try { const r = await api.get('/api/admin/seo/health'); setHealth(r.data); }
    catch (e) { setHealth(null); setHErr(errMsg(e, 'Saúde de SEO')); }
    finally { setHLoading(false); }
  }, []);

  useEffect(() => { loadOverview(days); }, [days, loadOverview]);
  useEffect(() => { loadHealth(); }, [loadHealth]);

  const kpis = useMemo(() => {
    if (!ov) return null;
    const d = ov.range.days;
    const t = ov.totals;
    const p = ov.previous;
    const dv = delta(t.views, p.views, d, 'Visitas');
    const dvis = delta(t.visitors, p.visitors, d, 'Visitantes');
    const prevPer = p.visitors ? p.views / p.visitors : 0;
    const dper = delta(t.viewsPerVisitor, prevPer, d, 'Páginas');
    const dsig = delta(t.signups, p.signups, d, 'Registos');
    return { dv, dvis, dper, dsig };
  }, [ov]);

  const cell = (good: boolean, text: string) => <span className={good ? 'text-app-pos' : 'text-app-faint'}>{text}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-app-muted">
          {ov ? <>De {fmtDay(ov.range.from)} a {fmtDay(ov.range.to, true)}</> : 'Visitas ao site público e saúde das páginas indexáveis.'}
        </p>
        <div role="group" aria-label="Período" className="inline-flex rounded-lg border border-app-control p-0.5">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}
              className={cx('h-8 rounded-md px-3 text-sm font-medium transition-colors', days === r ? 'bg-app-ink text-app-sheet' : 'text-app-muted hover:text-app-ink')}>
              {r} dias
            </button>
          ))}
        </div>
      </div>

      {ovErr ? (
        <InlineError message={ovErr} onRetry={() => loadOverview(days)} />
      ) : (
        <>
          <KpiStrip
            items={[
              { label: 'Visitas', value: ov ? int(ov.totals.views) : <Skeleton className="h-8 w-20" />, caption: kpis ? cell(kpis.dv.good, kpis.dv.text) : undefined, tone: kpis?.dv.good ? 'pos' : 'default' },
              { label: 'Visitantes', value: ov ? int(ov.totals.visitors) : <Skeleton className="h-8 w-20" />, caption: kpis ? cell(kpis.dvis.good, kpis.dvis.text) : undefined, tone: kpis?.dvis.good ? 'pos' : 'default' },
              { label: 'Páginas por visitante', value: ov ? dec(ov.totals.viewsPerVisitor) : <Skeleton className="h-8 w-16" />, caption: kpis ? cell(kpis.dper.good, kpis.dper.text) : undefined, tone: kpis?.dper.good ? 'pos' : 'default' },
              { label: 'Registos', value: ov ? int(ov.totals.signups) : <Skeleton className="h-8 w-16" />, caption: ov && kpis ? <>{dec(ov.totals.signupRate * (ov.totals.signupRate <= 1 ? 100 : 1))}% dos visitantes · {cell(kpis.dsig.good, kpis.dsig.text)}</> : undefined, tone: kpis?.dsig.good ? 'pos' : 'default' },
            ]}
          />

          <Panel title="Visitantes por dia" action={ov ? `${ov.range.days} dias` : undefined}>
            {ovLoading && !ov ? <Skeleton className="h-[260px] w-full" /> : ov && ov.byDay.length ? <VisitorsChart byDay={ov.byDay} /> : <p className="text-sm text-app-muted">Sem visitas registadas neste período.</p>}
          </Panel>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Panel title="Páginas mais vistas" action="Visitas e visitantes">
              {!ov ? <Skeleton className="h-40 w-full" /> : ov.topPages.length === 0 ? <p className="text-sm text-app-muted">Ainda sem páginas vistas.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-app-muted"><th className="pb-2 text-left font-normal">Página</th><th className="pb-2 text-right font-normal">Visitas</th><th className="pb-2 pl-4 text-right font-normal">Visitantes</th></tr></thead>
                  <tbody>
                    {ov.topPages.map((p) => (
                      <tr key={p.path} className="border-t border-app-rule">
                        <td className="max-w-0 truncate py-2.5 pr-3 font-mono text-xs text-app-ink" title={p.path}>{p.path}</td>
                        <td className="num py-2.5 text-right text-app-ink">{int(p.views)}</td>
                        <td className="num py-2.5 pl-4 text-right text-app-muted">{int(p.visitors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
            <div className="flex flex-col gap-4">
              <Panel title="Origem" action="Visitantes">
                {!ov ? <Skeleton className="h-40 w-full" /> : <BarList rows={ov.referrers.map((r) => ({ label: r.host || 'Direto', value: r.visitors }))} empty="Sem origens registadas." />}
              </Panel>
              <Panel title="Dispositivos" action="Visitantes">
                {!ov ? <Skeleton className="h-16 w-full" /> : <BarList rows={ov.devices.map((d) => ({ label: DEVICE_LABELS[d.device] ?? d.device, value: d.visitors }))} empty="Sem dados." />}
              </Panel>
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Panel title="Países" action="Visitantes">
              {!ov ? <Skeleton className="h-16 w-full" /> : <BarList rows={ov.countries.map((d) => ({ label: d.country, value: d.visitors }))} empty="Sem dados." />}
            </Panel>
            <Panel title="Idiomas" action="Visitantes">
              {!ov ? <Skeleton className="h-16 w-full" /> : <BarList rows={ov.locales.map((d) => ({ label: d.locale, value: d.visitors }))} empty="Sem dados." />}
            </Panel>
            <Panel title="Campanhas UTM" action="Visitantes">
              {!ov ? <Skeleton className="h-16 w-full" /> : ov.campaigns.length === 0 ? (
                <p className="text-sm text-app-muted">Nenhuma visita com UTM neste período. Adicione ?utm_source=…&utm_campaign=… aos links de campanhas.</p>
              ) : (
                <ul>
                  {ov.campaigns.map((c, i) => (
                    <li key={i} className={cx('flex items-baseline justify-between gap-3 py-2', i > 0 && 'border-t border-app-rule')}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-app-ink">{c.campaign || '—'}</span>
                        <span className="block truncate text-xs text-app-muted">{c.source || '—'} / {c.medium || '—'}</span>
                      </span>
                      <span className="num shrink-0 text-sm text-app-ink">{int(c.visitors)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="Saúde de SEO"
        action={health ? <button type="button" onClick={loadHealth} className="font-semibold text-app-accent hover:underline">Verificar de novo</button> : undefined}
      >
        {hErr ? (
          <InlineError message={hErr} onRetry={loadHealth} />
        ) : hLoading && !health ? (
          <Skeleton className="h-48 w-full" />
        ) : health ? (
          <>
            <p className="mb-3 text-sm text-app-muted">
              <span className="num font-semibold text-app-ink">{health.summary.pages}</span> páginas ·{' '}
              <span className={cx('num font-semibold', health.summary.withIssues ? 'text-app-warn' : 'text-app-pos')}>{health.summary.withIssues}</span> com problemas
              <span className="text-app-faint"> · Verificado às {new Date(health.checkedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} a partir de {health.sitemapUrl.replace(/^https?:\/\//, '')}</span>
            </p>
            {Object.keys(health.summary.issueCounts).length > 0 && (
              <p className="mb-3 flex flex-wrap gap-1.5">
                {Object.entries(health.summary.issueCounts).map(([k, n]) => <Pill key={k} tone="warn">{issueLabel(k)} · {n}</Pill>)}
              </p>
            )}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-xs text-app-muted">
                    <th className="pb-2 text-left font-normal">Página</th>
                    <th className="pb-2 pl-4 text-right font-normal">Título</th>
                    <th className="pb-2 pl-4 text-right font-normal">Descrição</th>
                    <th className="pb-2 pl-4 text-right font-normal">H1</th>
                    <th className="pb-2 pl-4 text-left font-normal">Canonical</th>
                    <th className="pb-2 pl-4 text-right font-normal">Hreflang</th>
                    <th className="pb-2 pl-4 text-left font-normal">OG</th>
                    <th className="pb-2 pl-4 text-left font-normal">JSON-LD</th>
                    <th className="pb-2 pl-4 text-left font-normal">Problemas</th>
                  </tr>
                </thead>
                <tbody>
                  {health.pages.map((p) => (
                    <tr key={p.url} className="border-t border-app-rule align-top">
                      <td className="max-w-[220px] py-2.5 pr-3">
                        <span className="block truncate font-mono text-xs text-app-ink" title={p.url}>{pathOf(p.url)}</span>
                        {p.status !== 200 && <span className="text-xs text-app-neg">HTTP {p.status}</span>}
                      </td>
                      <td className={cx('num py-2.5 pl-4 text-right', lenTone(p.titleLength, 30, 60))}>{p.titleLength}</td>
                      <td className={cx('num py-2.5 pl-4 text-right', lenTone(p.descriptionLength, 70, 160))}>{p.descriptionLength}</td>
                      <td className={cx('num py-2.5 pl-4 text-right', p.h1Count === 1 ? 'text-app-ink' : 'text-app-warn')}>{p.h1Count}</td>
                      <td className="py-2.5 pl-4 text-app-muted">{p.canonical ? 'Sim' : <span className="text-app-warn">Não</span>}</td>
                      <td className="num py-2.5 pl-4 text-right text-app-muted">{p.hreflang.length}</td>
                      <td className="py-2.5 pl-4 text-app-muted">{p.ogImage ? 'Sim' : <span className="text-app-warn">Não</span>}</td>
                      <td className="max-w-[160px] py-2.5 pl-4 pr-3 text-xs text-app-muted">{p.jsonLdTypes.length ? p.jsonLdTypes.join(', ') : '—'}</td>
                      <td className="py-2.5 pl-4">
                        {p.issues.length ? <span className="flex flex-wrap gap-1">{p.issues.map((c) => <Pill key={c} tone="warn">{issueLabel(c)}</Pill>)}</span> : <span className="text-app-pos">Sem problemas</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden">
              {health.pages.map((p, i) => (
                <li key={p.url} className={cx('py-3', i > 0 && 'border-t border-app-rule')}>
                  <p className="truncate font-mono text-xs text-app-ink">{pathOf(p.url)}</p>
                  <p className="num mt-1 text-xs text-app-muted">Título {p.titleLength} · Descrição {p.descriptionLength} · H1 {p.h1Count} · hreflang {p.hreflang.length}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {p.issues.length ? p.issues.map((c) => <Pill key={c} tone="warn">{issueLabel(c)}</Pill>) : <span className="text-xs text-app-pos">Sem problemas</span>}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Panel>

      <div className="rounded-xl border border-dashed border-app-edge px-5 py-4">
        <p className="text-sm font-semibold text-app-ink">Google Search Console</p>
        <p className="mt-1 text-sm text-app-muted">Ligar para ver pesquisas, impressões e posição. Ainda não está implementado, por isso não mostramos números aqui.</p>
      </div>
    </div>
  );
}

function pathOf(u: string) {
  try { const x = new URL(u); return x.pathname + x.search || '/'; } catch { return u; }
}
