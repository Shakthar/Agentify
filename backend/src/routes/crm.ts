import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../lib/prisma.js';

const router = Router();
router.use(authenticate);

const contactSchema = z.object({
  phone:  z.string().optional(),
  name:   z.string().optional(),
  email:  z.string().email().optional().or(z.literal('')),
  status: z.enum(['lead', 'cliente', 'inativo', 'vip']).optional(),
  tags:   z.array(z.string()).optional(),
  notes:  z.string().max(5000).optional(),
});

// GET /api/crm — lista de contactos
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = Math.min(parseInt(req.query.take as string) || 20, 100);
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;
  const agentId = req.query.agentId as string | undefined;

  const where: any = { tenantId: req.tenant!.id };
  if (status) where.status = status;
  if (agentId) where.agentId = agentId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [contacts, total] = await Promise.all([
    (prisma as any).crmContact.findMany({ where, skip, take, orderBy: { lastSeenAt: 'desc' } }),
    (prisma as any).crmContact.count({ where }),
  ]);
  res.json({ contacts, total });
}));

// GET /api/crm/:id
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const contact = await (prisma as any).crmContact.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!contact) { res.status(404).json({ error: 'Not found' }); return; }
  // Get conversation history for this contact
  const convs = await prisma.conversation.findMany({
    where: { tenantId: req.tenant!.id, visitorId: contact.phone ?? contact.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, createdAt: true, channelType: true, resolved: true, tokensUsed: true } as any,
  });
  res.json({ ...contact, conversations: convs });
}));

// PATCH /api/crm/:id
router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Validation failed');
  const existing = await (prisma as any).crmContact.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await (prisma as any).crmContact.update({
    where: { id: req.params.id },
    data: { ...parsed.data, updatedAt: new Date() },
  });
  res.json(updated);
}));

// POST /api/crm/sync — sincronizar contactos a partir de conversas (batch)
router.post('/sync', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Aggregate unique visitors from conversations and upsert to CrmContact
  const visitors = await prisma.conversation.groupBy({
    by: ['visitorId', 'visitorName'],
    where: { tenantId: req.tenant!.id, visitorId: { not: null } },
    _count: { id: true },
    _max: { createdAt: true },
    _avg: { sentiment: true },
  });

  let created = 0; let updated = 0;
  for (const v of visitors) {
    if (!v.visitorId) continue;
    const existing = await (prisma as any).crmContact.findFirst({
      where: { tenantId: req.tenant!.id, phone: v.visitorId },
    });
    if (existing) {
      await (prisma as any).crmContact.update({
        where: { id: existing.id },
        data: {
          name: v.visitorName ?? existing.name,
          lastSeenAt: v._max.createdAt,
          totalConversations: v._count.id,
          avgSentiment: v._avg.sentiment,
          updatedAt: new Date(),
        },
      });
      updated++;
    } else {
      await (prisma as any).crmContact.create({
        data: {
          tenantId: req.tenant!.id,
          phone: v.visitorId,
          name: v.visitorName,
          firstSeenAt: v._max.createdAt ?? new Date(),
          lastSeenAt: v._max.createdAt ?? new Date(),
          totalConversations: v._count.id,
          avgSentiment: v._avg.sentiment,
        },
      });
      created++;
    }
  }
  res.json({ created, updated, total: visitors.length });
}));

export default router;
