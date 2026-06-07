/**
 * /dashboard/orders/live — Painel KDS (Kitchen Display System)
 * Features:
 *  - Alerta sonoro quando entra um novo pedido (coluna Novo)
 *  - Cronómetro por pedido + semáforo SLA (verde → amarelo → vermelho)
 *  - Limiares SLA configuráveis (clica no ícone ⚙ no header)
 *  - Link público para o cliente acompanhar o pedido
 *  - Refresh automático configurável
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
  status: 'pending' | 'paid' | 'processing' | 'done' | 'failed' | 'expired';
  createdAt: string;
  paidAt: string | null;
}

const STATUS_COLUMNS = [
  { key: 'paid',       label: '🔔 Novo',          badge: 'bg-orange-500 text-white' },
  { key: 'processing', label: '⚙ Em Preparação', badge: 'bg-blue-500 text-white'   },
  { key: 'done',       label: '✅ Pronto',         badge: 'bg-green-500 text-white'  },
] as const;

const NEXT_STATUS: Partial<Record<string, string>> = { paid: 'processing', processing: 'done' };
const NEXT_LABEL:  Partial<Record<string, string>> = { paid: 'Iniciar preparo →', processing: 'Marcar pronto ✓' };

// ─── Web Audio beep (no external files) ──────────────────────────────────────
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
  } catch { /* ignore: AudioContext not supported */ }
}

function playNewOrderSound() {
  playBeep(880, 0.2, 0);
  playBeep(1100, 0.2, 0.28);
  playBeep(880, 0.15, 0.55);
}

