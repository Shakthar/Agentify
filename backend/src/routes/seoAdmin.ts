import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import { ForbiddenError } from '../lib/errors.js';
import { getSeoOverview } from '../services/seoAnalytics.service.js';
import { getSeoHealth } from '../services/seoHealth.service.js';

const router = Router();
router.use(authenticate);
// Mesmo guard que routes/superadmin.ts
router.use((req: AuthenticatedRequest, _res: Response, next: CallableFunction) => {
  if (!req.tenant?.isAdmin) throw new ForbiddenError('Superadmin only');
  next();
});

// GET /api/admin/seo/overview?days=7|30|90
router.get('/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const d = parseInt(req.query.days as string, 10);
  const days = d === 30 || d === 90 ? d : 7;
  res.json(await getSeoOverview(days));
}));

// GET /api/admin/seo/health
router.get('/health', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(await getSeoHealth());
}));

export default router;
