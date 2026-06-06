import { Router, Request, Response } from 'express';
import { chatLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * POST /api/chat/start
 * Endpoint público (sem JWT) para visitantes iniciarem uma conversa.
 * Usado pelo chat widget embebido em sites de clientes.
 */
router.post('/start', chatLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { agentId, visitorId } = req.body;

  if (!agentId || typeof agentId !== 'string') {
    throw new BadRequestError('agentId is required');
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, isActive: true, webChatEnabled: true },
    select: { id: true, name: true, tenantId: true, model: true },
  });

  if (!agent) {
    throw new NotFoundError('Agent not found or web chat disabled');
  }

  const conversation = await prisma.conversation.create({
    data: {
      tenantId: agent.tenantId,
      agentId: agent.id,
      channelType: 'web',
      visitorId: visitorId ?? `visitor_${Date.now()}`,
      modelUsed: agent.model,
    },
  });

  res.status(201).json({
    conversationId: conversation.id,
    agentName: agent.name,
    agentId: agent.id,
  });
}));

export default router;
