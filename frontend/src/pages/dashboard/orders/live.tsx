/**
 * /dashboard/orders/live — Painel de cozinha (KDS)
 * Quadro por estado: Nova, Em preparação, Pronta, Entregue (e "A pagar" à parte).
 * Telemóvel: abas; tablet: 3 colunas; ecrã largo: 5 colunas.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AppLayout from '../../../components/app/AppLayout';
import { EmptyState, PageHeader, Skeleton, Tabs, cx } from '../../../components/app/ui';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../utils/api';

interface Order {
  id: string;
  agentId: string;
  agentName?: string;
  buyerPhone: string;
  amount: number;
  description: string;
  status: 'pending' | 'paid' | 'processing' | 'done' | 'sent' | 'failed' | 'expired';
  createdAt: string;
  paidAt: string | null;
}

const STATUS_COLUMNS = [
  { key: 'pending',    label: 'A pagar' },
  { key: 'paid',       label: 'Nova' },
  { key: 'processing', label: 'Em preparação' },
  { key: 'done',       label: 'Pronta' },
  { key: 'sent',       label: 'Entregue' },
] as const;

type ColKey = typeof STATUS_COLUMNS[number]['key'];

const NEXT_STATUS: Partial<Record<string, string>> = {
  paid: 'processing', processing: 'done', done: 'sent',
};
const NEXT_LABEL: Partial<Record<string, string>> = {
  paid: 'Iniciar preparação', processing: 'Marcar pronta', done: 'Marcar entregue',
};

const eur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

// --- Audio ---------------------------------------------------------------
function playBeep(freq = 880, duration = 0.3, delay = 0) {
  try {
    type AudioCtxCtor = typeof AudioContext;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    const osc = ctx.createOscillator();
    osc.connect(gain);
    osc.frequency.value = freq;
    osc.type = 'sine';
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch { /* ignore */ }
}
function playNewOrderSound() {
  playBeep(880, 0.2, 0);
  playBeep(1100, 0.2, 0.28);
  playBeep(880, 0.15, 0.55);
}

