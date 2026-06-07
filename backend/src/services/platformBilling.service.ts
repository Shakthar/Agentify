/**
 * Serviço de billing da plataforma (subscriptions dos tenants).
 * Modo MOCK: sem STRIPE_SECRET_KEY ou IFTHENPAY_ACCOUNT_ID configurados,
 * gera referências fictícias para teste. Confirmar com test-confirm endpoint.
 *
 * Fluxo:
 *  1. createSubscriptionInvoice()  → cria PlatformInvoice + instruções de pagamento
 *  2. confirmPayment()             → marca pago, actualiza tenant.plan + expiry
 *  3. suspendExpired()             → cron: suspende tenants com expiry há +3 dias
 */
import prisma from '../lib/prisma.js';
import { getConfig } from '../lib/platformConfig.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type PaymentMethod = 'stripe' | 'ifthenpay_mbway' | 'ifthenpay_multibanco' | 'manual';

export interface CreateInvoiceParams {
  tenantId: string;
  plan: string;
  method: PaymentMethod;
  phone?: string;  // obrigatório para ifthenpay_mbway
}

export interface PaymentInstructions {
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  plan: string;
  mock: boolean;
  // Stripe
  checkoutUrl?: string;
  // MB Way
  mbwayPhone?: string;
  mbwayReference?: string;
  // Multibanco
  multibancoEntity?: string;
  multibancoReference?: string;
  multibancoExpiry?: string;
  // Genérico
  notes?: string;
}

// ─── Create invoice ───────────────────────────────────────────────────────────
export async function createSubscriptionInvoice(params: CreateInvoiceParams): Promise<PaymentInstructions> {
  const { tenantId, plan, method, phone } = params;
  const cfg = getConfig();
  const amount = cfg.plans[plan]?.price ?? 0;

  if (amount === 0) {
    // Plano Free — não precisa de pagamento
    return applyFreeUpgrade(tenantId, plan);
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  // Cancelar invoices pendentes anteriores do mesmo tenant
  await prisma.platformInvoice.updateMany({
    where: { tenantId, status: 'pending' },
    data: { status: 'cancelled' },
  });

  let reference: string | null = null;
  let entity: string | null = null;
  let externalId: string | null = null;
  let checkoutUrl: string | undefined;
  const isMock = isTestMode(method);

  if (method === 'stripe') {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      // TODO: produção — criar Stripe Checkout Session
      externalId = `stripe_sess_pending`;
      checkoutUrl = `https://checkout.stripe.com/mock`; // substituir por sessão real
    } else {
      externalId = `mock_stripe_${Date.now()}`;
      checkoutUrl = undefined;
    }
  } else if (method === 'ifthenpay_mbway') {
    if (!phone) throw new Error('Número de telemóvel obrigatório para MB Way');
    reference = isMock ? `MBWAY-MOCK-${Math.floor(10000 + Math.random() * 90000)}` : await callIfthenpayMbway(phone, amount);
  } else if (method === 'ifthenpay_multibanco') {
    entity = '11249'; // entidade Ifthenpay real
    reference = isMock ? generateFakeMultibancoRef() : await callIfthenpayMultibanco(amount);
  }

  const invoice = await prisma.platformInvoice.create({
    data: {
      tenantId,
      plan,
      amount,
      method,
      status: 'pending',
      reference,
      entity,
      externalId,
      periodStart: now,
      periodEnd,
      notes: isMock ? 'MODO TESTE — confirmar com /api/billing/test-confirm/:id' : undefined,
    },
  });

  // Actualizar subscriptionStatus para pending_payment
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: 'pending_payment', subscriptionMethod: method },
  });

  const multibancoExpiry = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('pt-PT');

  return {
    invoiceId: invoice.id,
    method,
    amount,
    plan,
    mock: isMock,
    checkoutUrl,
    mbwayPhone: method === 'ifthenpay_mbway' ? phone : undefined,
    mbwayReference: method === 'ifthenpay_mbway' ? (reference ?? undefined) : undefined,
    multibancoEntity: entity ?? undefined,
    multibancoReference: method === 'ifthenpay_multibanco' ? (reference ?? undefined) : undefined,
    multibancoExpiry: method === 'ifthenpay_multibanco' ? multibancoExpiry : undefined,
    notes: isMock ? `[TESTE] Confirmar pagamento: POST /api/billing/test-confirm/${invoice.id}` : undefined,
  };
}

