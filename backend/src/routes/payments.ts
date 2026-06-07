/**
 * Rotas de pagamentos:
 *  POST /api/payments/webhook        — Easypay notifica pagamento confirmado
 *  POST /api/payments/test-paid/:id  — Simula pagamento confirmado (para testes)
 *  GET  /api/payments/orders         — Lista orders do tenant (autenticado)
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { webhookLimiter } from '../middleware/rateLimit.js';
import { confirmPayment, confirmPaymentById } from '../services/payments.service.js';
import { sendWhatsAppText } from '../lib/whatsapp.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ─── POST /api/payments/webhook ───────────────────────────────────────────────
// Easypay envia este webhook quando o pagamento é confirmado
// SECURITY: verifica Bearer token da Easypay (configurado no dashboard Easypay)
router.post('/webhook', webhookLimiter, asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
  const easypaySecret = process.env.EASYPAY_WEBHOOK_SECRET;

  if (easypaySecret) {
    // Produção: verificar Bearer token com comparação em tempo constante
    const authHeader = req.headers.authorization;
    const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(easypaySecret))) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    // SECURITY: Em produção sem secret configurado → rejeitar sempre.
    // Nunca processar webhooks não autenticados em produção.
    console.error('[Payments] CRITICAL: EASYPAY_WEBHOOK_SECRET não configurado em produção — webhook rejeitado');
    res.status(503).json({ error: 'Webhook not configured' });
    return;
  } else {
    // Desenvolvimento/teste: aceitar sem auth mas avisar
    console.warn('[Payments] DEV: EASYPAY_WEBHOOK_SECRET não configurado — a aceitar webhook sem autenticação (apenas dev)');
  }

  // Responder imediatamente para não re-tentar
  res.status(200).json({ status: 'ok' });

  const body = req.body as { type?: string; data?: { id?: string } };

  // Apenas processar eventos de captura confirmada
  if (body.type !== 'payment:capture' && body.type !== 'capture:success') return;

  const externalId = body.data?.id;
  if (!externalId || typeof externalId !== 'string') {
    console.warn('[Payments] Webhook sem data.id:', JSON.stringify(body).slice(0, 200));
    return;
  }
  // SECURITY: Limit externalId length before DB lookup to prevent oversized string attacks
  if (externalId.length > 200) {
    console.warn('[Payments] Webhook data.id demasiado longo, ignorado');
    return;
  }

  await handlePaymentConfirmed(externalId);
}));

// ─── POST /api/payments/test-paid/:id ─────────────────────────────────────────
// Simula pagamento confirmado (SUPERADMIN ONLY — nunca expor em produção)
router.post('/test-paid/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.isAdmin) {
    res.status(403).json({ error: 'Superadmin only' });
    return;
  }
  const { id } = req.params;
  const { order } = await confirmPaymentById(id);

  if (!order) {
    res.status(404).json({ error: 'Order não encontrada ou já paga' });
    return;
  }

  await notifyAfterPayment(order);
  res.json({ success: true, message: 'Pagamento simulado — notificações enviadas', orderId: order.id });
}));

// ─── GET /api/payments/orders ─────────────────────────────────────────────────
// Lista orders do tenant autenticado
router.get('/orders', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, agentId, skip = '0', take = '20' } = req.query as Record<string, string>;

  // SECURITY: Validate status against allowed values to prevent unexpected filter injection
  const ALLOWED_STATUSES = ['pending', 'paid', 'processing', 'done', 'failed', 'expired'];
  if (status && !ALLOWED_STATUSES.includes(status)) {
    res.status(400).json({ error: `status inválido. Valores aceites: ${ALLOWED_STATUSES.join(', ')}` });
    return;
  }

  const orders = await prisma.order.findMany({
    where: {
      tenantId: req.tenant!.id,
      ...(status ? { status } : {}),
      ...(agentId ? { agentId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    skip: parseInt(skip),
    take: Math.min(parseInt(take), 100),
    select: {
      id: true,
      agentId: true,
      buyerPhone: true,
      amount: true,
      description: true,
      status: true,
      notifyPhone: true,
      createdAt: true,
      paidAt: true,
      externalId: true,
    },
  });

  const total = await prisma.order.count({ where: { tenantId: req.tenant!.id, ...(status ? { status } : {}), ...(agentId ? { agentId } : {}) } });

  res.json({ orders, total });
}));

// ─── PATCH /api/payments/orders/:id/status ────────────────────────────────────
// Move o estado do pedido na fila KDS: paid → processing → done
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  paid:       ['processing'],
  processing: ['done', 'paid'], // permite regredir
};

router.patch('/orders/:id/status', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status: newStatus } = req.body as { status: string };

  if (!newStatus) {
    res.status(400).json({ error: 'status é obrigatório' });
    return;
  }

  const order = await prisma.order.findFirst({
    where: { id, tenantId: req.tenant!.id },
    select: { id: true, status: true, agentId: true },
  });

  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' });
    return;
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    res.status(400).json({ error: `Transição inválida: ${order.status} → ${newStatus}` });
    return;
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, status: true, agentId: true, description: true, amount: true, buyerPhone: true, createdAt: true, paidAt: true },
  });

  res.json(updated);
}));

// ─── GET /api/payments/orders/public/:orderId ─────────────────────────────────
// Pública (sem auth): cliente acompanha o estado do seu pedido via link
router.get('/orders/public/:orderId', asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, description: true, amount: true, status: true,
      createdAt: true, paidAt: true,
      agent: { select: { name: true } },
    },
  });

  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado' });
    return;
  }

  // Não expõe dados sensíveis (buyerPhone, tenantId, etc.)
  res.json({
    id: order.id,
    description: order.description,
    amount: order.amount,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    agentName: order.agent?.name ?? null,
  });
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function handlePaymentConfirmed(externalId: string): Promise<void> {
  const { order } = await confirmPayment(externalId);
  if (!order) {
    console.warn(`[Payments] Order com externalId="${externalId}" não encontrada ou já confirmada`);
    return;
  }
  await notifyAfterPayment(order);
}

async function notifyAfterPayment(order: {
  id: string;
  buyerPhone: string;
  notifyPhone: string | null;
  amount: number;
  description: string;
  agentId: string;
  tenantId: string;
}): Promise<void> {
  // Buscar o phone_number_id e token do agente para enviar WA
  const agent = await prisma.agent.findFirst({
    where: { id: order.agentId },
    select: { whatsappNumber: true, whatsappToken: true, name: true, tenant: { select: { encryptionKey: true } } },
  });

  if (!agent?.whatsappNumber) {
    console.warn(`[Payments] Agente ${order.agentId} sem whatsappNumber — notificações não enviadas`);
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = agent.whatsappNumber;
  const amountFmt = order.amount.toFixed(2).replace('.', ',');

  // 1. Notificar o cliente (comprador)
  const clientMsg = `✅ *Pagamento confirmado!*\n\n📋 Pedido: ${order.description}\n💶 Valor: €${amountFmt}\n\nObrigado! O seu pedido está confirmado e a ser processado. 🎉`;
  await sendWhatsAppText(phoneId, order.buyerPhone, clientMsg, token);
  console.log(`[Payments] Confirmação enviada ao cliente ${order.buyerPhone}`);

  // 2. Notificar o dono do negócio (se configurado)
  if (order.notifyPhone) {
    const ownerMsg = `🛒 *Novo pedido pago!*\n\n📋 ${order.description}\n💶 €${amountFmt}\n📱 Cliente: +${order.buyerPhone}\n🆔 Pedido: ${order.id.slice(-8)}`;
    await sendWhatsAppText(phoneId, order.notifyPhone, ownerMsg, token);
    console.log(`[Payments] Notificação enviada ao dono ${order.notifyPhone}`);
  }
}

export default router;
