import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as billingService from '../services/billing.service.js';

const router = Router();
router.use(authenticate);

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

export default router;
