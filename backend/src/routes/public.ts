import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/public/agent/:agentId
 * Retorna dados públicos de um agente para a página whitelabel /w/[agentId].
 * Não requer autenticação.
 */
router.get('/agent/:agentId', asyncHandler(async (req: Request, res: Response) => {
  const { agentId } = req.params;

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

export default router;
