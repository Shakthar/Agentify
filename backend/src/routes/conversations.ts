import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as conversationsService from '../services/conversations.service.js';

const router = Router();
router.use(authenticate);

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// GET /api/conversations
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await conversationsService.listConversations(req.tenant!.id, {
    skip: parseInt(req.query.skip as string) || 0,
    take: parseInt(req.query.take as string) || 20,
    agentId: req.query.agentId as string | undefined,
  });
  res.json(result);
}));

// POST /api/conversations
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const conversation = await conversationsService.createConversation(req.tenant!.id, req.body);
  res.status(201).json(conversation);
}));

// GET /api/conversations/:id
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const conversation = await conversationsService.getConversation(req.tenant!.id, req.params.id);
  res.json(conversation);
}));

// POST /api/conversations/:id/messages
router.post('/:id/messages', chatLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Message content is required and must be ≤ 4000 chars');
  }
  const message = await conversationsService.sendMessage(req.tenant!.id, req.params.id, parsed.data.content);
  res.status(201).json(message);
}));

// PATCH /api/conversations/:id/close
router.patch('/:id/close', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const conversation = await conversationsService.closeConversation(req.tenant!.id, req.params.id);
  res.json(conversation);
}));

export default router;
