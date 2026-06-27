import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import { BadRequestError, ForbiddenError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// Only agency owners can access these routes
const requireAgency = (req: AuthenticatedRequest, _res: Response, next: () => void) => {
  const tenant = req.tenant as any;
  if (!tenant.isAgency && !tenant.isAdmin) {
    throw new ForbiddenError('Agency plan required');
  }
  next();
};

// GET /api/agency/status — check if this tenant is an agency or a sub-account
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant!.id },
    select: { id: true, agencyId: true, agencyName: true, agencyBrandColor: true, agencyLogoUrl: true, isAgency: true } as any,
  }) as any;
  if (!tenant) { res.status(404).json({ error: 'Not found' }); return; }

  let parentAgency = null;
  if (tenant.agencyId) {
    parentAgency = await prisma.tenant.findUnique({
      where: { id: tenant.agencyId },
      select: { id: true, name: true },
    }) as any;
  }

  res.json({
    isAgency: !!tenant.isAgency,
    agencyId: tenant.agencyId,
    agencyName: tenant.agencyName,
    agencyBrandColor: tenant.agencyBrandColor,
    agencyLogoUrl: tenant.agencyLogoUrl,
    parentAgency,
  });
}));

// GET /api/agency/subaccounts — list sub-accounts
router.get('/subaccounts', requireAgency, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const subaccounts = await (prisma.tenant as any).findMany({
    where: { agencyId: req.tenant!.id },
    select: { id: true, name: true, email: true, plan: true, subscriptionStatus: true, createdAt: true, isActive: true, _count: { select: { agents: true } } } as any,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ subaccounts, total: subaccounts.length });
}));

// POST /api/agency/subaccounts — create a sub-account
const createSubSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().max(100).optional(),
  plan: z.enum(['free', 'starter', 'business', 'enterprise']).default('starter'),
});

router.post('/subaccounts', requireAgency, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSubSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Validation failed', parsed.error.flatten());

  const { name, email, password, companyName, plan } = parsed.data;

  // Check email not already taken
  const existing = await prisma.tenant.findFirst({ where: { email } });
  if (existing) throw new BadRequestError('Email already registered');

  const agencyTenant = await (prisma.tenant as any).findUnique({
    where: { id: req.tenant!.id },
    select: { agencyName: true, agencyBrandColor: true, agencyLogoUrl: true },
  });

  const hashedPassword = await bcrypt.hash(password, 10);

  const sub = await (prisma.tenant as any).create({
    data: {
      name,
      email,
      password: hashedPassword,
      companyName: companyName ?? name,
      plan,
      subscriptionStatus: 'active',
      isActive: true,
      agencyId: req.tenant!.id,
      // inherit agency branding
      agencyName: agencyTenant?.agencyName,
      agencyBrandColor: agencyTenant?.agencyBrandColor,
      agencyLogoUrl: agencyTenant?.agencyLogoUrl,
    } as any,
    select: {
      id: true, name: true, email: true, plan: true, subscriptionStatus: true, createdAt: true,
    },
  });

  res.status(201).json(sub);
}));

// PATCH /api/agency/subaccounts/:subId — update sub-account (plan, status)
const updateSubSchema = z.object({
  plan: z.enum(['free', 'starter', 'business', 'enterprise']).optional(),
  isActive: z.boolean().optional(),
  agencyName: z.string().max(100).optional(),
  agencyBrandColor: z.string().max(20).optional(),
  agencyLogoUrl: z.string().url().optional().or(z.literal('')),
});

router.patch('/subaccounts/:subId', requireAgency, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateSubSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Validation failed', parsed.error.flatten());

  // Ensure the sub-account belongs to this agency
  const sub = await (prisma.tenant as any).findFirst({
    where: { id: req.params.subId, agencyId: req.tenant!.id },
  });
  if (!sub) { res.status(404).json({ error: 'Sub-account not found' }); return; }

  const updated = await (prisma.tenant as any).update({
    where: { id: req.params.subId },
    data: parsed.data,
    select: { id: true, name: true, email: true, plan: true, subscriptionStatus: true, isActive: true } as any,
  });
  res.json(updated);
}));

// DELETE /api/agency/subaccounts/:subId — deactivate sub-account
router.delete('/subaccounts/:subId', requireAgency, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const sub = await (prisma.tenant as any).findFirst({
    where: { id: req.params.subId, agencyId: req.tenant!.id },
  });
  if (!sub) { res.status(404).json({ error: 'Sub-account not found' }); return; }

  await (prisma.tenant as any).update({
    where: { id: req.params.subId },
    data: { isActive: false, subscriptionStatus: 'suspended' },
  });
  res.status(204).send();
}));

// GET /api/agency/branding — get agency branding settings
router.get('/branding', requireAgency, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenant = await (prisma.tenant as any).findUnique({
    where: { id: req.tenant!.id },
    select: { agencyName: true, agencyBrandColor: true, agencyLogoUrl: true },
  });
  res.json(tenant ?? {});
}));

// PATCH /api/agency/branding — update agency branding
const brandingSchema = z.object({
  agencyName: z.string().max(100).optional(),
  agencyBrandColor: z.string().max(20).optional(),
  agencyLogoUrl: z.string().url().optional().or(z.literal('')),
});

router.patch('/branding', requireAgency, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = brandingSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Validation failed', parsed.error.flatten());

  const updated = await (prisma.tenant as any).update({
    where: { id: req.tenant!.id },
    data: parsed.data,
    select: { agencyName: true, agencyBrandColor: true, agencyLogoUrl: true },
  });
  res.json(updated);
}));

export default router;
