import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../lib/prisma.js';

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' }); return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId, deletedAt: null },
      select: {
        id: true, email: true, plan: true, creditsTotal: true, creditsUsed: true, isAdmin: true,
        subscriptionMethod: true, subscriptionStatus: true, subscriptionExpiresAt: true,
      },
    });

    if (!tenant) {
      res.status(401).json({ error: 'Tenant not found or deleted' }); return;
    }

    req.tenant = tenant;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.tenant?.isAdmin) {
    res.status(403).json({ error: 'Acesso restrito a superadmins' });
    return;
  }
  next();
}
