import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

export async function getCredits(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { creditsTotal: true, creditsUsed: true, plan: true, creditsRefreshDate: true },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const history = await prisma.creditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const available = tenant.creditsTotal - tenant.creditsUsed;
  const usedPercent = tenant.creditsTotal > 0
    ? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100)
    : 0;

  return {
    total: tenant.creditsTotal,
    used: tenant.creditsUsed,
    available,
    usedPercent,
    plan: tenant.plan,
    refreshDate: tenant.creditsRefreshDate,
    history,
  };
}

export async function getUsageByAgent(tenantId: string) {
  const agents = await prisma.agent.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      conversations: { select: { creditsUsed: true } },
    },
  });

  const usage = agents.map((a) => ({
    agentId: a.id,
    agentName: a.name,
    creditsUsed: a.conversations.reduce((sum, c) => sum + c.creditsUsed, 0),
  }));

  return { usage };
}
