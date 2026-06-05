import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimit.js';
import { callLLM, detectSentiment, LLMMessage } from '../lib/llm.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticate);

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// GET /api/conversations
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = Math.min(parseInt(req.query.take as string) || 20, 50);
  const agentId = req.query.agentId as string | undefined;

  const where = {
    tenantId: req.tenant!.id,
    ...(agentId ? { agentId } : {}),
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

  return res.json({ conversations, total });
});

// POST /api/conversations
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { agentId, channelType = 'web', visitorId, externalId } = req.body;

  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, tenantId: req.tenant!.id, isActive: true },
  });
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found or inactive' });
  }

  const conversation = await prisma.conversation.create({
    data: {
      tenantId: req.tenant!.id,
      agentId,
      channelType,
      visitorId,
      externalId,
      modelUsed: agent.model,
    },
  });

  return res.status(201).json(conversation);
});

// GET /api/conversations/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
    include: {
      agent: { select: { name: true, model: true, systemPrompt: true } },
      messages: {
        orderBy: { timestamp: 'asc' },
        select: { id: true, role: true, content: true, contentIV: true, tokens: true, timestamp: true },
      },
    },
  });

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant!.id },
    select: { encryptionKey: true },
  });

  // Decrypt messages if encrypted
  const messages = conversation.messages.map((m: { id: string; role: string; content: string; contentIV: string | null; tokens: number; timestamp: Date }) => {
    let content = m.content;
    if (m.contentIV && tenant?.encryptionKey) {
      try { content = decrypt(m.content, m.contentIV, tenant.encryptionKey); } catch { /* fallback */ }
    }
    return { id: m.id, role: m.role, content, tokens: m.tokens, timestamp: m.timestamp };
  });

  return res.json({ ...conversation, messages });
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', chatLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Message content is required and must be ≤ 4000 chars' });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
    include: {
      agent: true,
      messages: { orderBy: { timestamp: 'asc' }, take: 20 },
    },
  });

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (conversation.resolved || conversation.closedAt) {
    return res.status(400).json({ error: 'Conversation is closed' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant!.id },
    select: { encryptionKey: true, creditsTotal: true, creditsUsed: true },
  });

  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const available = tenant.creditsTotal - tenant.creditsUsed;
  if (available <= 0) {
    return res.status(402).json({ error: 'No credits available. Please purchase more.' });
  }

  // Build message history
  const history: LLMMessage[] = conversation.messages.map((m: { role: string; content: string; contentIV: string | null }) => {
    let content = m.content;
    if (m.contentIV && tenant.encryptionKey) {
      try { content = decrypt(m.content, m.contentIV, tenant.encryptionKey); } catch { /* fallback */ }
    }
    return { role: m.role as 'user' | 'assistant', content };
  });
  history.push({ role: 'user', content: parsed.data.content });

  // Encrypt user message
  let userContent = parsed.data.content;
  let userIV: string | undefined;
  if (tenant.encryptionKey) {
    const enc = encrypt(parsed.data.content, tenant.encryptionKey);
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

  // Call LLM
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
    return res.status(502).json({ error: `LLM error: ${msg}` });
  }

  // Encrypt assistant response
  let assistantContent = llmResponse.content;
  let assistantIV: string | undefined;
  if (tenant.encryptionKey) {
    const enc = encrypt(llmResponse.content, tenant.encryptionKey);
    assistantContent = enc.ciphertext;
    assistantIV = enc.iv;
  }

  const assistantMsg = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      contentIV: assistantIV,
      tokens: llmResponse.inputTokens + llmResponse.outputTokens,
      model: llmResponse.model,
    },
  });

  // Sentiment detection
  const sentiment = detectSentiment(parsed.data.content);

  // Update conversation stats + tenant credits
  await Promise.all([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        tokensUsed: { increment: llmResponse.inputTokens + llmResponse.outputTokens },
        creditsUsed: { increment: llmResponse.creditsUsed },
        modelUsed: llmResponse.model,
        sentiment,
      },
    }),
    prisma.tenant.update({
      where: { id: req.tenant!.id },
      data: { creditsUsed: { increment: llmResponse.creditsUsed } },
    }),
    prisma.agent.update({
      where: { id: conversation.agentId },
      data: { totalMessages: { increment: 2 } },
    }),
    prisma.creditLog.create({
      data: {
        tenantId: req.tenant!.id,
        amount: -llmResponse.creditsUsed,
        reason: 'chat',
        details: { agentId: conversation.agentId, model: llmResponse.model },
      },
    }),
  ]);

  return res.status(201).json({
    id: assistantMsg.id,
    role: 'assistant',
    content: llmResponse.content,
    tokens: llmResponse.inputTokens + llmResponse.outputTokens,
    creditsUsed: llmResponse.creditsUsed,
    sentiment,
    timestamp: assistantMsg.timestamp,
  });
});

// PATCH /api/conversations/:id/close
router.patch('/:id/close', async (req: AuthenticatedRequest, res: Response) => {
  const existing = await prisma.conversation.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!existing) return res.status(404).json({ error: 'Conversation not found' });

  const conversation = await prisma.conversation.update({
    where: { id: req.params.id },
    data: { resolved: true, closedAt: new Date() },
  });

  await prisma.agent.update({
    where: { id: existing.agentId },
    data: { totalConversations: { increment: 1 } },
  });

  return res.json(conversation);
});

export default router;
