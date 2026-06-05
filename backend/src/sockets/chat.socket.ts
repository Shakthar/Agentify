import type { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../lib/prisma.js';
import { sendMessage } from '../services/conversations.service.js';

/**
 * Regista todos os handlers do socket.io para o chat em tempo real.
 * Visitantes conectam-se com o conversationId e enviam mensagens.
 * O servidor chama o LLM e emite a resposta de volta.
 */
export function registerChatSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    // Visitante entra na sala da conversa
    socket.on('join', async ({ conversationId }: { conversationId: string }) => {
      if (!conversationId || typeof conversationId !== 'string') return;

      // Verifica se a conversa existe antes de deixar entrar
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      }).catch(() => null);

      if (!convo) {
        socket.emit('error', { message: 'Conversa não encontrada' });
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
      }
    });
  });
}
