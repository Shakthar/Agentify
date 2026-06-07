/**
 * /dashboard/orders/live — Painel KDS (Kitchen Display System)
 * Vista tablet em tempo real para gerir fila de pedidos MB Way.
 * Colunas: Novo (paid) → Em Preparação (processing) → Pronto (done)
 * Atualiza automaticamente a cada 5 segundos.
 */
import { useEffect, useState, useCallback } from 'react';
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
  { key: 'paid',       label: '🔔 Novo',           bg: 'bg-orange-50 dark:bg-orange-900/20',  border: 'border-orange-300 dark:border-orange-700', badge: 'bg-orange-500 text-white' },
  { key: 'processing', label: '🔧 Em Preparação',  bg: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-300 dark:border-blue-700',     badge: 'bg-blue-500 text-white'   },
  { key: 'done',       label: '✅ Pronto',          bg: 'bg-green-50 dark:bg-green-900/20',    border: 'border-green-300 dark:border-green-700',   badge: 'bg-green-500 text-white'  },
] as const;

const NEXT_STATUS: Partial<Record<string, string>> = {
  paid:       'processing',
  processing: 'done',
};
const NEXT_LABEL: Partial<Record<string, string>> = {
  paid:       'Iniciar preparo →',
  processing: 'Marcar pronto ✓',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `há ${hrs}h`;
}

export default function OrdersLivePage() {
  const router = useRouter();
  const { tenant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const fetchOrders = useCallback(async () => {
    try {
      // Buscar paid + processing + done (últimas 24h)
      const [paidRes, processingRes, doneRes] = await Promise.all([
        api.get('/api/payments/orders?status=paid&take=50'),
        api.get('/api/payments/orders?status=processing&take=50'),
        api.get('/api/payments/orders?status=done&take=20'),
      ]);
      const all: Order[] = [
        ...paidRes.data.orders,
        ...processingRes.data.orders,
        ...doneRes.data.orders,
      ];
      // Sort by createdAt desc within each status
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(all);
      setLastUpdate(new Date());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!tenant) { router.replace('/dashboard'); return; }
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [tenant, router, fetchOrders]);

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

  if (!tenant) return null;

  // Unique agents from orders
  const agentIds = Array.from(new Set(orders.map(o => o.agentId)));
  const filteredOrders = agentFilter === 'all' ? orders : orders.filter(o => o.agentId === agentFilter);

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <Head><title>Agentfy — Painel de Pedidos</title></Head>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          {!fullscreen && (
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">← Voltar</button>
          )}
          <h1 className="text-xl font-bold">🍽️ Fila de Pedidos</h1>
          {agentIds.length > 1 && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200"
            >
              <option value="all">Todos os agentes</option>
              {agentIds.map(id => (
                <option key={id} value={id}>Agente …{id.slice(-6)}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            {fullscreen ? '⤡ Sair ecrã completo' : '⤢ Ecrã completo'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">A carregar pedidos...</div>
      )}

      {!loading && (
        <div className="grid grid-cols-3 gap-0 h-[calc(100vh-65px)]">
          {STATUS_COLUMNS.map((col) => {
            const colOrders = filteredOrders.filter(o => o.status === col.key);
            return (
              <div key={col.key} className={`flex flex-col border-r border-gray-700 last:border-r-0`}>
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 sticky top-0">
                  <span className="font-semibold text-base">{col.label}</span>
                  {colOrders.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{colOrders.length}</span>
                  )}
                </div>

                {/* Order cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colOrders.length === 0 && (
                    <div className="text-center py-12 text-gray-600 text-sm">Sem pedidos</div>
                  )}
                  {colOrders.map((order) => {
                    const nextStatus = NEXT_STATUS[order.status];
                    const nextLabel  = NEXT_LABEL[order.status];
                    const isAdv = advancing === order.id;
                    const refTime = order.paidAt || order.createdAt;
                    return (
                      <div key={order.id} className={`rounded-xl border-2 p-4 space-y-3 transition-all ${
                        col.key === 'paid' ? 'border-orange-500 bg-gray-800' :
                        col.key === 'processing' ? 'border-blue-500 bg-gray-800' :
                        'border-green-600 bg-gray-800/60 opacity-80'
                      }`}>
                        {/* Amount + time */}
                        <div className="flex items-start justify-between">
                          <span className={`text-2xl font-extrabold ${
                            col.key === 'paid' ? 'text-orange-400' :
                            col.key === 'processing' ? 'text-blue-400' : 'text-green-400'
                          }`}>€{order.amount.toFixed(2)}</span>
                          <span className="text-xs text-gray-500 mt-1">{timeAgo(refTime)}</span>
                        </div>

                        {/* Description */}
                        <p className="text-sm font-medium text-gray-200 leading-tight">{order.description}</p>

                        {/* Phone */}
                        <p className="text-xs text-gray-400">📱 +{order.buyerPhone}</p>

                        {/* Order ID */}
                        <p className="text-[10px] text-gray-600 font-mono">#{order.id.slice(-8).toUpperCase()}</p>

                        {/* Advance button */}
                        {nextStatus && nextLabel && (
                          <button
                            onClick={() => advanceStatus(order)}
                            disabled={isAdv}
                            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 ${
                              isAdv ? 'bg-gray-700 text-gray-400 cursor-not-allowed' :
                              col.key === 'paid' ? 'bg-orange-500 hover:bg-orange-400 text-white' :
                              'bg-blue-500 hover:bg-blue-400 text-white'
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
    </div>
  );
}
