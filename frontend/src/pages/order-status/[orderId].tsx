/**
 * /order-status/[orderId] — Página pública de acompanhamento de pedido.
 * Acessível pelo cliente sem autenticação. Auto-refresh a cada 10s.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface OrderStatus {
  id: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  agentName: string | null;
}

const STEPS = [
  { key: 'pending',    label: 'A aguardar pagamento', icon: '⏳', active: 'bg-yellow-500',  ring: 'ring-yellow-400/30', text: 'text-yellow-400'  },
  { key: 'paid',       label: 'Pagamento confirmado', icon: '✅', active: 'bg-orange-500', ring: 'ring-orange-400/30', text: 'text-orange-400' },
  { key: 'processing', label: 'Em preparação',        icon: '⚙️', active: 'bg-blue-500',   ring: 'ring-blue-400/30',   text: 'text-blue-400'   },
  { key: 'done',       label: 'Pronto',               icon: '🎉', active: 'bg-green-500',  ring: 'ring-green-400/30',  text: 'text-green-400'  },
  { key: 'sent',       label: 'A caminho!',           icon: '🚗', active: 'bg-purple-500', ring: 'ring-purple-400/30', text: 'text-purple-400' },
];

const TERMINAL: Record<string, { label: string; icon: string; desc: string }> = {
  failed:  { label: 'Pagamento falhado', icon: '❌', desc: 'Contacta o estabelecimento.' },
  expired: { label: 'Pedido expirado',   icon: '⌛', desc: 'Contacta o estabelecimento.' },
};

function getStepIndex(status: string) {
  return STEPS.findIndex(s => s.key === status);
}

const TERMINAL_STATUSES = new Set(['sent', 'failed', 'expired']);
const REFRESH_SEC = 10;

export default function OrderStatusPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId || typeof orderId !== 'string') return;
    try {
      const res = await fetch(`${API_URL}/api/payments/orders/public/${encodeURIComponent(orderId)}`);
      if (!res.ok) throw new Error('Pedido não encontrado ou expirado.');
      const data: OrderStatus = await res.json();
      setOrder(data);
      setLastUpdate(new Date());
      setError(null);
      // Stop refreshing once terminal
      if (TERMINAL_STATUSES.has(data.status) && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar pedido.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    intervalRef.current = setInterval(fetchOrder, REFRESH_SEC * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrder]);

  const stepIdx = order ? getStepIndex(order.status) : -1;
  const terminal = order ? TERMINAL[order.status] : null;
  const currentStep = stepIdx >= 0 ? STEPS[stepIdx] : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start py-10 px-4">
      <Head>
        <title>Estado do Pedido{order?.agentName ? ` — ${order.agentName}` : ''}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="w-full max-w-sm space-y-5">
        {loading && (
          <div className="flex flex-col items-center gap-3 mt-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            <p className="text-sm">A carregar...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-20 text-center space-y-3">
            <p className="text-4xl">😕</p>
            <p className="text-red-400 font-medium">{error}</p>
            <p className="text-xs text-gray-500">Verifica o link ou contacta o estabelecimento.</p>
          </div>
        )}

        {!loading && order && (
          <>
            {/* Header */}
            <div className="text-center space-y-0.5">
              {order.agentName && <p className="text-sm text-gray-400">{order.agentName}</p>}
              <h1 className="text-xl font-bold">O teu pedido</h1>
              <p className="text-[11px] text-gray-600 font-mono">#{order.id.slice(-10).toUpperCase()}</p>
            </div>

            {/* Summary */}
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-1">
              <p className="text-sm text-gray-300 leading-snug">{order.description}</p>
              <p className="text-3xl font-extrabold text-white">€{order.amount.toFixed(2)}</p>
            </div>

            {/* Terminal states */}
            {terminal && (
              <div className="bg-gray-800 rounded-2xl p-7 border border-gray-700 text-center space-y-2">
                <p className="text-5xl">{terminal.icon}</p>
                <p className="text-lg font-bold text-red-400">{terminal.label}</p>
                <p className="text-xs text-gray-500">{terminal.desc}</p>
              </div>
            )}

            {/* Progress tracker */}
            {!terminal && (
              <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
                {/* Current status */}
                {currentStep && (
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                    <span className="text-3xl">{currentStep.icon}</span>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500">Estado atual</p>
                      <p className={`text-base font-bold ${currentStep.text}`}>{currentStep.label}</p>
                    </div>
                  </div>
                )}

                {/* Steps list */}
                <div className="space-y-3">
                  {STEPS.map((step, i) => {
                    const done   = i < stepIdx;
                    const active = i === stepIdx;
                    const future = i > stepIdx;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                          done   ? 'bg-green-600 text-white' :
                          active ? `${step.active} text-white ring-2 ring-offset-2 ring-offset-gray-800 ${step.ring}` :
                                   'bg-gray-700 text-gray-500'
                        }`}>
                          {done ? '✓' : <span className={future ? 'opacity-40' : ''}>{step.icon}</span>}
                        </div>
                        <span className={`text-sm ${
                          active ? 'font-semibold text-white' :
                          done   ? 'text-gray-500 line-through' :
                                   'text-gray-600'
                        }`}>{step.label}</span>
                        {active && (
                          <span className="ml-auto">
                            <span className="w-2 h-2 rounded-full bg-white inline-block animate-pulse" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <p className="text-center text-[10px] text-gray-700">
              Atualizado às {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {!TERMINAL_STATUSES.has(order.status) && ` · auto-refresh ${REFRESH_SEC}s`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
