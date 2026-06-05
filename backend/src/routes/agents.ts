import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { PLAN_LIMITS, ALLOWED_MODELS } from '../types/index.js';

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
  whatsappNumber: z.string().max(20).optional(),
  webChatEnabled: z.boolean().optional().default(true),
  emailEnabled: z.boolean().optional().default(false),
  offHoursMessage: z.string().max(500).optional(),
  offHourStart: z.string().optional(),
  offHourEnd: z.string().optional(),
});

const updateAgentSchema = createAgentSchema.partial();

// GET /api/agents
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = Math.min(parseInt(req.query.take as string) || 10, 50);
  const search = req.query.search as string | undefined;

  const where = {
    tenantId: req.tenant!.id,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, description: true, model: true,
        isActive: true, totalConversations: true, totalMessages: true,
        webChatEnabled: true, whatsappEnabled: true, emailEnabled: true,
        createdAt: true,
      },
    }),
    prisma.agent.count({ where }),
  ]);

  return res.json({ agents, total });
});

// POST /api/agents
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const plan = req.tenant!.plan as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];
  const allowedModels = ALLOWED_MODELS[plan];

  if (!allowedModels.includes(parsed.data.model)) {
    return res.status(403).json({ error: `Model ${parsed.data.model} not available on ${plan} plan` });
  }

  const agentCount = await prisma.agent.count({ where: { tenantId: req.tenant!.id } });
  if (agentCount >= limits.agents) {
    return res.status(403).json({ error: `Agent limit (${limits.agents}) reached for ${plan} plan` });
  }

  const { skills, ...agentData } = parsed.data;

  const agent = await prisma.agent.create({
    data: {
      tenantId: req.tenant!.id,
      ...agentData,
      skillHandoff: skills?.handoff ?? true,
      skillDataCollection: skills?.dataCollection ?? true,
      skillScheduling: skills?.scheduling ?? false,
      skillFileUpload: skills?.fileUpload ?? false,
      skillHumorDetection: skills?.humorDetection ?? false,
    },
  });

  return res.status(201).json(agent);
});

// GET /api/agents/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const agent = await prisma.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  return res.json({
    ...agent,
    skills: {
      handoff: agent.skillHandoff,
      dataCollection: agent.skillDataCollection,
      scheduling: agent.skillScheduling,
      fileUpload: agent.skillFileUpload,
      humorDetection: agent.skillHumorDetection,
    },
    statistics: {
      totalConversations: agent.totalConversations,
      totalMessages: agent.totalMessages,
      averageResolution: agent.averageResolution,
    },
  });
});

// PATCH /api/agents/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const existing = await prisma.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  if (parsed.data.model) {
    const plan = req.tenant!.plan as keyof typeof ALLOWED_MODELS;
    if (!ALLOWED_MODELS[plan].includes(parsed.data.model)) {
      return res.status(403).json({ error: `Model ${parsed.data.model} not available on ${plan} plan` });
    }
  }

  const { skills, ...updateData } = parsed.data;
  const skillsUpdate = skills ? {
    skillHandoff: skills.handoff,
    skillDataCollection: skills.dataCollection,
    skillScheduling: skills.scheduling,
    skillFileUpload: skills.fileUpload,
    skillHumorDetection: skills.humorDetection,
  } : {};

  const agent = await prisma.agent.update({
    where: { id: req.params.id },
    data: { ...updateData, ...skillsUpdate },
  });

  return res.json(agent);
});

// DELETE /api/agents/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const existing = await prisma.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  await prisma.agent.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

// PATCH /api/agents/:id/toggle
router.patch('/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  const existing = await prisma.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!existing) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const agent = await prisma.agent.update({
    where: { id: req.params.id },
    data: { isActive: !existing.isActive },
  });

  return res.json({ id: agent.id, isActive: agent.isActive });
});

export default router;
