import prisma from '../lib/prisma.js';
import { callLLM, detectSentiment, LLMMessage } from '../lib/llm.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import {
  BadRequestError,
  NotFoundError,
  PaymentRequiredError,
  UpstreamError,
} from '../lib/errors.js';
import { writeAuditLog } from './admin.service.js';

interface ListConversationsParams {
  skip?: number;
  take?: number;
  agentId?: string;
}

interface CreateConversationInput {
  agentId?: string;
  channelType?: string;
  visitorId?: string;
  externalId?: string;
}

/** Decifra o conteúdo de uma mensagem quando há IV e chave disponíveis. */
function decryptContent(content: string, iv: string | null, key?: string | null): string {
  if (iv && key) {
    try {
      return decrypt(content, iv, key);
    } catch {
      /* fallback para texto original */
    }
  }
  return content;
}

export async function listConversations(tenantId: string, params: ListConversationsParams) {
  const skip = params.skip ?? 0;
  const take = Math.min(params.take ?? 20, 50);

  const where = {
    tenantId,
    ...(params.agentId ? { agentId: params.agentId } : {}),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, agentId: true, channelType: true, visitorId: true,
        sentiment: true, urgency: true, resolved: true,
        handedOffToHuman: true, tokensUsed: true, creditsUsed: true,
        createdAt: true, closedAt: true,
        agent: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return { conversations, total };
}

export async function createConversation(tenantId: string, input: CreateConversationInput) {
  if (!input.agentId) {
    throw new BadRequestError('agentId is required');
  }

  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, tenantId, isActive: true },
  });
  if (!agent) {
    throw new NotFoundError('Agent not found or inactive');
  }

  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      agentId: input.agentId,
      channelType: input.channelType ?? 'web',
      visitorId: input.visitorId,
      externalId: input.externalId,
      modelUsed: agent.model,
    },
  });

  writeAuditLog(tenantId, 'conversation_created', 'conversation', conversation.id, { agentId: input.agentId, channel: input.channelType });
  return conversation;
}

export async function getConversation(tenantId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      agent: { select: { name: true, model: true, systemPrompt: true } },
      messages: {
        orderBy: { timestamp: 'asc' },
        select: { id: true, role: true, content: true, contentIV: true, tokens: true, timestamp: true },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { encryptionKey: true },
  });

  const messages = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: decryptContent(m.content, m.contentIV, tenant?.encryptionKey),
    tokens: m.tokens,
    timestamp: m.timestamp,
  }));

  return { ...conversation, messages };
}

export async function sendMessage(tenantId: string, conversationId: string, content: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      agent: true,
      messages: { orderBy: { timestamp: 'asc' }, take: 20 },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }
  if (conversation.resolved || conversation.closedAt) {
    throw new BadRequestError('Conversation is closed');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { encryptionKey: true, creditsTotal: true, creditsUsed: true },
  });
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const available = tenant.creditsTotal - tenant.creditsUsed;
  if (available <= 0) {
    throw new PaymentRequiredError('No credits available. Please purchase more.');
  }

  // Histórico para o LLM (decifrado)
  const history: LLMMessage[] = conversation.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: decryptContent(m.content, m.contentIV, tenant.encryptionKey),
  }));
  history.push({ role: 'user', content });

  // Persiste a mensagem do utilizador (cifrada)
  let userContent = content;
  let userIV: string | undefined;
  if (tenant.encryptionKey) {
    const enc = encrypt(content, tenant.encryptionKey);
    userContent = enc.ciphertext;
    userIV = enc.iv;
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: userContent,
      contentIV: userIV,
    },
  });

  // Chamada ao LLM
  let llmResponse;
  try {
    llmResponse = await callLLM(
      conversation.agent.model,
      conversation.agent.systemPrompt,
      history,
      conversation.agent.maxTokens,
      conversation.agent.temperature,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new UpstreamError(`LLM error: ${msg}`);
  }

  // Persiste a resposta do assistente (cifrada)
  let assistantContent = llmResponse.content;
  let assistantIV: string | undefined;
  if (tenant.encryptionKey) {
    const enc = encrypt(llmResponse.content, tenant.encryptionKey);
    assistantContent = enc.ciphertext;
    assistantIV = enc.iv;
  }

  const totalTokens = llmResponse.inputTokens + llmResponse.outputTokens;

  const assistantMsg = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      contentIV: assistantIV,
      tokens: totalTokens,
      model: llmResponse.model,
    },
  });

  const sentiment = detectSentiment(content);

  // Atualiza estatísticas + créditos numa só transação lógica
  await Promise.all([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        tokensUsed: { increment: totalTokens },
        creditsUsed: { increment: llmResponse.creditsUsed },
        modelUsed: llmResponse.model,
        sentiment,
      },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { creditsUsed: { increment: llmResponse.creditsUsed } },
    }),
    prisma.agent.update({
      where: { id: conversation.agentId },
      data: { totalMessages: { increment: 2 } },
    }),
    prisma.creditLog.create({
      data: {
        tenantId,
        amount: -llmResponse.creditsUsed,
        reason: 'chat',
        details: { agentId: conversation.agentId, model: llmResponse.model },
      },
    }),
  ]);

  return {
    id: assistantMsg.id,
    role: 'assistant',
    content: llmResponse.content,
    tokens: totalTokens,
    creditsUsed: llmResponse.creditsUsed,
    sentiment,
    timestamp: assistantMsg.timestamp,
  };
}

export async function closeConversation(tenantId: string, conversationId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!existing) {
    throw new NotFoundError('Conversation not found');
  }

  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { resolved: true, closedAt: new Date() },
  });

  await prisma.agent.update({
    where: { id: existing.agentId },
    data: { totalConversations: { increment: 1 } },
  });

  writeAuditLog(tenantId, 'conversation_closed', 'conversation', conversationId);
  return conversation;
}
