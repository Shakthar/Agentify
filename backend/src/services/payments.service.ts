/**
 * Serviço de pagamentos MB Way via Easypay (https://api.prod.easypay.pt)
 * Quando EASYPAY_ACCOUNT_ID e EASYPAY_API_KEY não estão configurados,
 * funciona em modo MOCK — cria a order na DB e retorna um ID fictício.
 * Em modo MOCK, o pagamento é auto-confirmado após 5s (simula aprovação MB Way).
 */
import prisma from '../lib/prisma.js';
import { sendWhatsAppText } from '../lib/whatsapp.js';

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

// Limites de segurança para transacções MB Way
const MIN_MBWAY_AMOUNT = 0.50;  // €0.50 mínimo (Easypay rejeita abaixo disto)
const MAX_MBWAY_AMOUNT = 10000; // €10,000 máximo por transação

export async function createMbwayCharge(params: MbwayChargeParams): Promise<MbwayChargeResult> {
  const { tenantId, agentId, conversationId, buyerPhone, amount, description, notifyPhone, extraCreditCost } = params;

  // SECURITY: Validar limites de valor — rejeitar antes de chamar Easypay
  if (!Number.isFinite(amount) || amount < MIN_MBWAY_AMOUNT || amount > MAX_MBWAY_AMOUNT) {
    throw new Error(`Valor inválido: €${amount}. Deve estar entre €${MIN_MBWAY_AMOUNT} e €${MAX_MBWAY_AMOUNT}`);
  }

  // SECURITY: Verificar créditos disponíveis antes de prosseguir (evita créditos negativos)
  if (extraCreditCost > 0) {
    const tenantCredits = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { creditsTotal: true, creditsUsed: true },
    });
    if (!tenantCredits) throw new Error('Tenant não encontrado');
    const available = tenantCredits.creditsTotal - tenantCredits.creditsUsed;
    if (available < extraCreditCost) {
      throw new Error(`Créditos insuficientes: disponíveis=${available}, necessários=${extraCreditCost}`);
    }
  }

  const accountId = process.env.EASYPAY_ACCOUNT_ID;
  const apiKey    = process.env.EASYPAY_API_KEY;
  const isMock    = !accountId || !apiKey;

  // Em modo MOCK sem credenciais Easypay: aceitar em qualquer NODE_ENV (demo/teste).
  // Log de aviso para que o operador saiba que pagamentos são simulados.
  if (isMock) {
    console.warn('[Payments] MOCK: EASYPAY_ACCOUNT_ID/EASYPAY_API_KEY não configurados — a simular MB Way (sem cobrança real)');
  }

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

  // Em modo MOCK: auto-confirmar após 5s (simula cliente a aceitar no MB Way)
  if (isMock) {
    mockAutoConfirm(order.id, agentId).catch(err =>
      console.error('[Payments] mockAutoConfirm error:', err),
    );
  }

  return { orderId: order.id, externalId, mock: isMock };
}

/**
 * Em modo MOCK, agenda auto-confirmação do pedido após 5s.
 * Simula a aprovação MB Way pelo cliente.
 * Apenas notifica o CLIENTE via WA — o KDS/painel de pedidos é o canal do dono.
 */
async function mockAutoConfirm(orderId: string, agentId: string): Promise<void> {
  await new Promise(r => setTimeout(r, 5000));

  const order = await prisma.order.findFirst({
    where: { id: orderId, status: 'pending' },
    select: { id: true, buyerPhone: true, amount: true, description: true, agentId: true },
  });
  if (!order) return; // já confirmado ou cancelado

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid', paidAt: new Date() },
  });
  console.log(`[Payments] MOCK auto-confirmado: orderId=${orderId}`);

  // Notifica apenas o CLIENTE (o dono acompanha pelo KDS/painel de pedidos)
  const agent = await prisma.agent.findFirst({
    where: { id: agentId },
    select: { whatsappNumber: true },
  });
  if (!agent?.whatsappNumber) return;

  const amt = order.amount.toFixed(2).replace('.', ',');
  await sendWhatsAppText(
    agent.whatsappNumber,
    order.buyerPhone,
    `✅ *Pagamento confirmado!*\n\n📋 Pedido: ${order.description}\n💶 Valor: €${amt}\n\nO teu pedido está confirmado e a ser preparado! 🎉`,
    process.env.WHATSAPP_TOKEN,
  ).catch(err => console.warn('[Payments] MOCK notify cliente falhou:', err));
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
