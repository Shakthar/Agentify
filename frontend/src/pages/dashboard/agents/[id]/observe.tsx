import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../../../components/Navigation';
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

  const channelIcon = (ch: string) => {
    if (ch === 'whatsapp') return '📱';
    if (ch === 'instagram') return '📸';
    return '💬';
  };

  const elapsed = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'agora mesmo';
    if (mins === 1) return '1 min atrás';
    return `${mins} min atrás`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🔭 Modo Observação
              <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Ao vivo — atualiza a cada 5s
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {conversations.length} conversa{conversations.length !== 1 ? 's' : ''} abertas neste momento
            </p>
          </div>
          <button onClick={() => router.back()} className="btn-secondary text-sm">← Voltar</button>
        </div>

        {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">A carregar…</p>
        ) : conversations.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">🟡</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Nenhuma conversa aberta neste momento.</p>
            <p className="text-xs text-gray-400 mt-1">Esta página atualiza automaticamente quando chegam novas conversas.</p>
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            {/* Conversation list */}
            <div className={`w-full lg:w-80 shrink-0 space-y-2 ${selected ? 'hidden lg:block' : ''}`}>
              {conversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                  className={`card cursor-pointer transition-all hover:shadow-md ${
                    c.id === selectedId
                      ? 'border-2 border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                      : 'hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{channelIcon(c.channelType)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {c.visitorName ?? c.visitorId ?? 'Visitante'}
                        </div>
                        <div className="text-[10px] text-gray-400">{elapsed(c.createdAt)}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{c.messages.length} msgs</span>
                  </div>
                  {c.messages[0] && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                      {c.messages[0].content}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Chat panel */}
            {selected && (
              <div className="flex-1 card p-0 flex flex-col" style={{ height: '70vh' }}>
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {channelIcon(selected.channelType)} {selected.visitorName ?? selected.visitorId ?? 'Visitante'}
                    </div>
                    <div className="text-xs text-gray-400">Iniciada {elapsed(selected.createdAt)} · {selected.messages.length} mensagens</div>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none lg:hidden">×</button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {[...selected.messages].reverse().map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : m.role === 'assistant'
                          ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs italic border border-yellow-200 dark:border-yellow-800 rounded'
                      }`}>
                        {m.content}
                        <div className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-brand-200' : 'text-gray-400'}`}>
                          {new Date(m.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Read-only notice */}
                <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
                  <p className="text-[11px] text-gray-400 text-center">👁️ Modo observação — só leitura. O agente IA está a responder automaticamente.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