// --- Time helpers ---------------------------------------------------------
function elapsedMin(iso: string) { return (Date.now() - new Date(iso).getTime()) / 60000; }
/** Tempo desde o pedido, por extenso: "agora mesmo", "há 11 min", "há 1 h 05". */
function timeAgo(iso: string) {
  const m = Math.floor(elapsedMin(iso));
  if (m < 1)  return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  return `há ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// --- SLA ------------------------------------------------------------------
interface SlaStage { yellowMin: number; redMin: number; }
interface SLAConfig { stages: Record<'paid' | 'processing' | 'done', SlaStage>; refreshSec: number; }
const DEFAULT_SLA: SLAConfig = {
  stages: { paid: { yellowMin: 3, redMin: 8 }, processing: { yellowMin: 10, redMin: 20 }, done: { yellowMin: 3, redMin: 7 } },
  refreshSec: 5,
};
function loadSLA(): SLAConfig {
  if (typeof window === 'undefined') return DEFAULT_SLA;
  try { return { ...DEFAULT_SLA, ...JSON.parse(localStorage.getItem('kds_sla') ?? '{}') }; }
  catch { return DEFAULT_SLA; }
}
/** Uma só cor de alerta: o pedido está atrasado quando passa o limite crítico da etapa. */
function isLate(mins: number, stage: SlaStage | undefined) {
  return !!stage && mins >= stage.redMin;
}

// --- SLA Modal ------------------------------------------------------------
function SLAModal({ config, onSave, onClose }: { config: SLAConfig; onSave: (c: SLAConfig) => void; onClose: () => void }) {
  const [d, setD] = useState<SLAConfig>(config);
  const upStage = (s: keyof SLAConfig['stages'], k: keyof SlaStage, v: number) =>
    setD(p => ({ ...p, stages: { ...p.stages, [s]: { ...p.stages[s], [k]: Math.max(1, v) } } }));
  const STAGES: { key: keyof SLAConfig['stages']; label: string }[] = [
    { key: 'paid',       label: 'Nova, à espera de preparação' },
    { key: 'processing', label: 'Em preparação' },
    { key: 'done',       label: 'Pronta, à espera de entrega' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Prazos de atraso">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-app-edge bg-app-sheet p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-app-ink">Prazos de atraso</h3>
          <button onClick={onClose} className="btn-ghost -mr-2 h-8 px-2">Fechar</button>
        </div>
        <p className="text-sm text-app-muted">Um pedido fica assinalado como atrasado quando passa estes minutos na etapa.</p>
        {STAGES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3 border-t border-app-rule pt-3">
            <label htmlFor={`sla-${key}`} className="text-sm text-app-ink">{label}</label>
            <input id={`sla-${key}`} type="number" min="1" className="input num w-20 text-right"
              value={d.stages[key].redMin}
              onChange={e => upStage(key, 'redMin', parseInt(e.target.value) || 1)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-app-rule pt-3">
          <label htmlFor="sla-refresh" className="text-sm text-app-ink">Atualizar a cada (s)</label>
          <input id="sla-refresh" type="number" min="3" className="input num w-20 text-right"
            value={d.refreshSec}
            onChange={e => setD(p => ({ ...p, refreshSec: Math.max(3, parseInt(e.target.value) || 5) }))}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => { onSave(d); onClose(); }} className="btn-primary flex-1">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// --- Copy link button -----------------------------------------------------
function CopyLinkButton({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const link = `${window.location.origin}/order-status/${orderId}`;
    navigator.clipboard?.writeText(link)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {
        const el = document.createElement('input');
        el.value = link; document.body.appendChild(el); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
  }
  return (
    <button onClick={copy} title="Copiar link de acompanhamento para o cliente"
      className="text-xs font-medium text-app-muted underline-offset-2 hover:text-app-ink hover:underline">
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  );
}

// --- Order Card -----------------------------------------------------------
function OrderCard({ order, colKey, sla, advancing, onAdvance, fresh }: {
  order: Order; colKey: ColKey; sla: SLAConfig;
  advancing: string | null; onAdvance: (o: Order, t?: 'delivery' | 'pickup') => void; fresh: boolean;
}) {
  const nextStatus = NEXT_STATUS[order.status];
  const nextLabel  = NEXT_LABEL[order.status];
  const isAdv      = advancing === order.id;
  const isFinished = colKey === 'sent' || colKey === 'pending';
  const refTime    = order.paidAt ?? order.createdAt;
  const late       = !isFinished && isLate(elapsedMin(refTime), (sla.stages as Record<string, SlaStage | undefined>)[colKey]);
  const lines      = order.description.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <article
      className={cx(
        'rounded-lg border bg-app-sheet p-3.5',
        late ? 'border-app-neg' : 'border-app-edge',
        fresh && 'ring-2 ring-app-accent/40',
      )}
      aria-label={`Pedido ${order.id.slice(-8).toUpperCase()}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="num text-base font-semibold text-app-ink">#{order.id.slice(-8).toUpperCase()}</p>
        <p className="num text-base font-semibold text-app-ink">{eur(order.amount)}</p>
      </div>
      <p className={cx('num mt-0.5 text-xs', late ? 'font-semibold text-app-neg' : 'text-app-muted')}>
        {late && 'Atrasado · '}{timeAgo(refTime)}
      </p>

      <ul className="mt-2.5 space-y-0.5 text-sm text-app-ink">
        {lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-app-rule pt-2.5">
        <p className="num text-xs text-app-muted">+{order.buyerPhone}</p>
        <CopyLinkButton orderId={order.id} />
      </div>

      {order.status === 'done' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => onAdvance(order, 'delivery')} disabled={isAdv} className="btn-secondary h-10 whitespace-nowrap text-xs">Entrega</button>
          <button onClick={() => onAdvance(order, 'pickup')} disabled={isAdv} className="btn-secondary h-10 text-xs">Retirada</button>
        </div>
      ) : nextStatus && nextLabel ? (
        <button onClick={() => onAdvance(order)} disabled={isAdv} className="btn-secondary mt-3 h-10 w-full whitespace-nowrap text-sm">
          {isAdv ? 'A atualizar…' : nextLabel}
        </button>
      ) : null}
    </article>
  );
}

