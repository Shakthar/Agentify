/**
 * /orders/[agentId] — Página pública de pedidos (KDS)
 * Sem autenticação. Mostra pedidos ativos nas últimas 24h.
 * Ideal para partilhar com staff de cozinha / balcão.
 * Auto-refresh configurável (padrão: 10 segundos).
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface PublicOrder {
  id: string;
  description: string;
  amount: number;
  status: 'paid' | 'processing' | 'done' | 'sent';
  createdAt: string;
  paidAt: string | null;
}

interface AgentInfo {
  agentId: string;
  agentName: string;
  companyName: string;
  brandColor: string;
  logoUrl: string | null;
  orders: PublicOrder[];
}

const STATUS_COLS = [
  { key: 'paid',       label: '🔔 Novos',         bg: 'bg-orange-950/80', border: 'border-orange-500', badge: 'bg-orange-500 text-white' },
  { key: 'processing', label: '⚙ Em Preparação',  bg: 'bg-blue-950/80',   border: 'border-blue-500',   badge: 'bg-blue-500 text-white'   },
  { key: 'done',       label: '✅ Prontos',         bg: 'bg-green-950/80',  border: 'border-green-600',  badge: 'bg-green-600 text-white'  },  { key: 'sent',       label: '\ud83d\ude97 Enviados',       bg: 'bg-purple-950/80', border: 'border-purple-600', badge: 'bg-purple-600 text-white' },] as const;

function elapsedMin(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}
function formatElapsed(mins: number): string {
  if (mins < 1) return '< 1m';
  if (mins < 60) return `${Math.floor(mins)}m`;
  return `${Math.floor(mins / 60)}h${Math.floor(mins % 60)}m`;
}
function slaColor(mins: number): string {
  if (mins < 5) return 'bg-green-400';
  if (mins < 10) return 'bg-yellow-400';
  return 'bg-red-500 animate-pulse';
}

export default function PublicOrdersPage() {
  const router = useRouter();
  const { agentId } = router.query;

  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const REFRESH_SEC = 10;

  const fetchOrders = useCallback(async () => {
    if (!agentId || typeof agentId !== 'string') return;
    try {
      const res = await fetch(`${API_URL}/api/public/orders/${encodeURIComponent(agentId)}`);
      if (!res.ok) throw new Error('Agente não encontrado');
      const data: AgentInfo = await res.json();
      setInfo(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Live timer tick (every 30s re-renders elapsed times)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  useEffect(() => {
    if (!agentId) return;
    fetchOrders();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchOrders, REFRESH_SEC * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [agentId, fetchOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center px-4">
        <div>
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-white text-lg font-semibold">{error ?? 'Página não encontrada'}</p>
          <p className="text-gray-400 text-sm mt-2">Verifique o link ou contacte o suporte.</p>
        </div>
      </div>
    );
  }

  const brand = info.brandColor ?? '#3b57f0';

  return (
    <div className="min-h-screen bg-gray-950 text-white select-none">
      <Head>
        <title>{info.companyName} — Painel de Pedidos</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b border-gray-800"
        style={{ borderColor: brand + '44' }}
      >
        <div className="flex items-center gap-3">
          {info.logoUrl ? (
            <img src={info.logoUrl} alt={info.companyName} className="h-8 w-auto rounded" />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: brand }}
            >
              {info.companyName[0]}
            </div>
          )}
          <div>
            <p className="font-bold text-base leading-tight">{info.companyName}</p>
            <p className="text-[15px] text-gray-400">{info.agentName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[15px] text-gray-500">
            ⟳ {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-[14px] text-gray-600">Atualiza a cada {REFRESH_SEC}s</p>
        </div>
      </header>

      {/* KDS columns */}
      <main className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-60px)] overflow-hidden">
        {STATUS_COLS.map((col) => {
          const colOrders = info.orders.filter(o => o.status === col.key);
          return (
            <div key={col.key} className={`flex flex-col rounded-2xl border ${col.border} ${col.bg} overflow-hidden`}>
              {/* Column header */}
              <div className={`flex items-center justify-between px-4 py-2.5 ${col.badge} text-sm font-bold`}>
                <span>{col.label}</span>
                {colOrders.length > 0 && (
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {colOrders.length}
                  </span>
                )}
              </div>

              {/* Order cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colOrders.length === 0 ? (
                  <p className="text-center text-gray-600 text-sm py-8">—</p>
                ) : (
                  colOrders.map((order) => {
                    const refMins = elapsedMin(order.paidAt ?? order.createdAt);
                    return (
                      <div
                        key={order.id}
                        className="bg-gray-900/80 border border-gray-700 rounded-xl p-3 space-y-2"
                      >
                        {/* SLA + timer */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${slaColor(refMins)}`} />
                            <span className="text-xs text-gray-400 font-mono">{formatElapsed(refMins)}</span>
                          </div>
                          <a
                            href={`/order-status/${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[14px] text-gray-500 hover:text-gray-300 font-mono truncate max-w-[120px]"
                            title="Ver detalhes do pedido"
                          >
                            #{order.id.slice(-6)}
                          </a>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-white leading-snug whitespace-pre-wrap break-words">
                          {order.description}
                        </p>

                        {/* Amount */}
                        <div className="flex items-center justify-end">
                          <span className="text-sm font-bold text-green-400">
                            €{order.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
