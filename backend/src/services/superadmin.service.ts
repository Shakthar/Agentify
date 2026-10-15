import prisma from '../lib/prisma.js';
import { planTerms, toEur } from '../lib/platformConfig.js';

/** Preço mensal do plano convertido para EUR (para MRR e listagens). */
function planPriceEur(plan: string, currency: string | null | undefined): number {
  const { price, currency: cur } = planTerms(plan, currency ?? 'EUR');
  return Math.round(toEur(price, cur) * 100) / 100;
}

// ── Platform-wide dashboard ──────────────────────────────────────────────────
export async function getPlatformMetrics() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [
    totalTenants,
    totalAgents,
    activeAgents,
    totalConversations,
    todayConversations,
    thisMonthConversations,
    thisYearConversations,
    totalMessages,
    tenantsByPlan,
    expenses,
    creditLogs,
    addonWhatsapp,
    addonWhitelabel,
    addonHumorDetection,
    addonScheduling,
    addonFileUpload,
    addonHandoff,
  ] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.agent.count(),
    prisma.agent.count({ where: { isActive: true } }),
    prisma.conversation.count(),
    prisma.conversation.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.conversation.count({ where: { createdAt: { gte: yearStart } } }),
    prisma.message.count(),
    prisma.tenant.groupBy({ by: ['plan', 'billingCurrency'], _count: { id: true }, where: { deletedAt: null } }),
    prisma.platformExpense.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.creditLog.findMany({
      where: { reason: 'chat' },
      select: { amount: true, details: true },
    }),
    prisma.agent.count({ where: { whatsappEnabled: true } }),
    prisma.agent.count({ where: { whitelabelEnabled: true } }),
    prisma.agent.count({ where: { skillHumorDetection: true } }),
    prisma.agent.count({ where: { skillScheduling: true } }),
    prisma.agent.count({ where: { skillFileUpload: true } }),
    prisma.agent.count({ where: { skillHandoff: true } }),
  ]);

  // Revenue
  const planBreakdown: Record<string, number> = {};
  const revenueByPlan: Record<string, number> = {}; // € / mês (BRL convertido)
  let mrr = 0;
  for (const row of tenantsByPlan) {
    const price = planPriceEur(row.plan, row.billingCurrency);
    planBreakdown[row.plan] = (planBreakdown[row.plan] ?? 0) + row._count.id;
    mrr += price * row._count.id;
    revenueByPlan[row.plan] = (revenueByPlan[row.plan] ?? 0) + price * row._count.id;
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

  const totalAgentsForPct = totalAgents || 1;

  return {
    tenants: { total: totalTenants, byPlan: planBreakdown },
    agents:  { total: totalAgents, active: activeAgents },
    conversations: {
      total: totalConversations,
      today: todayConversations,
      thisMonth: thisMonthConversations,
      thisYear: thisYearConversations,
    },
    messages: { total: totalMessages },
    revenue: { mrr, arr: mrr * 12, byPlan: revenueByPlan },
    expenses: {
      monthly: totalExpenses,
      items: expenses,
    },
    usage: {
      creditsConsumed: totalCreditsConsumed,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      realApiCostEur: Math.round(realApiCostEur * 100) / 100,
    },
    balance: mrr - totalExpenses,
    addons: [
      { key: 'whatsapp',       label: 'WhatsApp ativo',       count: addonWhatsapp,       pct: Math.round((addonWhatsapp / totalAgentsForPct) * 100) },
      { key: 'whitelabel',     label: 'White-label',          count: addonWhitelabel,     pct: Math.round((addonWhitelabel / totalAgentsForPct) * 100) },
      { key: 'humorDetection', label: 'Detecao de Humor',     count: addonHumorDetection, pct: Math.round((addonHumorDetection / totalAgentsForPct) * 100) },
      { key: 'scheduling',     label: 'Agendamento',          count: addonScheduling,     pct: Math.round((addonScheduling / totalAgentsForPct) * 100) },
      { key: 'fileUpload',     label: 'Upload de Ficheiros',  count: addonFileUpload,     pct: Math.round((addonFileUpload / totalAgentsForPct) * 100) },
      { key: 'handoff',        label: 'Handoff para Humano',  count: addonHandoff,        pct: Math.round((addonHandoff / totalAgentsForPct) * 100) },
    ],
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
      paymentStatus: true, isAdmin: true, billingCurrency: true,
      _count: { select: { agents: true, conversations: true } },
    },
  });

  return tenants.map((t) => ({
    ...t,
    planPrice: planPriceEur(t.plan, t.billingCurrency),
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
      paymentStatus: true, monthlyRecurringRevenue: true, billingCurrency: true,
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
    planPrice: planPriceEur(tenant.plan, tenant.billingCurrency),
    creditsAvailable: tenant.creditsTotal - tenant.creditsUsed,
    creditsUsedPercent: tenant.creditsTotal > 0
      ? Math.round((tenant.creditsUsed / tenant.creditsTotal) * 100) : 0,
  };
}

// ── Change tenant plan ────────────────────────────────────────────────────────
export async function changeTenantPlan(tenantId: string, plan: string, creditsOverride?: number) {
  const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { billingCurrency: true } });
  const newCredits = creditsOverride ?? planTerms(plan, current?.billingCurrency ?? 'EUR').credits;
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
