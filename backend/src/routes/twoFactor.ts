import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { verifyTwoFactorToken, signAccessToken, generateRefreshToken, hashToken } from '../lib/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as twoFactorService from '../services/twoFactor.service.js';
import { verifyTwoFactorCode } from '../services/twoFactor.service.js';
import prisma from '../lib/prisma.js';

const router = Router();

const codeSchema = z.object({ code: z.string().length(6).regex(/^\d{6}$/) });

// GET /api/auth/2fa/status — estado atual (requer login)
router.get('/status', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const status = await twoFactorService.getTwoFactorStatus(req.tenant!.id);
  res.json(status);
}));

// POST /api/auth/2fa/setup — gera secret + QR code (requer login)
router.post('/setup', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await twoFactorService.setupTwoFactor(req.tenant!.id, req.tenant!.email);
  res.json(result);
}));

// POST /api/auth/2fa/enable — confirma primeiro código e ativa (requer login)
router.post('/enable', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Código deve ter 6 dígitos');
  await twoFactorService.enableTwoFactor(req.tenant!.id, parsed.data.code);
  res.json({ message: '2FA ativado com sucesso' });
}));

// POST /api/auth/2fa/disable — desativa (requer login + código TOTP)
router.post('/disable', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Código deve ter 6 dígitos');
  await twoFactorService.disableTwoFactor(req.tenant!.id, parsed.data.code);
  res.json({ message: '2FA desativado' });
}));

/**
 * POST /api/auth/2fa/verify
 * Segundo passo do login quando 2FA está ativo.
 * Recebe o twoFactorToken (JWT de 5 min) + código TOTP do utilizador.
 * Devolve os tokens reais se o código estiver correto.
 */
router.post('/verify', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { twoFactorToken, code } = req.body;

  if (!twoFactorToken || typeof twoFactorToken !== 'string') {
    throw new BadRequestError('twoFactorToken é obrigatório');
  }
  const parsed = codeSchema.safeParse({ code });
  if (!parsed.success) throw new BadRequestError('Código deve ter 6 dígitos');

  // Verifica o token temporário
  let tenantId: string;
  try {
    const payload = verifyTwoFactorToken(twoFactorToken);
    tenantId = payload.tenantId;
  } catch {
    throw new BadRequestError('Token expirado ou inválido. Faça login novamente.');
  }

  // Verifica o código TOTP
  await verifyTwoFactorCode(tenantId, parsed.data.code);

  // Tudo correto — emite tokens reais
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, plan: true, name: true, companyName: true, creditsTotal: true, creditsUsed: true },
  });
  if (!tenant) throw new BadRequestError('Conta não encontrada');

  const accessToken = signAccessToken({ tenantId: tenant.id, email: tenant.email, plan: tenant.plan });
  const refreshTokenRaw = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tenantId: tenant.id,
      tokenHash: hashToken(refreshTokenRaw),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    token: accessToken,
    refreshToken: refreshTokenRaw,
    tenant: {
      id: tenant.id, email: tenant.email, name: tenant.name,
      companyName: tenant.companyName, plan: tenant.plan,
      creditsTotal: tenant.creditsTotal, creditsUsed: tenant.creditsUsed,
    },
  });
}));

export default router;
