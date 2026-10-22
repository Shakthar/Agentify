import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../utils/api';
import { Conversation, Message } from '../types';

interface Props {
  agentId: string;
}

interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

function sentimentColor(s?: number) {
  if (s === undefined || s === null) return 'text-app-faint';
  if (s >= 0.3) return 'text-app-pos';
  if (s <= -0.3) return 'text-app-neg';
  return 'text-app-muted';
}

function sentimentLabel(s?: number) {
  if (s === undefined || s === null) return '';
  if (s >= 0.3) return 'Satisfeito';
  if (s <= -0.3) return 'Insatisfeito';
  return 'Neutro';
}

const URGENCY: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Crítica', cls: 'bg-app-neg-soft text-app-neg' },
  high: { label: 'Urgente', cls: 'bg-app-warn-soft text-app-warn' },
};

/** Só marca urgência quando importa (alta ou crítica); o resto é ruído. */
function urgencyBadge(u?: string) {
  if (!u || !URGENCY[u]) return null;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY[u].cls}`}>{URGENCY[u].label}</span>;
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function channelTag(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'telegram') return 'Telegram';
  return 'Site';
}

function Stars({ n, title }: { n: number; title?: string }) {
  return <span className="num whitespace-nowrap text-xs text-app-muted" title={title} aria-label={`${n} de 5`}>{n}/5</span>;
}

export default function ConversationHistory({ agentId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [selected, setSelected] = useState<ConversationWithMessages | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'instagram' | 'telegram' | 'web' | 'handoff'>('all');
  const [returningHandoff, setReturningHandoff] = useState(false);
  const [search, setSearch] = useState('');
  const [copilot, setCopilot] = useState<{ summary: string; suggestedReplies: string[] } | null>(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const TAKE = 30;

  const loadConversations = useCallback(async (newSkip: number, reset: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/conversations`, {
        params: { agentId, skip: newSkip, take: TAKE },
      });
      const all: Conversation[] = data.conversations;
      const filtered = filter === 'all' ? all : all.filter((c) => c.channelType === filter);
      setConversations((prev) => reset ? filtered : [...prev, ...filtered]);
      setTotal(data.total);
      setSkip(newSkip + TAKE);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setError('Sessao expirada - faz logout e login novamente para ver as conversas.');
      } else {
        setError('Erro ao carregar conversas. Tenta novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [agentId, filter]);

  useEffect(() => {
    loadConversations(0, true);
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  async function openConversation(conv: Conversation) {
    setLoadingMessages(true);
    setCopilot(null);
    setCopilotError(null);
    setSelected({ ...conv, messages: [] });
    try {
      const { data } = await api.get(`/api/conversations/${conv.id}`);
      setSelected({ ...data, messages: data.messages ?? [] });
    } catch {
      /* ignore */
    } finally {
      setLoadingMessages(false);
    }
  }

  async function fetchCopilot(conv: ConversationWithMessages) {
    setLoadingCopilot(true);
    setCopilotError(null);
    try {
      const { data } = await api.post(`/api/conversations/${conv.id}/copilot`);
      setCopilot({ summary: data.summary, suggestedReplies: data.suggestedReplies ?? [] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCopilotError(msg ?? 'Erro ao gerar sugestões');
    } finally {
      setLoadingCopilot(false);
    }
  }

  const displayed = conversations.filter((c) => {
    if (filter === 'handoff') return c.handedOffToHuman;
    if (!search) return true;
    const phone = c.visitorId ?? '';
    return phone.includes(search);
  });

  async function returnToAgent(conv: ConversationWithMessages) {
    setReturningHandoff(true);
    try {
      await api.patch(`/api/conversations/${conv.id}/handoff`);
      setSelected((prev) => prev ? { ...prev, handedOffToHuman: false } : prev);
      setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, handedOffToHuman: false } : c));
    } catch {
      /* ignore */
    } finally {
      setReturningHandoff(false);
    }
  }

  const FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'handoff', label: 'Com a equipa' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'web', label: 'Site' },
  ] as const;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-app-edge bg-app-sheet md:h-[640px] md:flex-row">
      {/* Lista */}
      <div className="flex max-h-[420px] shrink-0 flex-col border-b border-app-rule md:max-h-none md:w-96 md:border-b-0 md:border-r">
        <div className="space-y-2 border-b border-app-rule p-3">
          <input
            type="text"
            aria-label="Filtrar por número"
            placeholder="Procurar por número ou nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
          <div role="group" aria-label="Filtrar por canal" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => { setFilter(f.id); loadConversations(0, true); }}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  filter === f.id ? 'bg-app-ink text-app-sheet' : 'text-app-muted hover:bg-app-raised hover:text-app-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="num text-xs text-app-faint">{total} conversa{total === 1 ? '' : 's'}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="m-3 space-y-1 rounded-lg bg-app-neg-soft px-3 py-2 text-sm text-app-neg">
              <p>{error}</p>
              {error.includes('expirada') ? (
                <a href="/dashboard/profile" className="block font-semibold underline underline-offset-2">Ir para o perfil</a>
              ) : (
                <button type="button" onClick={() => loadConversations(0, true)} className="font-semibold underline underline-offset-2">Tentar de novo</button>
              )}
            </div>
          ) : loading && conversations.length === 0 ? (
            <div className="space-y-4 p-4" aria-label="A carregar conversas">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="space-y-1.5">
                  <span className="block h-4 w-2/3 rounded bg-app-raised" />
                  <span className="block h-3 w-1/2 rounded bg-app-raised" />
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <p className="p-4 text-sm text-app-muted">
              {filter === 'whatsapp' ? 'Sem conversas no WhatsApp.' : filter === 'instagram' ? 'Sem conversas no Instagram.' : filter === 'telegram' ? 'Sem conversas no Telegram.' : filter === 'web' ? 'Sem conversas no site.' : filter === 'handoff' ? 'Nenhuma conversa à espera da equipa.' : 'Ainda não há conversas. Quando um cliente escrever, aparece aqui.'}
            </p>
          ) : (
            displayed.map((conv) => {
              const on = selected?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => openConversation(conv)}
                  aria-current={on ? 'true' : undefined}
                  className={`relative block w-full border-b border-app-rule px-4 py-3 text-left transition-colors ${on ? 'bg-app-raised' : 'hover:bg-app-raised'}`}
                >
                  {on && <span className="absolute inset-y-0 left-0 w-0.5 bg-app-accent" aria-hidden="true" />}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-app-ink">{conv.visitorId ?? 'Anónimo'}</span>
                    <span className="num shrink-0 text-xs text-app-faint">{formatDate(conv.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-app-muted">
                    <span>{channelTag(conv.channelType)}</span>
                    <span className="num text-app-faint">· {(conv._count?.messages ?? 0)} msg</span>
                    {conv.rating != null && <Stars n={conv.rating} />}
                    {conv.handedOffToHuman ? (
                      <span className="rounded-full bg-app-warn-soft px-2 py-0.5 font-medium text-app-warn">Com a equipa</span>
                    ) : conv.needsReview ? (
                      <span className="rounded-full bg-app-warn-soft px-2 py-0.5 font-medium text-app-warn" title={conv.reviewReason}>A rever</span>
                    ) : conv.resolved ? (
                      <span className="rounded-full bg-app-pos-soft px-2 py-0.5 font-medium text-app-pos">Resolvida</span>
                    ) : null}
                    {urgencyBadge(conv.urgency)}
                  </div>
                </button>
              );
            })
          )}
          {displayed.length < total && !loading && (
            <button type="button" onClick={() => loadConversations(skip, false)} className="w-full py-3 text-sm font-semibold text-app-accent hover:underline">
              Carregar mais
            </button>
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="flex min-h-[420px] min-w-0 flex-1 flex-col bg-app-raised/40">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="text-sm font-semibold text-app-ink">Escolha uma conversa</p>
            <p className="text-sm text-app-muted">As mensagens aparecem aqui, com o resumo e o estado.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-rule bg-app-sheet px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-app-ink">{selected.visitorId ?? 'Anónimo'}</p>
                <p className="num text-xs text-app-muted">
                  {channelTag(selected.channelType)} · {new Date(selected.createdAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                  {selected.closedAt && ` – fechada ${new Date(selected.closedAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}`}
                  {' · '}{selected.tokensUsed} tokens
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {urgencyBadge(selected.urgency)}
                {sentimentLabel(selected.sentiment) && <span className={`text-xs font-medium ${sentimentColor(selected.sentiment)}`}>{sentimentLabel(selected.sentiment)}</span>}
                {selected.rating != null && <Stars n={selected.rating} title={selected.ratingText} />}
                {selected.needsReview && (
                  <span className="rounded-full bg-app-warn-soft px-2 py-0.5 text-xs font-medium text-app-warn" title={selected.reviewReason}>A rever</span>
                )}
                {selected.resolved && (
                  <span className="rounded-full bg-app-pos-soft px-2 py-0.5 text-xs font-medium text-app-pos">Resolvida</span>
                )}
                {selected.handedOffToHuman && (
                  <button type="button" onClick={() => returnToAgent(selected)} disabled={returningHandoff} className="btn-secondary h-8 px-3 text-xs">
                    {returningHandoff ? 'A devolver…' : 'Devolver ao agente'}
                  </button>
                )}
              </div>
            </div>

            {selected.needsReview && selected.reviewReason && (
              <p className="border-b border-app-rule bg-app-warn-soft px-5 py-2 text-sm text-app-warn">Motivo da revisão: {selected.reviewReason}</p>
            )}
            {selected.handoffSummary && (
              <p className="border-b border-app-rule bg-app-sheet px-5 py-2 text-sm text-app-muted"><span className="font-semibold text-app-ink">Resumo para a equipa:</span> {selected.handoffSummary}</p>
            )}

            {/* Copiloto de IA: resumo + respostas sugeridas para quem está a atender */}
            {(selected.handedOffToHuman || copilot) && (
              <div className="border-b border-app-rule bg-app-sheet px-5 py-3">
                {!copilot && !loadingCopilot && (
                  <button type="button" onClick={() => fetchCopilot(selected)} className="text-sm font-semibold text-app-accent hover:underline">
                    Sugerir respostas com IA
                  </button>
                )}
                {loadingCopilot && <p className="text-sm text-app-muted">A preparar sugestões…</p>}
                {copilotError && <p className="text-sm text-app-neg">{copilotError}</p>}
                {copilot && (
                  <div className="space-y-2">
                    <p className="text-sm text-app-ink"><span className="font-semibold">Resumo:</span> {copilot.summary}</p>
                    {copilot.suggestedReplies.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {copilot.suggestedReplies.map((r, i) => (
                          <p key={i} className="rounded-lg border border-app-edge px-3 py-2 text-sm text-app-ink">{r}</p>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => fetchCopilot(selected)} className="text-sm font-semibold text-app-accent hover:underline">
                      Gerar outras sugestões
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {loadingMessages ? (
                <div className="space-y-3" aria-label="A carregar mensagens">
                  <span className="block h-10 w-2/3 rounded-2xl bg-app-raised" />
                  <span className="ml-auto block h-10 w-1/2 rounded-2xl bg-app-raised" />
                </div>
              ) : selected.messages.length === 0 ? (
                <p className="pt-8 text-center text-sm text-app-muted">Esta conversa não tem mensagens.</p>
              ) : (
                selected.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-bl-sm border border-app-edge bg-app-sheet text-app-ink'
                          : 'rounded-br-sm bg-app-accent text-app-accent-ink'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`num mt-1 text-right text-xs ${msg.role === 'user' ? 'text-app-faint' : 'text-app-accent-ink/75'}`}>
                        {msg.role === 'user' ? 'Cliente' : 'Agente'} · {formatTime(msg.timestamp)}
                        {msg.tokens > 0 && ` · ${msg.tokens}t`}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
