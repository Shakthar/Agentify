import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';

export interface AdminMetrics {
  agents: { total: number; active: number };
  conversations: { total: number; today: number; open: number };
  messages: { total: number };
  credits: { total: number; used: number; available: number; usedPercent: number };
  orders: {
    total: number;
    today: number;
    thisMonth: number;
    totalRevenue: number;
    thisMonthRevenue: number;
  };
  visitors: { identified: number };
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

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalAgents,
    activeAgents,
    totalConversations,
    todayConversations,
    openConversations,
    totalMessages,
    tenant,
    totalOrders,
    todayOrders,
    thisMonthOrders,
    totalRevenueResult,
    thisMonthRevenueResult,
    identifiedConversations,
  ] = await Promise.all([
    prisma.agent.count({ where: { tenantId } }),
    prisma.agent.count({ where: { tenantId, isActive: true } }),
    prisma.conversation.count({ where: { tenantId } }),
    prisma.conversation.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { tenantId, resolved: false, closedAt: null } }),
    prisma.message.count({ where: { conversation: { tenantId } } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { creditsTotal: true, creditsUsed: true },
    }),
    prisma.order.count({
      where: { tenantId, status: { in: ['paid', 'done'] } },
    }),
    prisma.order.count({
      where: {
        tenantId,
        status: { in: ['paid', 'done'] },
        createdAt: { gte: todayStart },
      },
    }),
    prisma.order.count({
      where: {
        tenantId,
        status: { in: ['paid', 'done'] },
        createdAt: { gte: monthStart },
      },
    }),
    prisma.order.aggregate({
      where: { tenantId, status: { in: ['paid', 'done'] } },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: {
        tenantId,
        status: { in: ['paid', 'done'] },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.conversation.count({
      where: { tenantId, visitorId: { not: null } },
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
    orders: {
      total: totalOrders,
      today: todayOrders,
      thisMonth: thisMonthOrders,
      totalRevenue: totalRevenueResult._sum?.amount ?? 0,
      thisMonthRevenue: thisMonthRevenueResult._sum?.amount ?? 0,
    },
    visitors: { identified: identifiedConversations },
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

/** Regista uma acao de auditoria de forma assincrona (fire-and-forget). */
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