// ─── Confirm payment (usado pelo webhook ou superadmin test) ──────────────────
export async function confirmPlatformPayment(invoiceId: string): Promise<{ ok: boolean; plan: string; expiresAt: Date }> {
  const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error('Invoice não encontrada');
  if (invoice.status === 'paid') throw new Error('Invoice já paga');
  if (invoice.status === 'cancelled' || invoice.status === 'expired') throw new Error('Invoice inválida');

  const cfg = getConfig();
  const newCredits = cfg.plans[invoice.plan]?.credits ?? 0;

  const now = new Date();
  const expiresAt = new Date(invoice.periodEnd);

  await prisma.$transaction([
    prisma.platformInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: now },
    }),
    prisma.tenant.update({
      where: { id: invoice.tenantId },
      data: {
        plan: invoice.plan,
        subscriptionStatus: 'active',
        subscriptionMethod: invoice.method as string,
        subscriptionExpiresAt: expiresAt,
        creditsTotal: newCredits,
        creditsUsed: 0,
        creditsRefreshDate: now,
        paymentStatus: 'active',
      },
    }),
    prisma.creditLog.create({
      data: {
        tenantId: invoice.tenantId,
        amount: newCredits,
        reason: 'subscription-renewed',
        details: { plan: invoice.plan, invoiceId, method: invoice.method },
      },
    }),
  ]);

  return { ok: true, plan: invoice.plan, expiresAt };
}

// ─── Get invoices for tenant ──────────────────────────────────────────────────
export async function getPlatformInvoices(tenantId: string) {
  return prisma.platformInvoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, plan: true, amount: true, method: true, status: true,
      reference: true, entity: true, periodStart: true, periodEnd: true,
      paidAt: true, createdAt: true, notes: true,
    },
  });
}

// ─── Suspend expired subscriptions (cron) ────────────────────────────────────
export async function suspendExpired(): Promise<number> {
  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() - 3); // 3 dias de graça

  const result = await prisma.tenant.updateMany({
    where: {
      subscriptionStatus: 'active',
      subscriptionExpiresAt: { lt: graceEnd },
      plan: { not: 'free' },
    },
    data: { subscriptionStatus: 'suspended' },
  });

  if (result.count > 0) {
    console.log(`[Billing] ${result.count} tenants suspensos por falta de pagamento`);
  }
  return result.count;
}

// ─── Free plan upgrade (no payment needed) ───────────────────────────────────
async function applyFreeUpgrade(tenantId: string, plan: string): Promise<PaymentInstructions> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { plan, subscriptionStatus: 'active', subscriptionMethod: 'manual', subscriptionExpiresAt: null },
  });
  // Fake invoice for record-keeping
  const inv = await prisma.platformInvoice.create({
    data: {
      tenantId, plan, amount: 0, method: 'manual', status: 'paid',
      periodStart: new Date(), periodEnd: new Date(Date.now() + 36500 * 86400000), // 100 anos
      paidAt: new Date(), notes: 'Plano gratuito',
    },
  });
  return { invoiceId: inv.id, method: 'manual', amount: 0, plan, mock: false, notes: 'Plano Free activado' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isTestMode(method: PaymentMethod): boolean {
  if (method === 'stripe') return !process.env.STRIPE_SECRET_KEY;
  if (method === 'ifthenpay_mbway' || method === 'ifthenpay_multibanco') {
    return !process.env.IFTHENPAY_ACCOUNT_ID || !process.env.IFTHENPAY_API_KEY;
  }
  return true;
}

function generateFakeMultibancoRef(): string {
  const r = () => Math.floor(100 + Math.random() * 900).toString();
  return `${r()}-${r()}-${r()}`;
}

async function callIfthenpayMbway(phone: string, amount: number): Promise<string> {
  // TODO: chamada real à API Ifthenpay MB Way
  // POST https://ifthenpay.com/api/spg/payment/mbway
  console.log(`[Billing] Ifthenpay MB Way real: ${phone} €${amount}`);
  return `MBWAY-REAL-${Date.now()}`;
}

async function callIfthenpayMultibanco(amount: number): Promise<string> {
  // TODO: chamada real à API Ifthenpay Multibanco
  console.log(`[Billing] Ifthenpay Multibanco real: €${amount}`);
  return generateFakeMultibancoRef();
}
