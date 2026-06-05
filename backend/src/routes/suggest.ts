import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as suggestService from '../services/suggest.service.js';

const router = Router();
router.use(authenticate);

const suggestSchema = z.object({
  businessDescription: z.string().min(20).max(2000),
  language: z.string().max(10).optional().default('pt'),
});

// POST /api/suggest/suggest
router.post('/suggest', authLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('businessDescription must be between 20 and 2000 characters');
  }
  const result = await suggestService.suggestAgent(parsed.data.businessDescription, parsed.data.language);
  res.json(result);
}));

export default router;
