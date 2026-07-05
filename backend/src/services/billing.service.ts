import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { PLAN_LIMITS, Plan } from '../types/index.js';

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

/**
 * Debita créditos por mensagem enviada via WhatsApp ou Instagram API.
 * Chamado pelo webhook APÓS cada envio bem-sucedido ao cliente.
 * Nunca lança exceção — falhas de billing não devem bloquear o webhook.
 */
export async function deductWaMsgCredit(
  tenantId: string,
  agentId: string,
  conversationId: string,
  channel: 'whatsapp' | 'instagram',
): Promise<void> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) return;

    const plan = tenant.plan as Plan;
    const cost = PLAN_LIMITS[plan]?.waMsgCreditCost ?? 6;

    await Promise.all([
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          creditsUsed: { increment: cost },
          waMsgsSent:  { increment: 1 },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { waMsgsSent: { increment: 1 } },
      }),
      prisma.creditLog.create({
        data: {
          tenantId,
          amount: -cost,
          reason: 'wamsg',
          details: { agentId, conversationId, channel, cost },
        },
      }),
    ]);
  } catch (err) {
    console.error('[Billing] Falha ao debitar créditos WA msg:', err);
  }
}
