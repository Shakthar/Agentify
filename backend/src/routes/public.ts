import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/public/portal/:tenantId
 * Retorna dados públicos de um tenant para a página whitelabel.
 * Não requer autenticação.
 */
router.get('/portal/:tenantId', asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: {
      id: true,
      companyName: true,
      name: true,
      domain: true,
    },
  });

  if (!tenant) throw new NotFoundError('Portal not found');

  const agents = await prisma.agent.findMany({
    where: { tenantId, isActive: true, webChatEnabled: true },
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    companyName: tenant.companyName ?? tenant.name,
    domain: tenant.domain,
    agents,
  });
}));

export default router;
