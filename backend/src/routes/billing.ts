import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticate);

// GET /api/billing/credits
router.get('/credits', async (req: AuthenticatedRequest, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant!.id },
    select: { creditsTotal: true, creditsUsed: true, plan: true, creditsRefreshDate: true },
  });

  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const history = await prisma.creditLog.findMany({
    where: { tenantId: req.tenant!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const available = tenant.creditsTotal - tenant.creditsUsed;
  const usedPercent = tenant.creditsTotal > 0
    ? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100)
    : 0;

  return res.json({
    total: tenant.creditsTotal,
    used: tenant.creditsUsed,
    available,
    usedPercent,
    plan: tenant.plan,
    refreshDate: tenant.creditsRefreshDate,
    history,
  });
});

// GET /api/billing/usage-by-agent
router.get('/usage-by-agent', async (req: AuthenticatedRequest, res: Response) => {
  const agents = await prisma.agent.findMany({
    where: { tenantId: req.tenant!.id },
    select: {
      id: true, name: true,
      conversations: {
        select: { creditsUsed: true },
      },
    },
  });

  const usage = agents.map((a: { id: string; name: string; conversations: { creditsUsed: number }[] }) => ({
    agentId: a.id,
    agentName: a.name,
    creditsUsed: a.conversations.reduce((sum: number, c: { creditsUsed: number }) => sum + c.creditsUsed, 0),
  }));

  return res.json({ usage });
});

export default router;