// ─── SLA helpers ─────────────────────────────────────────────────────────────
function elapsedMin(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function formatElapsed(mins: number): string {
  if (mins < 1)  return '< 1m';
  if (mins < 60) return `${Math.floor(mins)}m`;
  return `${Math.floor(mins / 60)}h${Math.floor(mins % 60)}m`;
}

function timeAgo(iso: string): string {
  const mins = Math.floor(elapsedMin(iso));
  if (mins < 1)  return 'agora';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h`;
}

interface SlaColors { dot: string; text: string; border: string; pulse: boolean; }
function slaColors(mins: number, yellow: number, red: number): SlaColors {
  if (mins < yellow) return { dot: 'bg-green-400',  text: 'text-green-400',  border: 'border-green-600',                pulse: false };
  if (mins < red)    return { dot: 'bg-yellow-400', text: 'text-yellow-400', border: 'border-yellow-500',               pulse: false };
  return               { dot: 'bg-red-500',    text: 'text-red-400',    border: 'border-red-500 shadow-red-900/50', pulse: true  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CopyLinkButton({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const link = `${window.location.origin}/order-status/${orderId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('input');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      title="Copiar link de tracking para enviar ao cliente"
      className="text-[10px] px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors whitespace-nowrap"
    >
      {copied ? '✓ Copiado!' : '🔗 Link cliente'}
    </button>
  );
}

interface SLAConfig { yellowMin: number; redMin: number; refreshSec: number; }
const DEFAULT_SLA: SLAConfig = { yellowMin: 5, redMin: 10, refreshSec: 5 };

function loadSLA(): SLAConfig {
  if (typeof window === 'undefined') return DEFAULT_SLA;
  try {
    const stored = JSON.parse(localStorage.getItem('kds_sla') ?? '{}') as Partial<SLAConfig>;
    return { ...DEFAULT_SLA, ...stored };
  } catch { return DEFAULT_SLA; }
}

function SLAModal({ config, onSave, onClose }: { config: SLAConfig; onSave: (c: SLAConfig) => void; onClose: () => void }) {
  const [d, setD] = useState(config);
  const update = (k: keyof SLAConfig, v: number) => setD(prev => ({ ...prev, [k]: Math.max(1, v) }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-xs p-6 space-y-4 border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base">⚙ Configurar SLA</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {([
          { label: '🟡 Amarelo após (min)', key: 'yellowMin' as const },
          { label: '🔴 Vermelho após (min)', key: 'redMin' as const },
          { label: '🔄 Refresh a cada (seg)', key: 'refreshSec' as const },
        ] as { label: string; key: keyof SLAConfig }[]).map(({ label, key }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 block mb-1.5">{label}</label>
            <input
              type="number" min="1" step="1"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm"
              value={d[key]}
              onChange={e => update(key, parseInt(e.target.value) || 1)}
            />
          </div>
        ))}

        <div className="bg-gray-700/50 rounded-lg p-3 space-y-1">
          <p className="text-[11px] text-gray-400">Pré-visualização do semáforo:</p>
          <div className="flex gap-3">
            {[
              { label: '< ' + d.yellowMin + 'min', dot: 'bg-green-400' },
              { label: d.yellowMin + '-' + d.redMin + 'min', dot: 'bg-yellow-400' },
              { label: '> ' + d.redMin + 'min', dot: 'bg-red-500 animate-pulse' },
            ].map(({ label, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                <span className="text-[11px] text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">Cancelar</button>
          <button onClick={() => { onSave(d); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrdersLivePage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sla, setSla] = useState<SLAConfig>(DEFAULT_SLA);
  const [showSlaConfig, setShowSlaConfig] = useState(false);
  const [tick, setTick] = useState(0); // drives live elapsed timer

  const knownPaidIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setSla(loadSLA()); }, []);

  // Re-render every 30s so elapsed times stay current
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const [paidRes, processingRes, doneRes] = await Promise.all([
        api.get('/api/payments/orders?status=paid&take=50'),
        api.get('/api/payments/orders?status=processing&take=50'),
        api.get('/api/payments/orders?status=done&take=20'),
      ]);

      const paidOrders = paidRes.data.orders as Order[];
      const all: Order[] = [...paidOrders, ...processingRes.data.orders, ...doneRes.data.orders];
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Detect new paid orders and play sound
      if (!isFirstLoad.current) {
        const newOnes = paidOrders.filter(o => !knownPaidIds.current.has(o.id));
        if (newOnes.length > 0) playNewOrderSound();
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

  async function advanceStatus(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancing(order.id);
    try {
      await api.patch(`/api/payments/orders/${order.id}/status`, { status: next });
      await fetchOrders();
    } catch { /* ignore */ }
    finally { setAdvancing(null); }
  }

  function saveSla(c: SLAConfig) {
    setSla(c);
    if (typeof window !== 'undefined') localStorage.setItem('kds_sla', JSON.stringify(c));
  }

  if (!tenant) return null;

  const agentIds = Array.from(new Set(orders.map(o => o.agentId)));
  const filteredOrders = agentFilter === 'all' ? orders : orders.filter(o => o.agentId === agentFilter);
  // Only use tick in JSX expression so it doesn't cause lint warning
  void tick;

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${fullscreen ? 'fixed inset-0 z-50 overflow-hidden' : ''}`}>
      <Head><title>Agentfy — Painel de Pedidos</title></Head>

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {!fullscreen && (
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm shrink-0">← Voltar</button>
          )}
          <h1 className="text-base font-bold whitespace-nowrap">🍽️ Fila de Pedidos</h1>

          {agentIds.length > 1 && (
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
            >
              <option value="all">Todos os agentes</option>
              {agentIds.map(id => (
                <option key={id} value={id}>…{id.slice(-6)}</option>
              ))}
            </select>
          )}

          {/* SLA legend */}
          <div className="hidden lg:flex items-center gap-2.5 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> &lt;{sla.yellowMin}m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> &lt;{sla.redMin}m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> &gt;{sla.redMin}m</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-500 hidden md:inline">
            ⟳ {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button onClick={() => setShowSlaConfig(true)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors">
            ⚙ SLA
          </button>
          <button onClick={() => setFullscreen(f => !f)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors">
            {fullscreen ? '⤡' : '⤢'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">A carregar pedidos...</div>
      )}

      {!loading && (
        <div className={`grid grid-cols-3 gap-0 ${fullscreen ? 'h-[calc(100vh-53px)]' : 'min-h-[calc(100vh-53px)]'}`}>
          {STATUS_COLUMNS.map(col => {
            const colOrders = filteredOrders.filter(o => o.status === col.key);
            const isDone = col.key === 'done';

            return (
              <div key={col.key} className="flex flex-col border-r border-gray-700 last:border-r-0">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
                  <span className="font-semibold text-sm">{col.label}</span>
                  {colOrders.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{colOrders.length}</span>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colOrders.length === 0 && (
                    <div className="text-center py-16 text-gray-600 text-sm">Sem pedidos</div>
                  )}
                  {colOrders.map(order => {
                    const nextStatus = NEXT_STATUS[order.status];
                    const nextLabel  = NEXT_LABEL[order.status];
                    const isAdv = advancing === order.id;
                    const refTime = order.paidAt || order.createdAt;
                    const mins = elapsedMin(refTime);
                    const colors = isDone ? null : slaColors(mins, sla.yellowMin, sla.redMin);

                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl border-2 p-3 space-y-2 transition-all shadow-sm ${
                          isDone
                            ? 'border-green-700 bg-gray-800/60 opacity-80'
                            : `${colors!.border} bg-gray-800 ${colors!.pulse ? 'shadow-lg' : ''}`
                        }`}
                      >
                        {/* Amount row */}
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xl font-extrabold ${
                            col.key === 'paid'       ? 'text-orange-400' :
                            col.key === 'processing' ? 'text-blue-400'   : 'text-green-400'
                          }`}>€{order.amount.toFixed(2)}</span>

                          {/* SLA indicator (not on done column) */}
                          {!isDone && colors && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot} ${colors.pulse ? 'animate-pulse' : ''}`} />
                              <span className={`text-xs font-mono font-bold ${colors.text}`}>
                                {formatElapsed(mins)}
                              </span>
                            </div>
                          )}
                          {isDone && <span className="text-xs text-gray-500">{timeAgo(refTime)}</span>}
                        </div>

                        {/* Description */}
                        <p className="text-sm font-medium text-gray-200 leading-tight">{order.description}</p>

                        {/* Phone */}
                        <p className="text-xs text-gray-400">📱 +{order.buyerPhone}</p>

                        {/* Footer: ID + copy link */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <p className="text-[10px] text-gray-600 font-mono">#{order.id.slice(-8).toUpperCase()}</p>
                          <CopyLinkButton orderId={order.id} />
                        </div>

                        {/* Advance button */}
                        {nextStatus && nextLabel && (
                          <button
                            onClick={() => advanceStatus(order)}
                            disabled={isAdv}
                            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                              col.key === 'paid'
                                ? 'bg-orange-500 hover:bg-orange-400 text-white'
                                : 'bg-blue-500 hover:bg-blue-400 text-white'
                            }`}
                          >
                            {isAdv ? '⏳ A atualizar...' : nextLabel}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SLA config modal */}
      {showSlaConfig && (
        <SLAModal config={sla} onSave={saveSla} onClose={() => setShowSlaConfig(false)} />
      )}
    </div>
  );
}
