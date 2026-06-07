import type { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../lib/prisma.js';
import { sendMessage } from '../services/conversations.service.js';

/**
 * Regista todos os handlers do socket.io para o chat em tempo real.
 * Visitantes conectam-se com o conversationId e enviam mensagens.
 * O servidor chama o LLM e emite a resposta de volta.
 */
// ─── Rate limiting por socket (anti-flood / denial of wallet) ────────────────
const SOCKET_WINDOW_MS = 60_000;   // janela de 1 min
const SOCKET_MAX_MSGS = 15;        // máximo de mensagens por janela

interface SocketState {
  windowStart: number;
  count: number;
  inFlight: boolean; // bloqueia mensagens concorrentes do mesmo socket
}

function checkSocketRate(state: SocketState): boolean {
  const now = Date.now();
  if (now - state.windowStart > SOCKET_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }
  if (state.count >= SOCKET_MAX_MSGS) return false;
  state.count += 1;
  return true;
}

export function registerChatSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    const state: SocketState = { windowStart: Date.now(), count: 0, inFlight: false };

    // Visitante entra na sala da conversa
    // SECURITY: o socket tem que apresentar o visitorId que foi atribuído em /api/chat/start
    // para provar que foi ele quem iniciou a conversa (BOLA prevention)
    socket.on('join', async ({ conversationId, visitorId }: { conversationId: string; visitorId?: string }) => {
      if (!conversationId || typeof conversationId !== 'string') return;

      // Verifica se a conversa existe e pertence ao visitorId correto
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, visitorId: true, closedAt: true },
      }).catch(() => null);

      if (!convo) {
        socket.emit('error', { message: 'Conversa não encontrada' });
        return;
      }

      // SECURITY: Verificar visitorId SEMPRE que a conversa tem um registado.
      // O check anterior `if (visitorId && ...)` permitia que qualquer socket
      // entrasse numa conversa sem fornecer visitorId (condição avaliava para
      // false com undefined) — qualquer pessoa com o conversationId acedia ao stream.
      if (convo.visitorId && convo.visitorId !== visitorId) {
        socket.emit('error', { message: 'Acesso não autorizado a esta conversa' });
        return;
      }

      if (convo.closedAt) {
        socket.emit('error', { message: 'Esta conversa já foi encerrada' });
        return;
      }

      socket.join(conversationId);
      socket.emit('joined', { conversationId });
    });

    // Visitante envia mensagem
    socket.on('message', async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!conversationId || !content || typeof content !== 'string') return;
      if (content.trim().length === 0 || content.length > 4000) return;

      // Verifica se o socket está na sala certa
      if (!socket.rooms.has(conversationId)) {
        socket.emit('error', { message: 'Deve entrar na conversa primeiro' });
        return;
      }

      // Anti-flood: rejeita mensagens concorrentes e excesso por janela
      if (state.inFlight) {
        socket.emit('error', { message: 'Aguarde a resposta anterior' });
        return;
      }
      if (!checkSocketRate(state)) {
        socket.emit('error', { message: 'Demasiadas mensagens. Tente novamente daqui a um minuto.' });
        return;
      }

      state.inFlight = true;

      // Emite "a escrever..." para feedback imediato
      socket.emit('typing', { conversationId });

      try {
        // Obtém tenantId a partir da conversa
        const convo = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { tenantId: true },
        });

        if (!convo) {
          socket.emit('error', { message: 'Conversa não encontrada' });
          return;
        }

        const response = await sendMessage(convo.tenantId, conversationId, content.trim());

        // Emite a resposta do assistente
        io.to(conversationId).emit('message', {
          id: response.id,
          role: 'assistant',
          content: response.content,
          tokens: response.tokens,
          creditsUsed: response.creditsUsed,
          sentiment: response.sentiment,
          timestamp: response.timestamp,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        socket.emit('error', { message: msg });
      } finally {
        state.inFlight = false;
      }
    });
  });
}
