import prisma from '../lib/prisma.js';
import { callLLM, detectSentiment, LLMMessage } from '../lib/llm.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';
import { buildContextForQuery } from './knowledge.service.js';
import { createMbwayCharge } from './payments.service.js';
import { PLAN_LIMITS, Plan } from '../types/index.js';
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

  const dataKey = unwrapDataKey(tenant?.encryptionKey);
  const messages = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: decryptContent(m.content, m.contentIV, dataKey),
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
    select: { encryptionKey: true, creditsTotal: true, creditsUsed: true, plan: true },
  });
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const available = tenant.creditsTotal - tenant.creditsUsed;
  if (available <= 0) {
    throw new PaymentRequiredError('No credits available. Please purchase more.');
  }

  const planLimits = PLAN_LIMITS[tenant.plan as Plan] ?? PLAN_LIMITS.free;
  const paymentSkillCost = planLimits.paymentSkillCost; // null = bloqueado, 0+ = custo em créditos

  const dataKey = unwrapDataKey(tenant.encryptionKey);

  // Histórico para o LLM (decifrado)
  const history: LLMMessage[] = conversation.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: decryptContent(m.content, m.contentIV, dataKey),
  }));
  history.push({ role: 'user', content });

  // Persiste a mensagem do utilizador (cifrada)
  let userContent = content;
  let userIV: string | undefined;
  if (dataKey) {
    const enc = encrypt(content, dataKey);
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

  // Recupera contexto relevante da base de conhecimento (RAG).
  // Falhas aqui não devem impedir a conversa.
  let systemPrompt = conversation.agent.systemPrompt;
  try {
    const kbContext = await buildContextForQuery(conversation.agentId, content);
    if (kbContext) systemPrompt += kbContext;
  } catch {
    /* ignora falhas de RAG e segue com o prompt base */
  }

  // Injeta lista de documentos disponíveis para envio
  try {
    const agentDocs = await prisma.agentDoc.findMany({
      where: { agentId: conversation.agentId },
      select: { id: true, name: true, description: true },
    });
    if (agentDocs.length > 0) {
      systemPrompt += '\n\n---\nDocumentos que podes enviar ao cliente (usa exatamente o marcador indicado na tua resposta quando o cliente pedir esse documento):\n';
      for (const doc of agentDocs) {
        systemPrompt += `- [SEND_DOC:${doc.id}] ${doc.name}${doc.description ? ` — ${doc.description}` : ''}\n`;
      }
      systemPrompt += 'Exemplo: "Aqui está o nosso menu! [SEND_DOC:abc123]"\n';
    }
  } catch {
    /* ignorar falhas de doc injection */
  }

  // Injeta skill de cobrança MB Way (apenas para planos com acesso)
  // O agente usa [MBWAY:351912345678|5.00|2x Café] para disparar o pagamento
  if (paymentSkillCost !== null) {
    systemPrompt += '\n\n---\nCobrança MB Way: quando o cliente confirmar um pedido e fornecer o número de telmóvel, usa o marcador [MBWAY:NUMERO|VALOR|DESCRICAO] na tua resposta.'
      + ' Substitui NUMERO pelo número do cliente no formato 351XXXXXXXXX (Portugal) ou código do país + número sem espaços, VALOR pelo montante em euros (ex: 5.50), DESCRICAO pelo resumo do pedido (ex: 2x Café e 1x Bolo).'
      + ' Exemplo: "Ok! Vou enviar o pedido de \u20ac5.50 para o seu MB Way! [MBWAY:351912345678|5.50|2x Café e 1x Bolo]"'
      + ' Nunca uses este marcador sem ter o número de telmóvel do cliente. Se não tiveres o número, pede-o primeiro.';
  }

  // Chamada ao LLM
  let llmResponse;
  try {
    llmResponse = await callLLM(
      conversation.agent.model,
      systemPrompt,
      history,
      conversation.agent.maxTokens,
      conversation.agent.temperature,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new UpstreamError(`LLM error: ${msg}`);
  }

  // Parseia [SEND_DOC:id] da resposta do LLM
  const sendDocMatch = llmResponse.content.match(/\[SEND_DOC:([a-z0-9]+)\]/i);
  const docId = sendDocMatch?.[1] ?? null;

  // Parseia [MBWAY:phone|amount|description] da resposta do LLM
  const mbwayMatch = llmResponse.content.match(/\[MBWAY:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/i);
  const cleanContent = llmResponse.content
    .replace(/\[SEND_DOC:[a-z0-9]+\]/gi, '')
    .replace(/\[MBWAY:[^\]]+\]/gi, '')
    .trim();

  let docAttachment: { id: string; name: string; url: string } | null = null;
  if (docId) {
    const doc = await prisma.agentDoc.findUnique({ where: { id: docId }, select: { id: true, name: true, fileUrl: true } });
    if (doc) docAttachment = { id: doc.id, name: doc.name, url: doc.fileUrl };
  }

  // Processa cobrança MB Way se o agente a disparou e o plano permite
  let mbwayCharge: { orderId: string; phone: string; amount: number; description: string; mock: boolean } | null = null;
  if (mbwayMatch && paymentSkillCost !== null) {
    const [, rawPhone, rawAmount, rawDesc] = mbwayMatch;
    const phone = rawPhone.replace(/[^0-9]/g, '');
    const amount = parseFloat(rawAmount.replace(',', '.'));
    const description = rawDesc.trim().slice(0, 255);
    if (phone && !isNaN(amount) && amount > 0) {
      try {
        const result = await createMbwayCharge({
          tenantId,
          agentId: conversation.agentId,
          conversationId: conversation.id,
          buyerPhone: phone,
          amount,
          description,
          notifyPhone: conversation.agent.notifyPhone ?? undefined,
          extraCreditCost: paymentSkillCost, // déduz créditos do plano
        });
        mbwayCharge = { orderId: result.orderId, phone, amount, description, mock: result.mock };
        console.log(`[Payments] Order MB Way criada: ${result.orderId} (mock=${result.mock}, custo=${paymentSkillCost} créditos)`);
      } catch (err) {
        console.error('[Payments] Falha ao criar cobrança MB Way:', err);
      }
    }
  }

  // Persiste a resposta do assistente (cifrada, sem o marcador [SEND_DOC])
  let assistantContent = cleanContent;
  let assistantIV: string | undefined;
  if (dataKey) {
    const enc = encrypt(cleanContent, dataKey);
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
        details: {
          agentId: conversation.agentId,
          model: llmResponse.model,
          inputTokens: llmResponse.inputTokens,
          outputTokens: llmResponse.outputTokens,
          apiCostEur: llmResponse.apiCostEur, // custo real pago ao fornecedor
        },
      },
    }),
  ]);

  return {
    id: assistantMsg.id,
    role: 'assistant',
    content: cleanContent,
    tokens: totalTokens,
    creditsUsed: llmResponse.creditsUsed,
    sentiment,
    timestamp: assistantMsg.timestamp,
    docAttachment,
    mbwayCharge,
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
