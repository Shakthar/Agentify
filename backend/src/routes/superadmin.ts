import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import { ForbiddenError } from '../lib/errors.js';
import * as superadminService from '../services/superadmin.service.js';

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
  const expense = await superadminService.createExpense({
    category: String(category),
    description: String(description),
    amount: parseFloat(amount),
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

export default router;
