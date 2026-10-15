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
      waMsgsSent: true,
      conversations: { select: { creditsUsed: true, waMsgsSent: true } },
    },
  });

  const usage = agents.map((a) => {
    const llmCredits  = a.conversations.reduce((sum, c) => sum + c.creditsUsed, 0);
    const waMsgs      = a.waMsgsSent; // contador direto no agente (mais rápido)
    return {
      agentId:      a.id,
      agentName:    a.name,
      creditsUsed:  llmCredits,
      waMsgsSent:   waMsgs,
      waCreditsUsed: 0, // mensagens de canal não consomem créditos (Meta fatura o dono do número)
      totalCreditsUsed: llmCredits,
    };
  });

  return { usage };
}

/**
 * Regista cada mensagem enviada ao cliente por API de canal (WhatsApp, Instagram, Telegram).
 * NÃO debita créditos: as tarifas da Meta são cobradas diretamente ao dono do número
 * (cartão registado na Meta no onboarding). Os créditos cobrem só a operação de IA.
 * Mantém os contadores waMsgsSent para métricas.
 * Nunca lança exceção — falhas de registo não devem bloquear o webhook.
 */
export async function deductWaMsgCredit(
  tenantId: string,
  agentId: string,
  conversationId: string,
  _channel: 'whatsapp' | 'instagram' | 'telegram',
  _recipient?: string,
): Promise<void> {
  try {
    await Promise.all([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { waMsgsSent: { increment: 1 } },
      }),
      prisma.agent.update({
        where: { id: agentId },
        data: { waMsgsSent: { increment: 1 } },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { waMsgsSent: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    console.error('[Billing] Falha ao registar msg de canal:', err);
  }
}
