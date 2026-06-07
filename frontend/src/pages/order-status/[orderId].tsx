/**
 * /order-status/[orderId] — Página pública de acompanhamento de pedido.
 * Acessível pelo cliente sem autenticação.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import api from '../../utils/api';

interface OrderStatus {
  id: string;
  description: string;
  amount: number;
  status: 'pending' | 'paid' | 'processing' | 'done' | 'failed' | 'expired';
  createdAt: string;
  paidAt: string | null;
  agentName?: string;
  buyerPhone?: string;
}

const STEPS = [
  { key: 'paid',       label: 'Pagamento recebido',  icon: '✓', color: 'text-green-500' },
  { key: 'processing', label: 'Em preparação',        icon: '⚙', color: 'text-blue-500'  },
  { key: 'done',       label: 'Pronto!',              icon: '✓', color: 'text-green-600' },
];

function stepIndex(status: string) {
  if (status === 'paid')       return 0;
  if (status === 'processing') return 1;
  if (status === 'done')       return 2;
  return -1;
}

export default function OrderStatusPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || typeof orderId !== 'string') return;

    async function load() {
      try {
        const res = await api.get(`/api/payments/orders/public/${orderId}`);
        setOrder(res.data);
      } catch {
        setError('Pedido não encontrado ou expirado.');
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 10000); // refresh a cada 10s
    return () => clearInterval(interval);
  }, [orderId]);

  const currentStep = order ? stepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Head><title>Estado do Pedido — Agentfy</title></Head>

      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white text-2xl font-bold mb-3">A</div>
          <p className="text-sm text-gray-500">Acompanhamento de Pedido</p>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-gray-500">A carregar...</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <span className="text-4xl">😕</span>
            <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>
            <p className="mt-1 text-xs text-gray-400">Verifica o link ou contacta o estabelecimento.</p>
          </div>
        )}

        {order && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Amount header */}
            <div className={`px-6 py-5 text-center ${
              order.status === 'done'       ? 'bg-green-50'  :
              order.status === 'processing' ? 'bg-blue-50'   :
              order.status === 'paid'       ? 'bg-orange-50' :
              'bg-gray-50'
            }`}>
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Total do pedido</p>
              <p className="text-4xl font-black text-gray-900">€{order.amount.toFixed(2)}</p>
              {order.agentName && <p className="text-xs text-gray-400 mt-1">{order.agentName}</p>}
            </div>

            {/* Description */}
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed">{order.description}</p>
              <p className="text-[11px] text-gray-400 font-mono mt-1.5">#{order.id.slice(-10).toUpperCase()}</p>
            </div>

            {/* Progress steps */}
            {(order.status === 'paid' || order.status === 'processing' || order.status === 'done') && (
              <div className="px-6 py-5">
                <div className="space-y-4">
                  {STEPS.map((s, i) => {
                    const done = i <= currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                          done
                            ? (active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-green-500 text-white')
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {done ? s.icon : <span className="text-xs">{i + 1}</span>}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</p>
                          {active && order.status === 'processing' && (
                            <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              A preparar o teu pedido...
                            </p>
                          )}
                          {active && order.status === 'done' && (
                            <p className="text-xs text-green-600 mt-0.5 font-medium">Vai buscar o teu pedido! 🎉</p>
                          )}
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`absolute ml-3 mt-7 w-0.5 h-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} style={{ display: 'none' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Failed / Expired */}
            {(order.status === 'failed' || order.status === 'expired') && (
              <div className="px-6 py-5 text-center">
                <span className="text-3xl">❌</span>
                <p className="mt-2 text-sm font-medium text-red-600">
                  {order.status === 'failed' ? 'Pagamento falhado' : 'Pedido expirado'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Contacta o estabelecimento para mais informações.</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Esta página atualiza automaticamente · Agentfy</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
