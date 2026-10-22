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
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-app-edge px-5 py-8">
        <p className="text-sm font-semibold text-app-ink">Conversa de teste</p>
        <p className="text-sm text-app-muted">Abre uma conversa nova como se fosse um cliente no site. Gasta créditos como uma conversa real.</p>
        <button type="button" className="btn-primary mt-1" onClick={startConversation} disabled={starting}>
          {starting ? 'A iniciar…' : 'Iniciar conversa'}
        </button>
        {error && <p role="alert" className="rounded-lg bg-app-neg-soft px-3 py-2 text-sm text-app-neg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-app-edge bg-app-sheet">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-app-rule px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-app-pos" aria-hidden="true" />
        <span className="text-sm font-semibold text-app-ink">Agente a responder</span>
        <span className="num ml-auto font-mono text-xs text-app-faint">conversa {conversation.id.slice(-6)}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-app-muted">Escreva a primeira mensagem, por exemplo: “Têm mesa para 4 hoje às 20h?”</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'whitespace-pre-wrap rounded-br-sm bg-app-accent px-4 py-2 text-app-accent-ink'
                : 'rounded-bl-sm bg-app-raised text-app-ink'
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
                        className="mt-2 flex items-center gap-2 rounded-lg border border-app-edge bg-app-sheet px-3 py-2 text-app-accent transition-colors hover:bg-app-raised"
                      >
                        <span className="truncate text-xs font-semibold">{docMatch[2]}</span>
                        <span className="ml-auto shrink-0 text-xs text-app-muted">Descarregar</span>
                      </a>
                    )}
                  </div>
                );
              })() : <span className="block whitespace-pre-wrap px-4 py-2">{msg.content}</span>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-app-raised px-4 py-2 text-sm text-app-muted">A escrever…</div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-center text-xs text-app-neg">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-app-rule p-3">
        <textarea
          aria-label="Mensagem"
          className="input max-h-28 flex-1 resize-none"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem…"
          disabled={sending}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
