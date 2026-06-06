import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { PAYMENT_SKILL_COST } from '../utils/constants';

interface Order {
  id: string;
  agentId: string;
  buyerPhone: string;
  amount: number;
  description: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  notifyPhone: string | null;
  createdAt: string;
  paidAt: string | null;
  externalId: string | null;
}

interface Props { agentId: string; plan: string }

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  pending:  { label: 'Aguarda pagamento', classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  paid:     { label: 'Pago',              classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  failed:   { label: 'Falhou',            classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  expired:  { label: 'Expirado',          classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Orders({ agentId, plan }: Props) {
  const cost = PAYMENT_SKILL_COST[plan] ?? null;

  // Plano sem acesso à skill
  if (cost === null) {
    return (
      <div className="card text-center py-12">
        <p className="text-4xl mb-3">🔒</p>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Skill de Pagamentos — Plano Starter+</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          A skill de cobranças MB Way está disponível a partir do plano <strong>Starter</strong>.
          Faz upgrade para que o teu agente possa aceitar encomendas e processar pagamentos automaticamente.
        </p>
        <a href="/dashboard/billing" className="btn-primary inline-block mt-5 text-sm">Ver planos →</a>
      </div>
    );
  }
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ agentId, take: '50' });
      if (filter !== 'all') params.set('status', filter);
      const { data } = await api.get(`/api/payments/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [agentId, filter]);

  useEffect(() => { void refresh(); }, [agentId, filter]);

  const handleSimulatePaid = async (orderId: string) => {
    setSimulating(orderId);
    try {
      await api.post(`/api/payments/test-paid/${orderId}`);
      await refresh();
    } catch { alert('Erro ao simular pagamento'); }
    finally { setSimulating(null); }
  };

  return (
    <div className="space-y-5">
      {/* Info card */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm text-blue-800 dark:text-blue-300 flex-1">
            <strong>Como funciona:</strong> quando o agente usa a skill <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">[MBWAY:351912345678|5.00|Descrição]</code> na resposta,
            é criado um pedido aqui e enviada uma cobrança MB Way ao cliente. Após pagamento confirmado, o cliente e o dono são notificados via WhatsApp.
          </p>
          {cost > 0 ? (
            <span className="shrink-0 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full font-medium">{cost} créditos/transação</span>
          ) : (
            <span className="shrink-0 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-medium">✓ Incluído no plano</span>
          )}
        </div>
      </div>

      {/* Filtros + contagem */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['all', 'pending', 'paid'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Por pagar' : 'Pagos'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{total} pedido{total !== 1 ? 's' : ''}</span>
        <button onClick={refresh} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">↻ Atualizar</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 animate-pulse">A carregar pedidos…</p>
      ) : orders.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ainda não há pedidos.</p>
          <p className="text-xs text-gray-400 mt-1">Configure o agente para aceitar encomendas e os pedidos aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const st = STATUS_LABEL[order.status] ?? STATUS_LABEL.failed;
            return (
              <div key={order.id} className="card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.classes}`}>{st.label}</span>
                      <span className="text-xs text-gray-400">#{order.id.slice(-8)}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{order.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>📱 +{order.buyerPhone}</span>
                      <span>🕐 {fmtDate(order.createdAt)}</span>
                      {order.paidAt && <span>✅ Pago {fmtDate(order.paidAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      €{order.amount.toFixed(2).replace('.', ',')}
                    </span>
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleSimulatePaid(order.id)}
                        disabled={simulating === order.id}
                        title="Simular pagamento (teste)"
                        className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 transition-colors disabled:opacity-50"
                      >
                        {simulating === order.id ? '…' : '▶ Simular pago'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
