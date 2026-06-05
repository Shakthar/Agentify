import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import api from '../utils/api';
import { Message, Conversation } from '../types';

interface Props {
  agentId: string;
  tenantId: string;
  visitorId?: string;
}

interface SendResult {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: string;
  creditsUsed: number;
}

export default function ChatWidget({ agentId, tenantId, visitorId }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async () => {
    setStarting(true);
    setError(null);
    try {
      const { data } = await api.post('/api/conversations', {
        agentId,
        channelType: 'web',
        visitorId: visitorId ?? `visitor_${Date.now()}`,
      });
      setConversation(data);
    } catch {
      setError('Erro ao iniciar conversa');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversation || sending) return;
    const userMsg: Message = {
      id: `tmp_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      tokens: 0,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const { data }: { data: SendResult } = await api.post(
        `/api/conversations/${conversation.id}/messages`,
        { content: userMsg.content },
      );
      const assistantMsg: Message = {
        id: data.id,
        role: 'assistant',
        content: data.content,
        tokens: 0,
        timestamp: data.timestamp,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao enviar mensagem';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-gray-500 text-sm">Clique para iniciar uma conversa de teste com o agente</p>
        <button className="btn-primary" onClick={startConversation} disabled={starting}>
          {starting ? 'A iniciar...' : 'Iniciar conversa'}
        </button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[480px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-brand-600 text-white px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-sm font-medium">Agente online</span>
        <span className="ml-auto text-xs opacity-70">conv: {conversation.id.slice(-6)}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm pt-8">Escreva uma mensagem para começar</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-center text-red-500 text-xs">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex gap-2 items-end">
        <textarea
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 max-h-28"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          disabled={sending}
        />
        <button
          className="btn-primary h-9 px-3"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
