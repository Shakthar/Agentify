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
  testMode:            z.boolean().optional(),
  languageMode:        z.string().optional(),
  ratingEnabled:       z.boolean().optional(),
  proactiveEnabled:    z.boolean().optional(),
  proactiveMaxPerDay:  z.number().int().min(1).max(500).optional(),
  proactiveMonthBudget: z.number().int().min(1).max(5000).optional(),
  followUpEnabled:     z.boolean().optional(),
  followUpHours:       z.number().int().min(1).max(168).optional(),
  followUpMessage:     z.string().max(1000).optional(),
  alertEmail:          z.string().email().optional().or(z.literal('')),
  alertHandoffThreshold:    z.number().int().min(1).optional(),
  alertResolutionThreshold: z.number().int().min(1).max(100).optional(),
  alertWeeklyReport:   z.boolean().optional(),
  crmEnabled:          z.boolean().optional(),
  instagramEnabled:    z.boolean().optional(),
  instagramAccountId:  z.string().optional(),
  instagramToken:      z.string().min(20).max(500).optional(),
  calendarEnabled:     z.boolean().optional(),
  calendarId:          z.string().optional(),
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

// GET /api/agents/:id/export-csv
router.get('/:id/export-csv', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prismaD = await import('../lib/prisma.js');
  const conversations = await prismaD.default.conversation.findMany({
    where: { agentId: req.params.id, tenantId: req.tenant!.id },
    include: { messages: { orderBy: { createdAt: 'asc' } as any } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const bom = '\xEF\xBB\xBF';
  const header = 'ID,Data,Canal,Visitante,Mensagens,Tokens,Resolvido,Avaliacao,Texto';
  const rows = conversations.map((c: any) => {
    const d = new Date(c.createdAt).toISOString().slice(0, 10);
    const name = (c.visitorName ?? c.visitorId ?? '').replace(/,/g, ' ');
    const txt = (c.ratingText ?? '').replace(/,/g, ' ').replace(/\n/g, ' ');
    return `${c.id},${d},${c.channelType},${name},${c._count?.messages ?? 0},${c.tokensUsed},${c.resolved ? 'sim' : 'nao'},${c.rating ?? ''},${txt}`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="conversas-${req.params.id}.csv"`);
  res.send(bom + [header, ...rows].join('\n'));
}));

// POST /api/agents/:id/conversations/:convId/rate
router.post('/:id/conversations/:convId/rate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { rating, ratingText } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new BadRequestError('Rating 1-5');
  const prismaD = await import('../lib/prisma.js');
  const conv = await prismaD.default.conversation.findFirst({ where: { id: req.params.convId, tenantId: req.tenant!.id } });
  if (!conv) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await prismaD.default.conversation.update({
    where: { id: req.params.convId },
    data: { rating: Number(rating), ratingText: ratingText ?? null } as any,
  });
  res.json(updated);
}));

// GET /api/agents/:id/observe
router.get('/:id/observe', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prismaD = await import('../lib/prisma.js');
  const open = await prismaD.default.conversation.findMany({
    where: { agentId: req.params.id, tenantId: req.tenant!.id, resolved: false },
    include: { messages: { orderBy: { createdAt: 'desc' } as any, take: 5 } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ conversations: open, agentId: req.params.id });
}));

export default router;
