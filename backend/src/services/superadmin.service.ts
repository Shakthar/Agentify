import prisma from '../lib/prisma.js';

const PLAN_PRICE: Record<string, number> = {
  free: 0,
  starter: 39,
  pro: 89,
  business: 159,
  enterprise: 259,
};

// ── Platform-wide dashboard ──────────────────────────────────────────────────
export async function getPlatformMetrics() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalTenants,
    totalAgents,
    activeAgents,
    totalConversations,
    todayConversations,
    totalMessages,
    tenantsByPlan,
    expenses,
    creditLogs,
  ] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.agent.count(),
    prisma.agent.count({ where: { isActive: true } }),
    prisma.conversation.count(),
    prisma.conversation.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.message.count(),
    prisma.tenant.groupBy({ by: ['plan'], _count: { id: true }, where: { deletedAt: null } }),
    prisma.platformExpense.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.creditLog.findMany({
      where: { reason: 'chat' },
      select: { amount: true, details: true },
    }),
  ]);

  // Revenue
  const planBreakdown: Record<string, number> = {};
  let mrr = 0;
  for (const row of tenantsByPlan) {
    const price = PLAN_PRICE[row.plan] ?? 0;
    planBreakdown[row.plan] = row._count.id;
    mrr += price * row._count.id;
  }

  // Monthly expenses (recurring) + one-time this month
  const monthlyExpenses = expenses.filter((e) => e.recurring && e.period === 'monthly');
  const yearlyExpenses  = expenses.filter((e) => e.recurring && e.period === 'yearly');
  const totalExpenses   = monthlyExpenses.reduce((s, e) => s + e.amount, 0)
                        + yearlyExpenses.reduce((s, e) => s + e.amount / 12, 0);

  // Aggregate real API costs from CreditLog details
  let totalCreditsConsumed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let realApiCostEur = 0;
  for (const log of creditLogs) {
    totalCreditsConsumed += Math.abs(log.amount);
    const d = log.details as Record<string, number> | null;
    if (d) {
      totalInputTokens  += d.inputTokens  ?? 0;
      totalOutputTokens += d.outputTokens ?? 0;
      realApiCostEur    += d.apiCostEur   ?? 0;
    }
  }

  return {
    tenants: { total: totalTenants, byPlan: planBreakdown },
    agents:  { total: totalAgents, active: activeAgents },
    conversations: { total: totalConversations, today: todayConversations },
    messages: { total: totalMessages },
    revenue: { mrr, arr: mrr * 12 },
    expenses: {
      monthly: totalExpenses,
      items: expenses,
    },
    usage: {
      creditsConsumed: totalCreditsConsumed, // unidade interna
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      realApiCostEur: Math.round(realApiCostEur * 100) / 100, // custo real EUR
    },
    balance: mrr - totalExpenses,
  };
}

// ── All tenants list ──────────────────────────────────────────────────────────
export async function getAllTenants() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, plan: true, createdAt: true,
      creditsTotal: true, creditsUsed: true, monthlyRecurringRevenue: true,
      paymentStatus: true, isAdmin: true,
      _count: { select: { agents: true, conversations: true } },
    },
  });

  return tenants.map((t) => ({
    ...t,
    planPrice: PLAN_PRICE[t.plan] ?? 0,
    creditsAvailable: t.creditsTotal - t.creditsUsed,
    creditsUsedPercent: t.creditsTotal > 0 ? Math.round((t.creditsUsed / t.creditsTotal) * 100) : 0,
  }));
}

// ── Expenses CRUD ─────────────────────────────────────────────────────────────
export async function createExpense(data: {
  category: string;
  description: string;
  amount: number;
  recurring: boolean;
  period: string;
}) {
  return prisma.platformExpense.create({ data });
}

export async function deleteExpense(id: string) {
  return prisma.platformExpense.delete({ where: { id } });
}

export async function getExpenses() {
  return prisma.platformExpense.findMany({ orderBy: { createdAt: 'desc' } });
}

// ── Tenant detail (full) ──────────────────────────────────────────────────────
export async function getTenantDetail(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, email: true, plan: true, companyName: true,
      phone: true, vatNumber: true, addressCity: true, addressCountry: true,
      creditsTotal: true, creditsUsed: true, isAdmin: true,
      paymentStatus: true, monthlyRecurringRevenue: true,
      createdAt: true, updatedAt: true,
      brandColor: true, logoUrl: true, domain: true,
      twoFactorEnabled: true,
      agents: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, model: true, isActive: true, whitelabelEnabled: true,
          skillHandoff: true, skillDataCollection: true, skillScheduling: true,
          skillFileUpload: true, skillHumorDetection: true,
          whatsappEnabled: true, webChatEnabled: true,
          totalConversations: true, totalMessages: true, createdAt: true,
          _count: { select: { conversations: true, orders: true } },
        },
      },
      _count: { select: { conversations: true, orders: true } },
    },
  });
  if (!tenant) return null;
  return {
    ...tenant,
    planPrice: PLAN_PRICE[tenant.plan] ?? 0,
    creditsAvailable: tenant.creditsTotal - tenant.creditsUsed,
    creditsUsedPercent: tenant.creditsTotal > 0
      ? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100) : 0,
  };
}

// ── Change tenant plan ────────────────────────────────────────────────────────
export async function changeTenantPlan(tenantId: string, plan: string, creditsOverride?: number) {
  const PLAN_CREDITS: Record<string, number> = {
    free: 3000, starter: 10000, pro: 30000, business: 60000, enterprise: 75000,
  };
  const newCredits = creditsOverride ?? PLAN_CREDITS[plan] ?? 3000;
  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan,
      creditsTotal: newCredits,
      creditsUsed: 0,
      creditsRefreshDate: new Date(),
    },
    select: { id: true, plan: true, creditsTotal: true },
  });
}
