import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Props {
  agentId: string;
  agentName?: string;
  conversationId: string;
  /** Cor da marca do negócio (bolhas do visitante e botão enviar). */
  brandColor?: string;
  /** Sem cabeçalho nem moldura: a página que o contém já mostra a marca. */
  bare?: boolean;
}

const DEFAULT_BRAND = '#2346D8';

/** Texto branco ou tinta, consoante a luminosidade da cor da marca. */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.45 ? '#13213C' : '#FFFFFF';
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/**
 * Widget de chat em tempo real via socket.io.
 * Usado por visitantes (clientes finais) nas páginas /chat/[agentId].
 * Requer um conversationId obtido via POST /api/chat/start.
 */
export default function PublicChatWidget({ agentId: _agentId, agentName, conversationId, brandColor, bare = false }: Props) {
  const brand = brandColor || DEFAULT_BRAND;
  const onBrand = readableOn(brand);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { conversationId });
    });

    socket.on('joined', () => {
      setConnected(true);
    });

    socket.on('typing', () => {
      setTyping(true);
    });

    socket.on('message', (msg: Message) => {
      setTyping(false);
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('error', ({ message }: { message: string }) => {
      setTyping(false);
      setError(message);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [conversationId]);

  const sendMessage = () => {
    if (!input.trim() || !connected || typing) return;
    const userMsg: Message = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setError(null);
    socketRef.current?.emit('message', { conversationId, content: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const initial = (agentName ?? 'A').charAt(0).toUpperCase();

  return (
    <div className={`flex h-full min-h-0 flex-col bg-white text-ink ${bare ? '' : 'overflow-hidden rounded-2xl border border-line'}`} style={{ colorScheme: 'light' }}>
      {!bare && (
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: brand, color: onBrand }} aria-hidden="true">{initial}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{agentName ?? 'Assistente'}</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-mute">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-line'}`} aria-hidden="true" />
              {connected ? 'Online' : 'A ligar…'}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto bg-mist px-3 py-4 sm:px-4" role="log" aria-live="polite" aria-label="Conversa">
        {messages.length === 0 && !typing && (
          <p className="pt-10 text-center text-sm text-ink-mute">
            {connected ? 'Olá! Como posso ajudar?' : 'A estabelecer ligação…'}
          </p>
        )}
        {messages.map((msg, i) => {
          const mine = msg.role === 'user';
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const firstOfRun = !prev || prev.role !== msg.role;
          const lastOfRun = !next || next.role !== msg.role;
          return (
            <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${firstOfRun && i > 0 ? 'pt-2' : ''}`}>
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed ${
                  mine ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md border border-line bg-white text-ink'
                }`}
                style={mine ? { backgroundColor: brand, color: onBrand } : undefined}
              >
                {msg.content}
              </div>
              {lastOfRun && <span className="num mt-1 px-1 text-[11px] text-ink-mute">{hhmm(msg.timestamp)}</span>}
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start pt-2" aria-label={`${agentName ?? 'O assistente'} está a escrever`}>
            <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        {error && <p role="alert" className="pt-2 text-center text-xs text-red-700">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-line bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <textarea
          className="max-h-28 flex-1 resize-none rounded-2xl border border-line bg-mist px-3.5 py-2 text-base text-ink placeholder:text-ink-mute outline-none focus:border-ink-mute sm:text-sm"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem"
          aria-label="Mensagem"
          disabled={!connected || typing}
        />
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
          style={{ backgroundColor: brand, color: onBrand }}
          onClick={sendMessage}
          disabled={!input.trim() || !connected || typing}
          aria-label="Enviar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
