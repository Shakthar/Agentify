import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as agentsService from '../services/agents.service.js';

const router = Router();
router.use(authenticate);

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(10).max(10000),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(100).max(8000).optional().default(2000),
  skills: z.object({
    handoff: z.boolean().optional(),
    dataCollection: z.boolean().optional(),
    scheduling: z.boolean().optional(),
    fileUpload: z.boolean().optional(),
    humorDetection: z.boolean().optional(),
  }).optional(),
  whatsappEnabled: z.boolean().optional().default(false),
  whatsappNumber: z.string().max(40).optional(),
  whatsappToken: z.string().min(20).max(500).optional(),
  webChatEnabled: z.boolean().optional().default(true),
  whitelabelEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional().default(false),
  offHoursMessage: z.string().max(500).optional(),
  offHourStart: z.string().optional(),
  offHourEnd: z.string().optional(),
  // Skill toggles directos (usados pelo Skills tab)
  skillHandoff:        z.boolean().optional(),
  skillDataCollection: z.boolean().optional(),
  skillScheduling:     z.boolean().optional(),
  skillFileUpload:     z.boolean().optional(),
  skillHumorDetection: z.boolean().optional(),
  skillVendas:         z.boolean().optional(),
});

const updateAgentSchema = createAgentSchema.partial();

// GET /api/agents
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await agentsService.listAgents(req.tenant!.id, {
    skip: parseInt(req.query.skip as string) || 0,
    take: parseInt(req.query.take as string) || 10,
    search: req.query.search as string | undefined,
  });
  res.json(result);
}));

// POST /api/agents
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Validation failed', parsed.error.flatten());
  }
  const agent = await agentsService.createAgent(req.tenant!, parsed.data);
  res.status(201).json(agent);
}));

// GET /api/agents/:id
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const agent = await agentsService.getAgent(req.tenant!.id, req.params.id);
  res.json(agent);
}));

// PATCH /api/agents/:id
router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Validation failed', parsed.error.flatten());
  }
  const agent = await agentsService.updateAgent(req.tenant!, req.params.id, parsed.data);
  res.json(agent);
}));

// DELETE /api/agents/:id
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await agentsService.deleteAgent(req.tenant!.id, req.params.id);
  res.status(204).send();
}));

// PATCH /api/agents/:id/toggle
router.patch('/:id/toggle', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await agentsService.toggleAgent(req.tenant!.id, req.params.id);
  res.json(result);
}));

export default router;
