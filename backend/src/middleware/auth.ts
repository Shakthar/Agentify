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

    // SECURITY: Rejeitar tokens pending_2fa como tokens de sessão completos.
    // signTwoFactorToken usa o mesmo JWT_SECRET; sem esta verificação, o token
    // temporário emitido a meio do login 2FA seria aceite como sessão válida,
    // bypassando o segundo factor completamente.
    if ((payload as unknown as Record<string, unknown>)['type'] === 'pending_2fa') {
      res.status(401).json({ error: '2FA incompleto — complete a autenticação' }); return;
    }

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
