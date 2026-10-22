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
  { key: 'pending',    label: 'A aguardar pagamento' },
  { key: 'paid',       label: 'Pagamento confirmado' },
  { key: 'processing', label: 'Em preparação' },
  { key: 'done',       label: 'Pronto' },
  { key: 'sent',       label: 'A caminho' },
];

const TERMINAL: Record<string, { label: string; desc: string }> = {
  failed:  { label: 'Pagamento falhado', desc: 'Contacte o estabelecimento.' },
  expired: { label: 'Pedido expirado',   desc: 'Contacte o estabelecimento.' },
};

const eur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  return `há ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

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

  const lines = order ? order.description.split('\n').map(l => l.trim()).filter(Boolean) : [];

  return (
    <div className="flex min-h-screen flex-col items-center bg-mist px-4 py-8 text-ink sm:py-12" style={{ colorScheme: 'light' }}>
      <Head>
        <title>Estado do pedido{order?.agentName ? ` · ${order.agentName}` : ''}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
      </Head>

      <div className="w-full max-w-sm space-y-4">
        {loading && (
          <div className="mt-20 flex flex-col items-center gap-3 text-ink-mute" role="status">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-600" />
            <p className="text-sm">A carregar…</p>
          </div>
        )}

        {!loading && error && (
          <div className="mt-20 space-y-2 text-center" role="alert">
            <p className="text-base font-semibold">{error}</p>
            <p className="text-sm text-ink-mute">Verifique o link ou contacte o estabelecimento.</p>
          </div>
        )}

        {!loading && order && (
          <>
            <header>
              {order.agentName && <p className="text-sm text-ink-mute">{order.agentName}</p>}
              <h1 className="text-2xl font-semibold tracking-tight">
                {terminal ? terminal.label : currentStep ? currentStep.label : 'O seu pedido'}
              </h1>
              <p className="num mt-1 text-xs text-ink-mute">Pedido #{order.id.slice(-10).toUpperCase()} · {timeAgo(order.createdAt)}</p>
            </header>

            {terminal ? (
              <section className="rounded-2xl border border-line bg-white p-5">
                <p className="text-sm text-ink-soft">{terminal.desc}</p>
              </section>
            ) : (
              <section className="rounded-2xl border border-line bg-white p-5" aria-label="Progresso do pedido">
                <ol>
                  {STEPS.map((step, i) => {
                    const done = i < stepIdx;
                    const active = i === stepIdx;
                    return (
                      <li key={step.key} className="relative flex items-start gap-3 pb-5 last:pb-0" aria-current={active ? 'step' : undefined}>
                        {i < STEPS.length - 1 && (
                          <span className={`absolute left-[9px] top-5 h-[calc(100%-1.25rem)] w-px ${done ? 'bg-ink' : 'bg-line'}`} aria-hidden="true" />
                        )}
                        <span
                          className={`relative mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 ${
                            done ? 'border-ink bg-ink text-white' : active ? 'border-brand-600 bg-white' : 'border-line bg-white'
                          }`}
                          aria-hidden="true"
                        >
                          {done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.2 2.2 4.8-5" /></svg>}
                          {active && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                        </span>
                        <span className={`text-sm ${active ? 'font-semibold text-ink' : done ? 'text-ink-soft' : 'text-ink-mute'}`}>{step.label}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <section className="rounded-2xl border border-line bg-white p-5" aria-label="Resumo do pedido">
              <ul className="space-y-1 text-sm">
                {lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-sm text-ink-mute">Total</span>
                <span className="num text-xl font-semibold">{eur(order.amount)}</span>
              </div>
            </section>

            <p className="num text-center text-xs text-ink-mute">
              Atualizado às {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {!TERMINAL_STATUSES.has(order.status) && ` · atualiza sozinho a cada ${REFRESH_SEC} s`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
