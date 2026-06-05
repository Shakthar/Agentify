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
}

/**
 * Widget de chat em tempo real via socket.io.
 * Usado por visitantes (clientes finais) nas páginas /chat/[agentId].
 * Requer um conversationId obtido via POST /api/chat/start.
 */
export default function PublicChatWidget({ agentId: _agentId, agentName, conversationId }: Props) {
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

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-white shadow-lg">
      {/* Header */}
      <div className="bg-brand-600 text-white px-4 py-3 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-400'}`} />
        <span className="text-sm font-medium">{agentName ?? 'Assistente'}</span>
        {!connected && <span className="ml-auto text-xs opacity-70">A ligar...</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !typing && (
          <p className="text-center text-gray-400 text-sm pt-8">
            {connected ? 'Olá! Como posso ajudar?' : 'A estabelecer ligação...'}
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {typing && (
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
        {error && <p className="text-center text-red-500 text-xs">{error}</p>}
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
          disabled={!connected || typing}
        />
        <button
          className="btn-primary h-9 px-3"
          onClick={sendMessage}
          disabled={!input.trim() || !connected || typing}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
