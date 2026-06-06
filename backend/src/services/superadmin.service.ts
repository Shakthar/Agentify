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
  ] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.agent.count(),
    prisma.agent.count({ where: { isActive: true } }),
    prisma.conversation.count(),
    prisma.conversation.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.message.count(),
    prisma.tenant.groupBy({ by: ['plan'], _count: { id: true }, where: { deletedAt: null } }),
    prisma.platformExpense.findMany({ orderBy: { createdAt: 'desc' } }),
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
