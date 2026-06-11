import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import { BadRequestError, ForbiddenError } from '../lib/errors.js';
import * as superadminService from '../services/superadmin.service.js';
import { getConfig, saveConfig } from '../lib/platformConfig.js';

const router = Router();
router.use(authenticate);

// Guard: superadmin only
router.use((req: AuthenticatedRequest, _res: Response, next: CallableFunction) => {
  if (!req.tenant?.isAdmin) throw new ForbiddenError('Superadmin only');
  next();
});

// GET /api/superadmin/dashboard
router.get('/dashboard', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await superadminService.getPlatformMetrics();
  res.json(data);
}));

// GET /api/superadmin/tenants
router.get('/tenants', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const tenants = await superadminService.getAllTenants();
  res.json({ tenants });
}));

// GET /api/superadmin/tenants/:id
router.get('/tenants/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const detail = await superadminService.getTenantDetail(req.params.id);
  if (!detail) { res.status(404).json({ error: 'Tenant não encontrado' }); return; }
  res.json(detail);
}));

// PATCH /api/superadmin/tenants/:id/plan
router.patch('/tenants/:id/plan', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { plan, creditsOverride } = req.body as { plan: string; creditsOverride?: number };
  const validPlans = ['free', 'starter', 'business', 'enterprise'];
  if (!plan || !validPlans.includes(plan)) {
    res.status(400).json({ error: `plan inválido. Valores aceites: ${validPlans.join(', ')}` });
    return;
  }
  const updated = await superadminService.changeTenantPlan(req.params.id, plan, creditsOverride);
  res.json(updated);
}));

// GET /api/superadmin/expenses
router.get('/expenses', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const expenses = await superadminService.getExpenses();
  res.json({ expenses });
}));

// POST /api/superadmin/expenses
router.post('/expenses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { category, description, amount, recurring, period } = req.body;
  if (!description || !amount || !category) {
    res.status(400).json({ error: 'category, description e amount são obrigatórios' });
    return;
  }
  const parsedAmount = parseFloat(amount);
  if (!isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000) {
    res.status(400).json({ error: 'amount deve ser um número positivo válido (máx 1 000 000)' });
    return;
  }
  const expense = await superadminService.createExpense({
    category: String(category),
    description: String(description),
    amount: parsedAmount,
    recurring: Boolean(recurring),
    period: String(period ?? 'monthly'),
  });
  res.status(201).json(expense);
}));

// DELETE /api/superadmin/expenses/:id
router.delete('/expenses/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await superadminService.deleteExpense(req.params.id);
  res.json({ ok: true });
}));

// ─── Pricing config ───────────────────────────────────────────────────────────

// GET /api/superadmin/config
router.get('/config', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(getConfig());
}));

// PATCH /api/superadmin/config
// SECURITY: validar o body antes de fazer deepMerge no estado em memória.
// Sem validação, um admin comprometido pode definir credits=999999999 no plano
// free e afectar todos os tenants existentes imediatamente (via syncToPlanLimits).
const featurePlanSchema = z.object({
  mode: z.enum(['disabled', 'addon', 'included']),
  price: z.number().min(0).max(10_000).optional(),
  creditsPerTx: z.number().int().min(0).max(100_000).optional(),
}).strict();

const configPatchSchema = z.object({
  plans: z.record(
    z.object({
      price:   z.number().min(0).max(100_000),
      credits: z.number().int().min(0).max(10_000_000),
      agents:  z.number().int().min(0).max(9999),
    }).strict()
  ).optional(),
  features: z.object({
    scheduling:     z.record(featurePlanSchema).optional(),
    fileUpload:     z.record(featurePlanSchema).optional(),
    humorDetection: z.record(featurePlanSchema).optional(),
    payments:       z.record(featurePlanSchema).optional(),
    whitelabel:     z.record(featurePlanSchema).optional(),
  }).optional(),
}).strict();

router.patch('/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = configPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Configuração inválida', parsed.error.flatten());
  }
  const updated = await saveConfig(parsed.data as Parameters<typeof saveConfig>[0]);
  res.json(updated);
}));

export default router;
