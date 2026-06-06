/**
 * Serviço de pagamentos MB Way via Easypay (https://api.prod.easypay.pt)
 * Quando EASYPAY_ACCOUNT_ID e EASYPAY_API_KEY não estão configurados,
 * funciona em modo MOCK — cria a order na DB e retorna um ID fictício.
 */
import prisma from '../lib/prisma.js';

export interface MbwayChargeParams {
  tenantId: string;
  agentId: string;
  conversationId: string;
  buyerPhone: string;   // ex: 351912345678
  amount: number;       // euros, ex: 5.50
  description: string;  // resumo do pedido
  notifyPhone?: string; // WA do dono para notificar após pagamento
  extraCreditCost: number; // créditos a debitar (0 = gratuito para Business+)
}

export interface MbwayChargeResult {
  orderId: string;
  externalId: string | null;
  mock: boolean;
}

export async function createMbwayCharge(params: MbwayChargeParams): Promise<MbwayChargeResult> {
  const { tenantId, agentId, conversationId, buyerPhone, amount, description, notifyPhone, extraCreditCost } = params;

  const accountId = process.env.EASYPAY_ACCOUNT_ID;
  const apiKey    = process.env.EASYPAY_API_KEY;
  const isMock    = !accountId || !apiKey;

  let externalId: string | null = null;

  if (!isMock) {
    // ── Chamada real à API Easypay ─────────────────────────────────────
    try {
      const resp = await fetch('https://api.prod.easypay.pt/2.0/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          AccountId: accountId,
          ApiKey: apiKey,
        },
        body: JSON.stringify({
          type: ['single'],
          payment: {
            methods: ['mb_way'],
            type: 'sale',
            capture: {
              transaction_key: `${agentId.slice(-8)}_${Date.now()}`,
              descriptive: description.slice(0, 255),
            },
            value: Math.round(amount * 100) / 100,
            mb_way: { phone: buyerPhone },
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Easypay error ${resp.status}: ${err.slice(0, 200)}`);
      }

      const data = await resp.json() as { id?: string };
      externalId = data.id ?? null;
      console.log(`[Payments] MB Way criado: externalId=${externalId}`);
    } catch (err) {
      console.error('[Payments] Falha ao criar MB Way no Easypay:', err);
      throw err;
    }
  } else {
    console.warn('[Payments] MOCK: EASYPAY_ACCOUNT_ID/EASYPAY_API_KEY não configurados — a simular MB Way');
    externalId = `mock_${Date.now()}`;
  }

  // Guardar order na DB
  const order = await prisma.order.create({
    data: {
      tenantId,
      agentId,
      conversationId,
      externalId,
      buyerPhone,
      amount,
      description,
      notifyPhone: notifyPhone ?? null,
      status: 'pending',
    },
  });

  // Debitar créditos extra do plano (skill de pagamentos)
  if (extraCreditCost > 0) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { creditsUsed: { increment: extraCreditCost } },
    });
    await prisma.creditLog.create({
      data: {
        tenantId,
        amount: -extraCreditCost,
        reason: 'payment-skill',
        details: { orderId: order.id, agentId, buyerPhone, mbwayAmount: amount },
      },
    });
    console.log(`[Payments] Débito de ${extraCreditCost} créditos (skill MB Way) para tenant ${tenantId}`);
  }

  return { orderId: order.id, externalId, mock: isMock };
}

/** Confirma pagamento de uma order (chamado pelo webhook Easypay ou endpoint de teste) */
export async function confirmPayment(
  externalId: string,
): Promise<{ order: { id: string; buyerPhone: string; notifyPhone: string | null; amount: number; description: string; agentId: string; tenantId: string } | null }> {
  const order = await prisma.order.findFirst({
    where: { externalId, status: 'pending' },
    select: { id: true, buyerPhone: true, notifyPhone: true, amount: true, description: true, agentId: true, tenantId: true },
  });

  if (!order) return { order: null };

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'paid', paidAt: new Date() },
  });

  return { order };
}

/** Confirma pagamento pelo orderId interno (para endpoint de teste) */
export async function confirmPaymentById(
  orderId: string,
): Promise<{ order: { id: string; buyerPhone: string; notifyPhone: string | null; amount: number; description: string; agentId: string; tenantId: string } | null }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, status: 'pending' },
    select: { id: true, buyerPhone: true, notifyPhone: true, amount: true, description: true, agentId: true, tenantId: true },
  });

  if (!order) return { order: null };

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'paid', paidAt: new Date() },
  });

  return { order };
}