// --- Column ---------------------------------------------------------------
function KdsColumn({ col, items, sla, advancing, onAdvance, freshIds, laneClass }: {
  col: typeof STATUS_COLUMNS[number];
  items: Order[];
  sla: SLAConfig;
  advancing: string | null;
  onAdvance: (o: Order, t?: 'delivery' | 'pickup') => void;
  freshIds: Set<string>;
  laneClass: string;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl bg-app-raised" aria-label={col.label}>
      <header className="flex items-center justify-between px-3.5 py-3">
        <h2 className="text-sm font-semibold text-app-ink">{col.label}</h2>
        <span className="num text-sm text-app-muted">{items.length}</span>
      </header>
      <div className={cx('space-y-2.5 overflow-y-auto px-2.5 pb-2.5', laneClass)}>
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-app-faint">Sem pedidos</p>
        ) : items.map(order => (
          <OrderCard key={order.id} order={order} colKey={col.key} sla={sla} advancing={advancing} onAdvance={onAdvance} fresh={freshIds.has(order.id)} />
        ))}
      </div>
    </section>
  );
}

// --- Page -----------------------------------------------------------------
export default function OrdersLivePage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [orders, setOrders]               = useState<Order[]>([]);
  const [loading, setLoading]             = useState(true);
  const [advancing, setAdvancing]         = useState<string | null>(null);
  const [fullscreen, setFullscreen]       = useState(false);
  const [lastUpdate, setLastUpdate]       = useState(new Date());
  const [agentFilter, setAgentFilter]     = useState('all');
  const [sla, setSla]                     = useState<SLAConfig>(DEFAULT_SLA);
  const [showSlaConfig, setShowSlaConfig] = useState(false);
  const [activeTab, setActiveTab]         = useState<ColKey>('paid');
  const [, setTick]                       = useState(0);
  const [freshIds, setFreshIds]           = useState<Set<string>>(new Set());
  const [loadError, setLoadError]         = useState(false);

  const knownPaidIds = useRef(new Set<string>());
  const isFirstLoad  = useRef(true);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setSla(loadSLA()); }, []);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const [rPending, rPaid, rProcessing, rDone, rSent] = await Promise.all([
        api.get('/api/payments/orders?status=pending&take=20'),
        api.get('/api/payments/orders?status=paid&take=50'),
        api.get('/api/payments/orders?status=processing&take=50'),
        api.get('/api/payments/orders?status=done&take=20'),
        api.get('/api/payments/orders?status=sent&take=20'),
      ]);
      const paidOrders = rPaid.data.orders as Order[];
      const all: Order[] = [
        ...rPending.data.orders, ...paidOrders,
        ...rProcessing.data.orders, ...rDone.data.orders, ...rSent.data.orders,
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (!isFirstLoad.current) {
        const newOnes = paidOrders.filter(o => !knownPaidIds.current.has(o.id));
        if (newOnes.length > 0) {
          playNewOrderSound(); setActiveTab('paid');
          const ids = newOnes.map(o => o.id);
          setFreshIds(prev => new Set([...Array.from(prev), ...ids]));
          setTimeout(() => setFreshIds(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n; }), 8000);
        }
      }
      paidOrders.forEach(o => knownPaidIds.current.add(o.id));
      isFirstLoad.current = false;
      setOrders(all);
      setLastUpdate(new Date());
      setLoadError(false);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!tenant) { router.replace('/dashboard'); return; }
    fetchOrders();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchOrders, sla.refreshSec * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tenant, router, fetchOrders, sla.refreshSec]);

  async function advanceStatus(order: Order, orderType?: 'delivery' | 'pickup') {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancing(order.id);
    try {
      await api.patch(`/api/payments/orders/${order.id}/status`, { status: next, ...(orderType ? { orderType } : {}) });
      await fetchOrders();
    } catch { /* ignore */ }
    finally { setAdvancing(null); }
  }

  function saveSla(c: SLAConfig) {
    setSla(c);
    if (typeof window !== 'undefined') localStorage.setItem('kds_sla', JSON.stringify(c));
  }

  if (!tenant) return null;

  const agentIds    = Array.from(new Set(orders.map(o => o.agentId)));
  const filtered    = agentFilter === 'all' ? orders : orders.filter(o => o.agentId === agentFilter);
  const colOrders   = (key: ColKey) => filtered.filter(o => o.status === key);
  const totalActive = filtered.filter(o => o.status !== 'sent' && o.status !== 'pending').length;
  const lateCount   = filtered.filter(o => {
    const st = (sla.stages as Record<string, SlaStage | undefined>)[o.status];
    return ['paid', 'processing', 'done'].includes(o.status) && isLate(elapsedMin(o.paidAt ?? o.createdAt), st);
  }).length;
  const time = lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const laneClass = fullscreen ? 'max-h-[calc(100vh-9rem)]' : 'max-h-[calc(100vh-17rem)] min-h-[16rem]';
  const colProps = { sla, advancing, onAdvance: advanceStatus, freshIds, laneClass };

  const board = (
    <>
      <Tabs<ColKey>
        label="Estados dos pedidos"
        value={activeTab}
        onChange={setActiveTab}
        tabs={STATUS_COLUMNS.map(c => ({ id: c.key, label: c.label, count: colOrders(c.key).length }))}
      />
      {/* Telemóvel: uma coluna por aba */}
      <div className="space-y-2.5 md:hidden">
        {colOrders(activeTab).length === 0 ? (
          <EmptyState title="Sem pedidos nesta etapa" body="Os pedidos novos aparecem aqui assim que são pagos." />
        ) : colOrders(activeTab).map(order => (
          <OrderCard key={order.id} order={order} colKey={activeTab} sla={sla} advancing={advancing} onAdvance={advanceStatus} fresh={freshIds.has(order.id)} />
        ))}
      </div>
    </>
  );

  const content = (
    <>
      <Head><title>Agentfy · Pedidos em direto</title></Head>
      <PageHeader
        title="Pedidos em direto"
        subtitle={
          <>
            <span className="num">{totalActive}</span> {totalActive === 1 ? 'pedido ativo' : 'pedidos ativos'}
            {lateCount > 0 && <> · <span className="font-medium text-app-neg"><span className="num">{lateCount}</span> {lateCount === 1 ? 'atrasado' : 'atrasados'}</span></>}
            {colOrders('pending').length > 0 && <span className="2xl:hidden"> · <span className="num">{colOrders('pending').length}</span> a pagar</span>}
            <span className="hidden sm:inline"> · atualizado às <span className="num">{time}</span></span>
          </>
        }
        actions={
          <>
            {agentIds.length > 1 && (
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} aria-label="Filtrar por agente" className="input h-9 w-auto pr-9">
                <option value="all">Todos os agentes</option>
                {agentIds.map(id => <option key={id} value={id}>{orders.find(o => o.agentId === id)?.agentName ?? `…${id.slice(-6)}`}</option>)}
              </select>
            )}
            <button onClick={() => fetchOrders()} className="btn-ghost hidden sm:inline-flex">Atualizar</button>
            <button onClick={() => setShowSlaConfig(true)} className="btn-secondary">Prazos</button>
            <button onClick={() => setFullscreen(f => !f)} className="btn-secondary hidden sm:inline-flex">{fullscreen ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}</button>
          </>
        }
      />

      {loadError && !loading && (
        <p role="alert" className="mb-4 rounded-lg bg-app-neg-soft px-4 py-2 text-sm text-app-neg">
          Sem ligação ao servidor. A mostrar os últimos pedidos conhecidos; <button onClick={() => fetchOrders()} className="font-semibold underline underline-offset-2">tentar de novo</button>.
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={cx('space-y-2.5 rounded-xl bg-app-raised p-2.5', i > 2 ? 'hidden xl:block' : i > 0 && 'hidden md:block')}>
              <Skeleton className="h-5 w-24" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="md:hidden">{board}</div>
          <div className="hidden md:block">
            {/* Tablet: 3 colunas; desktop: 4; ecrã muito largo: 5 (com "A pagar") */}
            <div className="grid grid-cols-3 gap-3 xl:grid-cols-4 2xl:grid-cols-5">
              {STATUS_COLUMNS.map(col => (
                <div key={col.key} className={cx(col.key === 'pending' && 'hidden 2xl:block', col.key === 'sent' && 'hidden xl:block')}>
                  <KdsColumn col={col} items={colOrders(col.key)} {...colProps} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showSlaConfig && <SLAModal config={sla} onSave={saveSla} onClose={() => setShowSlaConfig(false)} />}
    </>
  );

  if (fullscreen) {
    return <div className="fixed inset-0 z-40 overflow-y-auto bg-app-sheet px-4 py-5 text-app-ink sm:px-6">{content}</div>;
  }
  return <AppLayout wide>{content}</AppLayout>;
}
