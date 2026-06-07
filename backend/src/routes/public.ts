import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { publicApiLimiter } from '../middleware/rateLimit.js';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/public/agent/:agentId
 * Retorna dados públicos de um agente para a página whitelabel /w/[agentId].
 * Não requer autenticação.
 */
router.get('/agent/:agentId', publicApiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { agentId } = req.params;

  // Validate cuid format to prevent enumeration probing
  if (!agentId || !/^c[a-z0-9]{20,32}$/.test(agentId)) {
    throw new BadRequestError('Invalid agent id');
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, isActive: true, webChatEnabled: true, whitelabelEnabled: true },
    select: {
      id: true,
      name: true,
      description: true,
      tenant: {
        select: {
          id: true,
          companyName: true,
          name: true,
          domain: true,
          brandColor: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!agent) throw new NotFoundError('Whitelabel page not found');

  res.json({
    agentId: agent.id,
    agentName: agent.name,
    agentDescription: agent.description,
    companyName: agent.tenant.companyName ?? agent.tenant.name,
    tenantId: agent.tenant.id,
    domain: agent.tenant.domain,
    brandColor: agent.tenant.brandColor ?? '#3b57f0',
    logoUrl: agent.tenant.logoUrl ?? null,
  });
}));

/**
 * GET /api/public/orders/:agentId
 * Retorna pedidos ativos de um agente para visualização pública (painel KDS sem autenticação).
 * Expõe apenas dados não-sensíveis: id, description, amount, status, timestamps.
 * NÃO expõe buyerPhone, tenantId ou externalId.
 */
router.get('/orders/:agentId', publicApiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { agentId } = req.params;

  // Validate cuid format to prevent probing with arbitrary strings
  if (!agentId || !/^c[a-z0-9]{20,32}$/.test(agentId)) {
    throw new BadRequestError('Invalid agent id');
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, isActive: true },
    select: {
      id: true,
      name: true,
      tenant: { select: { companyName: true, name: true, brandColor: true, logoUrl: true } },
    },
  });

  if (!agent) throw new NotFoundError('Agent not found');

  const orders = await prisma.order.findMany({
    where: {
      agentId,
      status: { in: ['paid', 'processing', 'done'] },
      // Only return orders from last 24h to avoid unbounded data
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      description: true,
      amount: true,
      status: true,
      createdAt: true,
      paidAt: true,
    },
  });

  res.json({
    agentId: agent.id,
    agentName: agent.name,
    companyName: agent.tenant.companyName ?? agent.tenant.name,
    brandColor: agent.tenant.brandColor ?? '#3b57f0',
    logoUrl: agent.tenant.logoUrl ?? null,
    orders,
  });
}));

export default router;
