import prisma from '../lib/prisma.js';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  verifyRefreshToken,
  hashToken,
  generateRefreshToken,
  generateEncryptionKey,
  signTwoFactorToken,
} from '../lib/auth.js';
import { PLAN_LIMITS } from '../types/index.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../lib/errors.js';
import { writeAuditLog } from './admin.service.js';
import { wrapDataKey } from '../lib/keyVault.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SignupInput {
  email: string;
  password: string;
  name: string;
  companyName?: string;
}

/**
 * Cria e persiste um novo par access/refresh token para um tenant.
 * Centraliza a lógica usada por signup, login e refresh.
 */
async function issueTokens(tenant: { id: string; email: string; plan: string }) {
  const accessToken = signAccessToken({
    tenantId: tenant.id,
    email: tenant.email,
    plan: tenant.plan,
  });
  const refreshTokenRaw = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tenantId: tenant.id,
      tokenHash: hashToken(refreshTokenRaw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken: refreshTokenRaw };
}

export async function signup(input: SignupInput) {
  const existing = await prisma.tenant.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const plan = 'free';
  const creditsTotal = PLAN_LIMITS[plan].credits;

  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      companyName: input.companyName,
      plan,
      creditsTotal,
      encryptionKey: wrapDataKey(generateEncryptionKey()),
    },
  });

  await prisma.creditLog.create({
    data: { tenantId: tenant.id, amount: creditsTotal, reason: 'signup-bonus' },
  });

  const tokens = await issueTokens(tenant);

  writeAuditLog(tenant.id, 'tenant_signup', 'tenant', tenant.id, { email: tenant.email, plan });

  return {
    id: tenant.id,
    email: tenant.email,
    name: tenant.name,
    companyName: tenant.companyName,
    plan: tenant.plan,
    creditsTotal: tenant.creditsTotal,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

// Hash dummy — garante tempo de resposta constante mesmo quando o email não existe,
// impedindo ataques de timing que revelam quais emails estão registados.
const DUMMY_HASH = '$2a$12$invalidhashusedtoblindattackersonlyXXXXXXXXXXXXXXXXXX';

export async function login(email: string, password: string) {
  const tenant = await prisma.tenant.findUnique({ where: { email, deletedAt: null } });

  // Corre sempre o compare (mesmo com tenant null) para normalizar o tempo de resposta
  const passwordToCheck = tenant?.passwordHash ?? DUMMY_HASH;
  const valid = await comparePassword(password, passwordToCheck);

  if (!tenant || !valid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // 2FA: se ativo, emite um token temporário (5 min) e indica ao frontend que precisa do código
  if (tenant.twoFactorEnabled) {
    const twoFactorToken = signTwoFactorToken(tenant.id);
    return { requiresTwoFactor: true as const, twoFactorToken };
  }

  const tokens = await issueTokens(tenant);

  return {
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tenant: {
      id: tenant.id,
      email: tenant.email,
      name: tenant.name,
      companyName: tenant.companyName,
      plan: tenant.plan,
      creditsTotal: tenant.creditsTotal,
      creditsUsed: tenant.creditsUsed,
      isAdmin: tenant.isAdmin,
    },
  };
}

export async function refresh(refreshTokenRaw: string | undefined) {
  if (!refreshTokenRaw) {
    throw new BadRequestError('Refresh token required');
  }

  try {
    verifyRefreshToken(refreshTokenRaw);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const tokenHash = hashToken(refreshTokenRaw);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  // Detecção de reuso: um token já revogado a ser reutilizado indica roubo.
  // Revoga TODOS os refresh tokens do tenant para forçar novo login em todos os dispositivos.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { tenantId: stored.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    writeAuditLog(stored.tenantId, 'refresh_token_reuse_detected', 'tenant', stored.tenantId);
    throw new UnauthorizedError('Refresh token reuse detected — all sessions revoked');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: stored.tenantId, deletedAt: null },
  });
  if (!tenant) {
    throw new UnauthorizedError('Tenant not found');
  }

  // Rotação: revoga o token usado e emite um novo par
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(tenant);
  return { token: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export async function getProfile(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, email: true, name: true, companyName: true,
      plan: true, creditsTotal: true, creditsUsed: true,
      stripeCustomerId: true, monthlyRecurringRevenue: true,
      createdAt: true, isAdmin: true,
    },
  });
}

export async function logout(tenantId: string, refreshTokenRaw: string | undefined) {
  if (refreshTokenRaw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshTokenRaw), tenantId },
      data: { revokedAt: new Date() },
    });
  }
}
