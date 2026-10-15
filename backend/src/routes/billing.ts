import { Router, Response, Request } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as billingService from '../services/billing.service.js';
import { getConfig } from '../lib/platformConfig.js';
import {
  METHODS_BY_CURRENCY,
  createSubscriptionInvoice,
  confirmPlatformPayment,
  getPlatformInvoices,
  suspendExpired,
  type PaymentMethod,
} from '../services/platformBilling.service.js';

const router = Router();
router.use(authenticate);

// ─── Usage / credits ──────────────────────────────────────────────────────────

// GET /api/billing/credits
router.get('/credits', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await billingService.getCredits(req.tenant!.id);
  res.json(result);
}));

// GET /api/billing/usage-by-agent
router.get('/usage-by-agent', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await billingService.getUsageByAgent(req.tenant!.id);
  res.json(result);
}));

// GET /api/billing/pricing — tabela de planos, pacotes extra e add-ons (EUR + BRL)
router.get('/pricing', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { plans, topUp, features } = getConfig();
  res.json({
    plans, topUp, features,
    methodsByCurrency: METHODS_BY_CURRENCY,
    tenantCurrency: req.tenant!.billingCurrency === 'BRL' ? 'BRL' : 'EUR',
  });
}));

// ─── Platform subscriptions ───────────────────────────────────────────────────

/**
 * POST /api/billing/platform-subscribe
 * Body: { plan, method, phone?, currency? ('EUR' | 'BRL') }
 * Cria invoice + instrucções de pagamento (modo mock se sem credenciais reais)
 */
router.post('/platform-subscribe', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { plan, method, phone, currency: rawCurrency } = req.body as { plan: string; method: PaymentMethod; phone?: string; currency?: string };
  const currency = rawCurrency === 'BRL' ? 'BRL' : 'EUR';

  if (!plan || !method) {
    res.status(400).json({ error: 'plan e method são obrigatórios' });
    return;
  }
  // SECURITY: Validar plano contra lista fechada.
  // Sem esta validação, um nome de plano arbitrário passa por `applyFreeUpgrade`
  // (price = 0 para planos inexistentes) e seta tenant.plan a um valor inválido,
  // causando TypeErrors em ALLOWED_MODELS[plan] e corrompendo a conta.
  const validPlans = ['free', 'starter', 'business', 'enterprise'];
  if (!validPlans.includes(plan)) {
    res.status(400).json({ error: `Plano inválido. Valores aceites: ${validPlans.join(', ')}` });
    return;
  }
  if (!METHODS_BY_CURRENCY[currency].includes(method)) {
    res.status(400).json({ error: `method inválido para ${currency}` });
    return;
  }
  if (method === 'ifthenpay_mbway' && !phone) {
    res.status(400).json({ error: 'phone obrigatório para MB Way' });
    return;
  }

  const instructions = await createSubscriptionInvoice({
    tenantId: req.tenant!.id, plan, method, phone, currency,
  });
  res.json(instructions);
}));

/**
 * POST /api/billing/platform-renew
 * Renova plano actual com mesmo método.
 * Body: { phone? }  (só se method for mbway)
 */
router.post('/platform-renew', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenant = req.tenant!;
  const plan = tenant.plan;
  const method = (tenant.subscriptionMethod ?? 'manual') as PaymentMethod;
  const { phone } = req.body as { phone?: string };

  const currency = tenant.billingCurrency === 'BRL' ? 'BRL' : 'EUR';
  const instructions = await createSubscriptionInvoice({
    tenantId: tenant.id, plan, method, phone, currency,
  });
  res.json(instructions);
}));

/**
 * GET /api/billing/platform-invoices
 * Lista faturas da plataforma do tenant autenticado
 */
router.get('/platform-invoices', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const invoices = await getPlatformInvoices(req.tenant!.id);
  res.json({ invoices });
}));

/**
 * POST /api/billing/test-confirm/:invoiceId
 * Superadmin confirma pagamento (apenas modo teste / desenvolvimento)
 */
router.post(
  '/test-confirm/:invoiceId',
  requireSuperAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { invoiceId } = req.params;
    const result = await confirmPlatformPayment(invoiceId);
    res.json({ confirmed: true, ...result });
  }),
);

/**
 * POST /api/billing/suspend-expired
 * Cron job: suspende tenants com subscrição expirada há +3 dias
 * Apenas superadmin ou chamada interna
 */
router.post(
  '/suspend-expired',
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const count = await suspendExpired();
    res.json({ suspended: count });
  }),
);

export default router;
