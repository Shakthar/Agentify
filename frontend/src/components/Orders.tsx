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
  pending:  { label: 'Aguarda pagamento', classes: 'bg-app-warn-soft text-app-warn' },
  paid:     { label: 'Pago',              classes: 'bg-app-pos-soft text-app-pos' },
  failed:   { label: 'Falhou',            classes: 'bg-app-neg-soft text-app-neg' },
  expired:  { label: 'Expirado',          classes: 'bg-app-raised text-app-muted' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Orders({ agentId, plan }: Props) {
  const cost = PAYMENT_SKILL_COST[plan] ?? null;

  // Plano sem acesso à skill
  if (cost === null) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-app-edge px-5 py-6">
        <p className="text-sm font-semibold text-app-ink">Pagamentos MB Way a partir do plano Starter</p>
        <p className="max-w-xl text-sm text-app-muted">
          Com o Starter, o agente aceita encomendas na conversa e envia a cobrança MB Way ao cliente. Os pedidos aparecem aqui.
        </p>
        <a href="/dashboard/billing" className="btn-secondary mt-1">Ver planos</a>
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
    <section className="rounded-xl border border-app-edge bg-app-sheet">
      <div className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-app-ink">Pedidos MB Way</h2>
          <p className="mt-1 max-w-2xl text-sm text-app-muted">
            Quando o agente fecha uma encomenda, cria aqui o pedido e envia a cobrança MB Way ao cliente. Com o pagamento confirmado,
            o cliente e o dono recebem aviso no WhatsApp.
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center self-start whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cost > 0 ? 'bg-app-raised text-app-muted' : 'bg-app-pos-soft text-app-pos'}`}>
          {cost > 0 ? <><span className="num">{cost}</span>&nbsp;créditos por transação</> : 'Incluído no plano'}
        </span>
      </div>

      {/* Filtros + contagem */}
      <div className="mt-4 flex flex-wrap items-center gap-2 px-5">
        <div role="group" aria-label="Filtrar pedidos" className="inline-flex rounded-lg border border-app-edge p-0.5">
          {(['all', 'pending', 'paid'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${filter === f ? 'bg-app-raised text-app-ink' : 'text-app-muted hover:text-app-ink'}`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Por pagar' : 'Pagos'}
            </button>
          ))}
        </div>
        <span className="num ml-auto text-sm text-app-muted">{total} pedido{total !== 1 ? 's' : ''}</span>
        <button type="button" onClick={refresh} className="text-sm font-semibold text-app-accent hover:underline">Atualizar</button>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="space-y-3 border-t border-app-rule px-5 py-4" aria-label="A carregar pedidos">
            <span className="block h-5 w-full rounded bg-app-raised" />
            <span className="block h-5 w-5/6 rounded bg-app-raised" />
            <span className="block h-5 w-2/3 rounded bg-app-raised" />
          </div>
        ) : orders.length === 0 ? (
          <div className="border-t border-app-rule px-5 py-6">
            <p className="text-sm font-semibold text-app-ink">{filter === 'all' ? 'Ainda não há pedidos.' : 'Nenhum pedido com este estado.'}</p>
            <p className="mt-1 text-sm text-app-muted">Ligue “Vendas, entregas e cozinha” em Capacidades e os pedidos feitos na conversa aparecem aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group">
              <tr className="text-left text-xs text-app-muted">
                <th className="px-5 pb-2 font-medium">Pedido</th>
                <th className="px-3 pb-2 font-medium">Cliente</th>
                <th className="px-3 pb-2 font-medium">Feito</th>
                <th className="px-3 pb-2 font-medium">Estado</th>
                <th className="px-3 pb-2 text-right font-medium">Valor</th>
                <th className="w-px px-5 pb-2"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const st = STATUS_LABEL[order.status] ?? STATUS_LABEL.failed;
                return (
                  <tr key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-app-rule px-5 py-3 md:table-row md:p-0">
                    <td className="w-full min-w-0 md:w-auto md:max-w-[13rem] md:px-5 md:py-3">
                      <span className="block truncate font-semibold text-app-ink">{order.description}</span>
                      <span className="num block font-mono text-xs text-app-faint">#{order.id.slice(-8)}</span>
                    </td>
                    <td className="num whitespace-nowrap text-app-muted md:px-3 md:py-3">+{order.buyerPhone}</td>
                    <td className="num whitespace-nowrap text-app-muted md:px-3 md:py-3">
                      {fmtDate(order.createdAt)}
                      {order.paidAt && <span className="block text-xs text-app-faint">pago {fmtDate(order.paidAt)}</span>}
                    </td>
                    <td className="md:px-3 md:py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${st.classes}`}>{st.label}</span></td>
                    <td className="num ml-auto whitespace-nowrap text-right font-semibold text-app-ink md:ml-0 md:px-3 md:py-3">
                      €{order.amount.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="whitespace-nowrap md:py-3 md:pl-3 md:pr-5 md:text-right">
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleSimulatePaid(order.id)}
                          disabled={simulating === order.id}
                          title="Simular pagamento (teste)"
                          className="btn-ghost h-8 px-2"
                        >
                          {simulating === order.id ? 'A simular…' : 'Simular pago'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </section>
  );
}
