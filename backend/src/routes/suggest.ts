import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, suggestLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as suggestService from '../services/suggest.service.js';

const router = Router();
router.use(authenticate);

const suggestSchema = z.object({
  businessDescription: z.string().min(20).max(2000),
  language: z.string().max(10).optional().default('pt'),
  templateSystemPrompt: z.string().max(3000).optional(),
});

// POST /api/suggest/suggest
// Usa suggestLimiter (por tenant, 10/hora) para prevenir Denial-of-Wallet:
// cada chamada dispara claude-sonnet (modelo caro) e o custo é do operador.
router.post('/suggest', authLimiter, suggestLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('businessDescription must be between 20 and 2000 characters');
  }
  const result = await suggestService.suggestAgent(
    req.tenant!.id,
    parsed.data.businessDescription,
    parsed.data.language,
    parsed.data.templateSystemPrompt,
  );
  res.json(result);
}));

export default router;
