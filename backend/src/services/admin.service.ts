import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';

export interface AdminMetrics {
  agents: { total: number; active: number };
  conversations: { total: number; today: number; open: number };
  messages: { total: number };
  credits: { total: number; used: number; available: number; usedPercent: number };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: unknown;
  createdAt: Date;
}

export async function getMetrics(tenantId: string): Promise<AdminMetrics> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalAgents,
    activeAgents,
    totalConversations,
    todayConversations,
    openConversations,
    totalMessages,
    tenant,
  ] = await Promise.all([
    prisma.agent.count({ where: { tenantId } }),
    prisma.agent.count({ where: { tenantId, isActive: true } }),
    prisma.conversation.count({ where: { tenantId } }),
    prisma.conversation.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { tenantId, resolved: false, closedAt: null } }),
    prisma.message.count({
      where: { conversation: { tenantId } },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { creditsTotal: true, creditsUsed: true },
    }),
  ]);

  const creditsTotal = tenant?.creditsTotal ?? 0;
  const creditsUsed = tenant?.creditsUsed ?? 0;
  const available = creditsTotal - creditsUsed;
  const usedPercent = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;

  return {
    agents: { total: totalAgents, active: activeAgents },
    conversations: { total: totalConversations, today: todayConversations, open: openConversations },
    messages: { total: totalMessages },
    credits: { total: creditsTotal, used: creditsUsed, available, usedPercent },
  };
}

export async function getAuditLogs(
  tenantId: string,
  skip = 0,
  take = 50,
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: { id: true, action: true, resourceType: true, resourceId: true, details: true, createdAt: true },
    }),
    prisma.auditLog.count({ where: { tenantId } }),
  ]);

  return { logs, total };
}

/** Regista uma ação de auditoria de forma assíncrona (fire-and-forget). */
export function writeAuditLog(
  tenantId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>,
) {
  prisma.auditLog
    .create({ data: { tenantId, action, resourceType, resourceId, details: (details ?? undefined) as Prisma.InputJsonValue | undefined } })
    .catch((err: unknown) => console.error('[AuditLog]', err));
}
