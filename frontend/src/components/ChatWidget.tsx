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
  docAttachment?: { id: string; name: string; url: string } | null;
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
        content: data.content + (data.docAttachment
          ? `\n\n[DOC:${data.docAttachment.url}|${data.docAttachment.name}]`
          : ''),
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
        <p className="text-gray-500 dark:text-gray-400 text-sm">Clique para iniciar uma conversa de teste com o agente</p>
        <button className="btn-primary" onClick={startConversation} disabled={starting}>
          {starting ? 'A iniciar...' : 'Iniciar conversa'}
        </button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[480px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="bg-brand-600 text-white px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-sm font-medium">Agente online</span>
        <span className="ml-auto text-xs opacity-70">conv: {conversation.id.slice(-6)}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-gray-800">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm pt-8">Escreva uma mensagem para começar</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-sm px-4 py-2 whitespace-pre-wrap'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' ? (() => {
                const docMatch = msg.content.match(/\[DOC:(https?:\/\/[^|]+)\|([^\]]+)\]/);
                const text = msg.content.replace(/\[DOC:[^\]]+\]/g, '').trim();
                return (
                  <div className="px-4 py-2">
                    {text && <p className="whitespace-pre-wrap">{text}</p>}
                    {docMatch && (
                      <a
                        href={docMatch[1]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-brand-600 dark:text-brand-400 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
                      >
                        <span>📎</span>
                        <span className="text-xs font-medium truncate">{docMatch[2]}</span>
                        <span className="text-xs text-gray-400 ml-auto shrink-0">Download</span>
                      </a>
                    )}
                  </div>
                );
              })() : <span className="px-4 py-2 block whitespace-pre-wrap">{msg.content}</span>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2 items-end bg-white dark:bg-gray-800">
        <textarea
          className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 max-h-28"
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
