import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AppLayout from '../../../../components/app/AppLayout';
import { EmptyState, InlineError, PageHeader, Pill, Skeleton, cx } from '../../../../components/app/ui';
import apiFetch from '../../../../utils/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface LiveConversation {
  id: string;
  visitorName: string | null;
  visitorId: string | null;
  channelType: string;
  createdAt: string;
  messages: Message[];
}

export default function ObservePage() {
  const router = useRouter();
  const { id: agentId } = router.query as { id: string };
  const [conversations, setConversations] = useState<LiveConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLive = async () => {
    if (!agentId) return;
    try {
      const { data } = await apiFetch.get(`/api/agents/${agentId}/observe`);
      setConversations(data.conversations ?? []);
      setError('');
    } catch (e: any) {
      setError(e.message ?? 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!agentId) return;
    fetchLive();
    intervalRef.current = setInterval(fetchLive, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedId, conversations]);

  const selected = conversations.find(c => c.id === selectedId) ?? null;

  const channelLabel = (ch: string) => {
    if (ch === 'whatsapp') return 'WhatsApp';
    if (ch === 'instagram') return 'Instagram';
    if (ch === 'telegram') return 'Telegram';
    if (ch === 'web' || ch === 'webchat') return 'Web';
    return ch || 'Canal';
  };

  const elapsed = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'agora mesmo';
    if (mins < 60) return `há ${mins} min`;
    const h = Math.floor(mins / 60);
    return `há ${h} h`;
  };

  const who = (c: LiveConversation) => c.visitorName ?? c.visitorId ?? 'Visitante';

  return (
    <AppLayout wide>
      <Head><title>Agentfy — Observação</title></Head>
      <PageHeader
        title="Observação"
        subtitle={`${conversations.length} conversa${conversations.length !== 1 ? 's' : ''} aberta${conversations.length !== 1 ? 's' : ''} neste momento`}
        actions={
          <>
            <Pill tone="pos" dot>Ao vivo · atualiza a cada 5 s</Pill>
            <button onClick={() => router.back()} className="btn-secondary text-sm">Voltar</button>
          </>
        }
      />

      {error && <div className="mb-4"><InlineError message={error} onRetry={fetchLive} /></div>}

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 border-t border-app-rule pt-4"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-64" /></div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState title="Nenhuma conversa aberta neste momento" body="Esta página atualiza sozinha quando chega uma nova conversa." />
      ) : (
        <div className="grid overflow-hidden rounded-xl border border-app-edge lg:grid-cols-[360px_minmax(0,1fr)]" style={{ height: 'min(70vh, 720px)', minHeight: 420 }}>
          {/* Lista */}
          <ul className={cx('overflow-y-auto border-app-rule lg:border-r', selected && 'hidden lg:block')} aria-label="Conversas abertas">
            {conversations.map((c) => {
              const active = c.id === selectedId;
              const last = c.messages[0];
              return (
                <li key={c.id} className="border-b border-app-rule last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(active ? null : c.id)}
                    aria-current={active}
                    className={cx('flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors', active ? 'bg-app-accent-soft' : 'hover:bg-app-raised')}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-app-ink">{who(c)}</span>
                      <span className="shrink-0 text-xs text-app-faint">{elapsed(c.createdAt)}</span>
                    </span>
                    <span className="text-xs text-app-muted">{channelLabel(c.channelType)} · <span className="num">{c.messages.length}</span> mensagens</span>
                    {last && <span className="line-clamp-2 text-xs text-app-muted">{last.content}</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Detalhe */}
          <section className={cx('min-h-0 min-w-0 flex-col', selected ? 'flex' : 'hidden lg:flex')}>
            {selected ? (
              <>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-rule px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-app-ink">{who(selected)}</p>
                    <p className="text-xs text-app-muted">{channelLabel(selected.channelType)} · iniciada {elapsed(selected.createdAt)} · <span className="num">{selected.messages.length}</span> mensagens</p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="btn-ghost h-8 text-sm lg:hidden">Conversas</button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-app-raised px-4 py-4">
                  {[...selected.messages].reverse().map((m) => {
                    const time = new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                    if (m.role === 'system') {
                      return <p key={m.id} className="mx-auto max-w-md text-center text-xs italic text-app-warn">{m.content}</p>;
                    }
                    const agent = m.role === 'assistant';
                    return (
                      <div key={m.id} className={cx('flex', agent ? 'justify-end' : 'justify-start')}>
                        <div className={cx('max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed sm:max-w-md', agent ? 'rounded-br-sm bg-app-accent-soft text-app-ink' : 'rounded-bl-sm border border-app-edge bg-app-sheet text-app-ink')}>
                          {m.content}
                          <div className={cx('num mt-1 text-xs', 'text-app-muted')}>{agent ? 'Agente' : 'Cliente'} · {time}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <p className="shrink-0 border-t border-app-rule px-4 py-2 text-center text-xs text-app-muted">
                  Só leitura. O agente continua a responder sozinho.
                </p>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <p className="max-w-xs text-sm text-app-muted">Escolha uma conversa à esquerda para ver as mensagens em direto.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  );
}
