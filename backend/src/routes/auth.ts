import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  verifyRefreshToken,
  hashToken,
  generateRefreshToken,
  generateEncryptionKey,
} from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { AuthenticatedRequest } from '../types/index.js';
import { PLAN_LIMITS } from '../types/index.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().min(2).max(100),
  companyName: z.string().max(200).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/signup
router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }

  const { email, password, name, companyName } = parsed.data;

  const existing = await prisma.tenant.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await hashPassword(password);
  const encryptionKey = generateEncryptionKey();
  const plan = 'free';
  const creditsTotal = PLAN_LIMITS[plan].credits;

  const tenant = await prisma.tenant.create({
    data: {
      name,
      email,
      passwordHash,
      companyName,
      plan,
      creditsTotal,
      encryptionKey,
    },
  });

  // Bonus credit log
  await prisma.creditLog.create({
    data: {
      tenantId: tenant.id,
      amount: creditsTotal,
      reason: 'signup-bonus',
    },
  });

  const payload = { tenantId: tenant.id, email: tenant.email, plan: tenant.plan };
  const accessToken = signAccessToken(payload);
  const refreshTokenRaw = generateRefreshToken();
  const tokenHash = hashToken(refreshTokenRaw);

  await prisma.refreshToken.create({
    data: {
      tenantId: tenant.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return res.status(201).json({
    id: tenant.id,
    email: tenant.email,
    name: tenant.name,
    companyName: tenant.companyName,
    plan: tenant.plan,
    creditsTotal: tenant.creditsTotal,
    token: accessToken,
    refreshToken: refreshTokenRaw,
  });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password format' });
  }

  const { email, password } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { email, deletedAt: null } });
  if (!tenant) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await comparePassword(password, tenant.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = { tenantId: tenant.id, email: tenant.email, plan: tenant.plan };
  const accessToken = signAccessToken(payload);
  const refreshTokenRaw = generateRefreshToken();
  const tokenHash = hashToken(refreshTokenRaw);

  await prisma.refreshToken.create({
    data: {
      tenantId: tenant.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return res.status(200).json({
    token: accessToken,
    refreshToken: refreshTokenRaw,
    tenant: {
      id: tenant.id,
      email: tenant.email,
      name: tenant.name,
      companyName: tenant.companyName,
      plan: tenant.plan,
      creditsTotal: tenant.creditsTotal,
      creditsUsed: tenant.creditsUsed,
    },
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Refresh token expired or revoked' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: stored.tenantId, deletedAt: null },
  });
  if (!tenant) {
    return res.status(401).json({ error: 'Tenant not found' });
  }

  // Rotate refresh token
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const payload = { tenantId: tenant.id, email: tenant.email, plan: tenant.plan };
  const newAccessToken = signAccessToken(payload);
  const newRefreshRaw = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshRaw);

  await prisma.refreshToken.create({
    data: {
      tenantId: tenant.id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return res.status(200).json({ token: newAccessToken, refreshToken: newRefreshRaw });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant!.id },
    select: {
      id: true, email: true, name: true, companyName: true,
      plan: true, creditsTotal: true, creditsUsed: true,
      stripeCustomerId: true, monthlyRecurringRevenue: true,
      createdAt: true,
    },
  });
  return res.json(tenant);
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, tenantId: req.tenant!.id },
      data: { revokedAt: new Date() },
    });
  }
  return res.json({ message: 'Logged out' });
});

export default router;
