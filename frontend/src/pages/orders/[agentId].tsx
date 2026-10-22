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
  { key: 'paid',       label: 'Novos' },
  { key: 'processing', label: 'Em preparação' },
  { key: 'done',       label: 'Prontos' },
  { key: 'sent',       label: 'Entregues' },
] as const;

/** Passados estes minutos, um pedido por entregar conta como atrasado. */
const LATE_MIN = 10;

function elapsedMin(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}
/** "agora mesmo", "há 11 min", "há 1 h 05" */
function timeAgo(iso: string): string {
  const m = Math.floor(elapsedMin(iso));
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m} min`;
  return `há ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
const eur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

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

  const shell = 'min-h-screen bg-mist text-ink';
  if (loading) {
    return (
      <div className={`${shell} flex items-center justify-center`} style={{ colorScheme: 'light' }} role="status" aria-label="A carregar">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className={`${shell} flex items-center justify-center px-4 text-center`} style={{ colorScheme: 'light' }}>
        <div>
          <p className="text-lg font-semibold">{error ?? 'Página não encontrada'}</p>
          <p className="mt-2 text-sm text-ink-mute">Verifique o link ou contacte o estabelecimento.</p>
        </div>
      </div>
    );
  }

  const brand = info.brandColor ?? '#2346D8';

  return (
    <div className={`${shell} flex flex-col`} style={{ colorScheme: 'light' }}>
      <Head>
        <title>{info.companyName} · Pedidos</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="color-scheme" content="light" />
      </Head>

      <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {info.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logoUrl} alt="" className="h-9 w-auto max-w-[9rem] object-contain" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: brand }} aria-hidden="true">
              {info.companyName[0]}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-semibold">{info.companyName}</h1>
            <p className="truncate text-xs text-ink-mute">Pedidos em direto · {info.agentName}</p>
          </div>
        </div>
        <p className="num shrink-0 text-right text-xs text-ink-mute">
          {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          <span className="hidden sm:inline"> · atualiza a cada {REFRESH_SEC} s</span>
        </p>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
        {STATUS_COLS.map((col) => {
          const colOrders = info.orders
            .filter(o => o.status === col.key)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          return (
            <section key={col.key} aria-label={col.label} className="flex min-w-0 flex-col rounded-xl border border-line bg-field/50">
              <header className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="num text-sm text-ink-mute">{colOrders.length}</span>
              </header>
              <div className="space-y-2.5 px-2.5 pb-2.5 xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto">
                {colOrders.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-mute">Sem pedidos</p>
                ) : (
                  colOrders.map((order) => {
                    const ref = order.paidAt ?? order.createdAt;
                    const late = col.key !== 'sent' && elapsedMin(ref) >= LATE_MIN;
                    const lines = order.description.split('\n').map(l => l.trim()).filter(Boolean);
                    return (
                      <article key={order.id} className={`rounded-lg border bg-white p-3.5 ${late ? 'border-red-400' : 'border-line'}`}>
                        <div className="flex items-baseline justify-between gap-2">
                          <a
                            href={`/order-status/${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="num text-base font-semibold hover:underline"
                            title="Ver detalhes do pedido"
                          >
                            #{order.id.slice(-6).toUpperCase()}
                          </a>
                          <span className={`num whitespace-nowrap text-xs ${late ? 'font-semibold text-red-700' : 'text-ink-mute'}`}>
                            {late && 'Atrasado · '}{timeAgo(ref)}
                          </span>
                        </div>
                        <ul className="mt-2 space-y-0.5 text-sm">
                          {lines.map((l, i) => <li key={i}>{l}</li>)}
                        </ul>
                        <p className="num mt-3 border-t border-line pt-2 text-right text-base font-semibold">{eur(order.amount)}</p>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
