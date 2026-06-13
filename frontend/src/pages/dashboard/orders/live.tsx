/**
 * /dashboard/orders/live — Painel KDS (Kitchen Display System)
 * Responsivo: tabs no mobile, 3 colunas no tablet, 5 colunas no desktop
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
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
  { key: 'pending',    label: 'A Pagar',    icon: '⏳', color: 'yellow',  badge: 'bg-yellow-500' },
  { key: 'paid',       label: 'Novo',       icon: '🔔', color: 'orange',  badge: 'bg-orange-500' },
  { key: 'processing', label: 'A Preparar', icon: '⚙️',  color: 'blue',    badge: 'bg-blue-500'   },
  { key: 'done',       label: 'Pronto',     icon: '✅', color: 'green',   badge: 'bg-green-500'  },
  { key: 'sent',       label: 'Enviado',    icon: '🚗', color: 'purple',  badge: 'bg-purple-500' },
] as const;

type ColKey = typeof STATUS_COLUMNS[number]['key'];

const NEXT_STATUS: Partial<Record<string, string>> = {
  paid: 'processing', processing: 'done', done: 'sent',
};
const NEXT_LABEL: Partial<Record<string, string>> = {
  paid: 'Iniciar preparo', processing: 'Marcar pronto', done: 'Marcar enviado',
};

const COL_STYLES: Record<string, { card: string; amount: string; btn: string; header: string }> = {
  pending:    { card: 'border-yellow-600/50 bg-yellow-950/20',  amount: 'text-yellow-400', btn: 'bg-yellow-600 hover:bg-yellow-500', header: 'text-yellow-300'  },
  paid:       { card: 'border-orange-500/60 bg-orange-950/30',  amount: 'text-orange-400', btn: 'bg-orange-500 hover:bg-orange-400', header: 'text-orange-300'  },
  processing: { card: 'border-blue-500/50   bg-blue-950/20',    amount: 'text-blue-400',   btn: 'bg-blue-500   hover:bg-blue-400',   header: 'text-blue-300'    },
  done:       { card: 'border-green-500/50  bg-green-950/20',   amount: 'text-green-400',  btn: 'bg-green-600  hover:bg-green-500',  header: 'text-green-300'   },
  sent:       { card: 'border-purple-600/40 bg-purple-950/20',  amount: 'text-purple-400', btn: '',                                  header: 'text-purple-300'  },
};

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
function formatElapsed(m: number) {
  if (m < 1)  return '< 1m';
  if (m < 60) return `${Math.floor(m)}m`;
  return `${Math.floor(m / 60)}h${String(Math.floor(m % 60)).padStart(2, '0')}m`;
}
function timeAgo(iso: string) {
  const m = Math.floor(elapsedMin(iso));
  if (m < 1)  return 'agora';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h`;
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
function getSlaColors(mins: number, stage: SlaStage | undefined) {
  if (!stage) return null;
  if (mins < stage.yellowMin) return { dot: 'bg-green-400',  text: 'text-green-400',  ring: 'ring-green-500/20',  pulse: false };
  if (mins < stage.redMin)    return { dot: 'bg-yellow-400', text: 'text-yellow-300', ring: 'ring-yellow-500/30', pulse: false };
  return                             { dot: 'bg-red-500',    text: 'text-red-400',    ring: 'ring-red-500/40',    pulse: true  };
}

// --- SLA Modal ------------------------------------------------------------
function SLAModal({ config, onSave, onClose }: { config: SLAConfig; onSave: (c: SLAConfig) => void; onClose: () => void }) {
  const [d, setD] = useState<SLAConfig>(config);
  const upStage = (s: keyof SLAConfig['stages'], k: keyof SlaStage, v: number) =>
    setD(p => ({ ...p, stages: { ...p.stages, [s]: { ...p.stages[s], [k]: Math.max(1, v) } } }));
  const STAGES: { key: keyof SLAConfig['stages']; icon: string; label: string }[] = [
    { key: 'paid',       icon: '🔔', label: 'Novo — aguarda preparo'    },
    { key: 'processing', icon: '⚙️',  label: 'A Preparar'                    },
    { key: 'done',       icon: '✅',        label: 'Pronto — aguarda retirada' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base">⚙️ Configurar SLA</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 text-xl">×</button>
        </div>
        {STAGES.map(({ key, icon, label }) => (
          <div key={key} className="rounded-xl p-3 space-y-2 border border-gray-700 bg-gray-700/30">
            <p className="text-xs font-semibold text-gray-200">{icon} {label}</p>
            <div className="grid grid-cols-2 gap-2">
              {([['yellowMin', '🟡 Alerta (min)', 'text-yellow-400'], ['redMin', '🔴 Crítico (min)', 'text-red-400']] as const).map(([field, lbl, cls]) => (
                <div key={field}>
                  <label className={`text-[10px] ${cls} block mb-1`}>{lbl}</label>
                  <input type="number" min="1"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    value={d.stages[key][field]}
                    onChange={e => upStage(key, field, parseInt(e.target.value) || 1)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">🔄 Actualizar a cada (seg)</label>
          <input type="number" min="3"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
            value={d.refreshSec}
            onChange={e => setD(p => ({ ...p, refreshSec: Math.max(3, parseInt(e.target.value) || 5) }))}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors">Cancelar</button>
          <button onClick={() => { onSave(d); onClose(); }} className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors">Guardar</button>
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
    <button onClick={copy} title="Copiar link de rastreio para o cliente"
      className={`text-[10px] px-2.5 py-1 rounded-lg transition-all ${copied ? 'bg-green-700 text-green-200' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
      {copied ? '✓ Copiado!' : '🔗 Link'}
    </button>
  );
}

// --- Order Card -----------------------------------------------------------
function OrderCard({ order, colKey, sla, advancing, onAdvance }: {
  order: Order; colKey: ColKey; sla: SLAConfig;
  advancing: string | null; onAdvance: (o: Order, t?: 'delivery' | 'pickup') => void;
}) {
  const nextStatus = NEXT_STATUS[order.status];
  const nextLabel  = NEXT_LABEL[order.status];
  const isAdv      = advancing === order.id;
  const isFinished = colKey === 'sent';
  const refTime    = order.paidAt ?? order.createdAt;
  const mins       = elapsedMin(refTime);
  const stageSla   = (sla.stages as Record<string, SlaStage | undefined>)[colKey];
  const slac       = isFinished ? null : getSlaColors(mins, stageSla);
  const styles     = COL_STYLES[colKey];

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${styles.card} ${slac?.ring ? `ring-2 ${slac.ring}` : ''} ${slac?.pulse ? 'shadow-lg shadow-red-900/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-2xl font-extrabold leading-none ${styles.amount}`}>€{order.amount.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">#{order.id.slice(-8).toUpperCase()}</p>
        </div>
        {!isFinished && slac ? (
          <div className="flex items-center gap-1.5 bg-gray-900/40 rounded-lg px-2 py-1">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${slac.dot} ${slac.pulse ? 'animate-pulse' : ''}`} />
            <span className={`text-sm font-mono font-bold ${slac.text}`}>{formatElapsed(mins)}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-500 bg-gray-900/30 rounded-lg px-2 py-1">{timeAgo(refTime)}</span>
        )}
      </div>

      <p className="text-sm font-semibold text-gray-100 leading-snug">{order.description}</p>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">📱 +{order.buyerPhone}</p>
        <CopyLinkButton orderId={order.id} />
      </div>

      {order.status === 'done' ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => onAdvance(order, 'delivery')} disabled={isAdv}
            className="py-3 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white transition-all active:scale-95 disabled:opacity-40 shadow-sm">
            {isAdv ? '⏳' : '🚗 Entrega'}
          </button>
          <button onClick={() => onAdvance(order, 'pickup')} disabled={isAdv}
            className="py-3 rounded-xl text-xs font-bold bg-green-700 hover:bg-green-600 active:bg-green-800 text-white transition-all active:scale-95 disabled:opacity-40 shadow-sm">
            {isAdv ? '⏳' : '🏪 Retirada'}
          </button>
        </div>
      ) : nextStatus && nextLabel ? (
        <button onClick={() => onAdvance(order)} disabled={isAdv}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm ${styles.btn}`}>
          {isAdv ? '⏳ A actualizar...' : nextLabel + ' →'}
        </button>
      ) : null}
    </div>
  );
}

// --- Column (reused by tablet + desktop) ----------------------------------
function KdsColumn({ col, items, sla, advancing, onAdvance, stickyTop }: {
  col: typeof STATUS_COLUMNS[number];
  items: Order[];
  sla: SLAConfig;
  advancing: string | null;
  onAdvance: (o: Order, t?: 'delivery' | 'pickup') => void;
  stickyTop: string;
}) {
  const styles = COL_STYLES[col.key];
  return (
    <div className="flex flex-col min-h-0">
      <div className={`flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 sticky ${stickyTop} z-10`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{col.icon}</span>
          <span className={`text-sm font-bold ${styles.header}`}>{col.label}</span>
        </div>
        {items.length > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${col.badge}`}>{items.length}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-700">
            <span className="text-3xl opacity-20">{col.icon}</span>
            <p className="text-xs">Vazio</p>
          </div>
        ) : items.map(order => (
          <OrderCard key={order.id} order={order} colKey={col.key as ColKey} sla={sla} advancing={advancing} onAdvance={onAdvance} />
        ))}
      </div>
    </div>
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
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (!isFirstLoad.current) {
        const newOnes = paidOrders.filter(o => !knownPaidIds.current.has(o.id));
        if (newOnes.length > 0) { playNewOrderSound(); setActiveTab('paid'); }
      }
      paidOrders.forEach(o => knownPaidIds.current.add(o.id));
      isFirstLoad.current = false;
      setOrders(all);
      setLastUpdate(new Date());
    } catch { /* ignore */ }
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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Head><title>Agentfy — Painel de Pedidos</title></Head>

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          {!fullscreen && (
            <button onClick={() => router.back()}
              className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0 transition-colors">
              ←
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🍽️</span>
            <div className="min-w-0">
              <h1 className="font-bold text-white text-sm leading-none">Fila de Pedidos</h1>
              <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">
                ⟳ {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                {totalActive > 0 && <span className="ml-2 text-orange-400 font-semibold">{totalActive} activos</span>}
              </p>
            </div>
          </div>
          {agentIds.length > 1 && (
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 hidden sm:block">
              <option value="all">Todos os agentes</option>
              {agentIds.map(id => <option key={id} value={id}>…{id.slice(-6)}</option>)}
            </select>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" /> no prazo</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /> atenção</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> crítico</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => fetchOrders()}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors hidden sm:block">
            🔄
          </button>
          <button onClick={() => setShowSlaConfig(true)}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors">
            ⚙️ SLA
          </button>
          <button onClick={() => setFullscreen(f => !f)}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors hidden sm:block">
            {fullscreen ? '⤥' : '⤢'}
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
          <div className="w-8 h-8 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm">A carregar pedidos...</p>
        </div>
      )}

      {!loading && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* MOBILE: tab bar (< md) */}
          <div className="md:hidden flex overflow-x-auto bg-gray-900 border-b border-gray-800 px-2 gap-1">
            {STATUS_COLUMNS.map(col => {
              const count    = colOrders(col.key).length;
              const isActive = activeTab === col.key;
              return (
                <button key={col.key} onClick={() => setActiveTab(col.key)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                    isActive ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}>
                  <span>{col.icon}</span>
                  <span>{col.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${col.badge}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* MOBILE: single column content */}
          <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3 pb-20">
            {colOrders(activeTab).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-700">
                <span className="text-5xl opacity-20">{STATUS_COLUMNS.find(c => c.key === activeTab)?.icon}</span>
                <p className="text-sm">Sem pedidos nesta etapa</p>
              </div>
            ) : colOrders(activeTab).map(order => (
              <OrderCard key={order.id} order={order} colKey={activeTab} sla={sla} advancing={advancing} onAdvance={advanceStatus} />
            ))}
          </div>

          {/* TABLET: 3 columns (md, hidden on lg+) */}
          <div className="hidden md:grid lg:hidden grid-cols-3 flex-1 divide-x divide-gray-800 overflow-hidden">
            {STATUS_COLUMNS.filter(c => ['paid', 'processing', 'done'].includes(c.key)).map(col => (
              <KdsColumn key={col.key} col={col} items={colOrders(col.key)} sla={sla}
                advancing={advancing} onAdvance={advanceStatus} stickyTop="top-[57px]" />
            ))}
          </div>

          {/* DESKTOP: 5 columns (lg+) */}
          <div className="hidden lg:grid lg:grid-cols-5 flex-1 divide-x divide-gray-800 overflow-hidden">
            {STATUS_COLUMNS.map(col => (
              <KdsColumn key={col.key} col={col} items={colOrders(col.key)} sla={sla}
                advancing={advancing} onAdvance={advanceStatus} stickyTop="top-[57px]" />
            ))}
          </div>

        </div>
      )}

      {/* MOBILE: bottom bar */}
      {!loading && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            ⟳ {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {totalActive > 0 ? (
            <span className="text-xs font-bold text-orange-400">{totalActive} pedido{totalActive !== 1 ? 's' : ''} activo{totalActive !== 1 ? 's' : ''}</span>
          ) : (
            <span className="text-xs text-gray-600">Sem pedidos activos</span>
          )}
          <button onClick={() => fetchOrders()} className="text-xs text-gray-500 hover:text-white transition-colors">🔄 Actualizar</button>
        </div>
      )}

      {showSlaConfig && (
        <SLAModal config={sla} onSave={saveSla} onClose={() => setShowSlaConfig(false)} />
      )}
    </div>
  );
}
