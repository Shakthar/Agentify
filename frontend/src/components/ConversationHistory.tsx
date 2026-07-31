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
  if (s === undefined || s === null) return '';
  if (s >= 0.3) return 'text-green-500';
  if (s <= -0.3) return 'text-red-500';
  return 'text-yellow-500';
}

function sentimentLabel(s?: number) {
  if (s === undefined || s === null) return '-';
  if (s >= 0.3) return 'ok';
  if (s <= -0.3) return 'mau';
  return 'neutro';
}

function urgencyBadge(u?: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  if (!u) return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${map[u] ?? map.low}`}>
      {u}
    </span>
  );
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

export default function ConversationHistory({ agentId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [selected, setSelected] = useState<ConversationWithMessages | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'web' | 'handoff'>('all');
  const [returningHandoff, setReturningHandoff] = useState(false);
  const [search, setSearch] = useState('');
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

  return (
    <div className="flex h-[600px] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Header */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
            Conversas {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}
          </h3>
          <input
            type="text"
            placeholder="Filtrar por numero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          <div className="flex gap-1 mt-2">
            {(['whatsapp', 'web', 'handoff', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); loadConversations(0, true); }}
                className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                  filter === f
                    ? f === 'handoff' ? 'bg-orange-500 text-white' : 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f === 'whatsapp' ? 'WA' : f === 'web' ? 'Web' : f === 'handoff' ? '🤝' : 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="p-4 text-center text-xs text-red-500 space-y-2">
              <p>{error}</p>
              {error.includes('expirada') && (
                <a href="/dashboard/profile" className="text-brand-600 underline block">Ir para perfil</a>
              )}
            </div>
          ) : loading && conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">A carregar...</div>
          ) : displayed.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              {filter === 'whatsapp' ? 'Sem conversas WhatsApp.' : filter === 'web' ? 'Sem conversas Web.' : 'Sem conversas ainda.'}
            </div>
          ) : (
            displayed.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selected?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-brand-600' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">
                    {conv.channelType === 'whatsapp' ? '[WA] ' : '[Web] '}
                    {conv.visitorId ?? 'Anonimo'}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatDate(conv.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${sentimentColor(conv.sentiment)}`}>{sentimentLabel(conv.sentiment)}</span>
                  {urgencyBadge(conv.urgency)}
                  {conv.resolved && (
                    <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">ok</span>
                  )}
                  {conv.handedOffToHuman && (
                    <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">🤝 handoff</span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400">
                    {(conv._count?.messages ?? 0)} msg
                  </span>
                </div>
              </button>
            ))
          )}
          {displayed.length < total && !loading && (
            <button
              onClick={() => loadConversations(skip, false)}
              className="w-full py-2 text-xs text-brand-600 hover:underline"
            >
              Carregar mais...
            </button>
          )}
        </div>
      </div>

      {/* Main — mensagens */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="text-4xl">chat</span>
            <p className="text-sm">Seleciona uma conversa para ver as mensagens</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {selected.channelType === 'whatsapp' ? '[WA] ' : '[Web] '}
                  {selected.visitorId ?? 'Anonimo'}
                </p>
                <p className="text-[10px] text-gray-400">
                  Iniciada em {new Date(selected.createdAt).toLocaleString('pt-PT')}
                  {selected.closedAt && ` - Encerrada ${new Date(selected.closedAt).toLocaleString('pt-PT')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {urgencyBadge(selected.urgency)}
                <span className={`text-xs ${sentimentColor(selected.sentiment)}`}>{sentimentLabel(selected.sentiment)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selected.tokensUsed} tokens
                </span>
                {selected.resolved && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Resolvida</span>
                )}
                {selected.handedOffToHuman && (
                  <button
                    onClick={() => returnToAgent(selected)}
                    disabled={returningHandoff}
                    className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1 rounded-full font-medium transition-colors"
                  >
                    {returningHandoff ? 'A devolver...' : '🤖 Devolver ao Agente'}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="text-center text-xs text-gray-400 pt-8">A carregar mensagens...</div>
              ) : selected.messages.length === 0 ? (
                <div className="text-center text-xs text-gray-400 pt-8">Sem mensagens</div>
              ) : (
                selected.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                        {formatTime(msg.timestamp)}
                        {msg.tokens > 0 && ` - ${msg.tokens}t`}
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
