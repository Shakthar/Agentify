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

interface FacebookProfileInput {
  email: string;
  name: string;
  facebookId: string;
}

/**
 * Login/registo via "Continuar com Facebook" na própria plataforma Agentify
 * (autenticação da conta, distinto da ligação de contas Instagram/WhatsApp a um
 * agente). Procura primeiro por facebookId (conta já associada, mesmo que o email
 * atual do Tenant seja diferente do email do Facebook) e só depois por email — se
 * encontrar por email uma conta ainda sem facebookId, associa-o agora automaticamente.
 * Caso contrário, cria-se uma conta nova. Como o Tenant exige passwordHash, contas
 * criadas por esta via recebem uma password aleatória (nunca partilhada) — o login
 * normal por password fica indisponível até o utilizador definir uma própria.
 */
export async function loginOrSignupWithFacebook(input: FacebookProfileInput) {
  let tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null, OR: [{ facebookId: input.facebookId }, { email: input.email }] },
  });

  if (tenant && tenant.facebookId !== input.facebookId) {
    // Encontrado por email mas ainda não tinha o Facebook associado — associa agora.
    tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: { facebookId: input.facebookId } });
  }

  if (!tenant) {
    const plan = 'free';
    const creditsTotal = PLAN_LIMITS[plan].credits;

    tenant = await prisma.tenant.create({
      data: {
        name: input.name || input.email.split('@')[0],
        email: input.email,
        facebookId: input.facebookId,
        passwordHash: await hashPassword(generateRefreshToken()),
        plan,
        creditsTotal,
        encryptionKey: wrapDataKey(generateEncryptionKey()),
      },
    });

    await prisma.creditLog.create({
      data: { tenantId: tenant.id, amount: creditsTotal, reason: 'signup-bonus' },
    });

    writeAuditLog(tenant.id, 'tenant_signup_facebook', 'tenant', tenant.id, { email: tenant.email, plan });
  } else {
    writeAuditLog(tenant.id, 'tenant_login_facebook', 'tenant', tenant.id, { email: tenant.email });
  }

  return { tenantId: tenant.id, requiresTwoFactor: tenant.twoFactorEnabled };
}

/**
 * Associa (ou remove a associação d)a conta do Facebook a um Tenant já autenticado —
 * usado na aba de Perfil, para o caso de o email do Facebook ser diferente do email
 * de login do Agentify. Rejeita se essa conta do Facebook já estiver associada a OUTRO
 * Tenant (uma conta do Facebook só pode estar associada a uma conta Agentify de cada vez).
 */
export async function linkFacebookAccount(tenantId: string, facebookId: string, facebookEmail: string) {
  const existing = await prisma.tenant.findUnique({ where: { facebookId } });
  if (existing && existing.id !== tenantId) {
    throw new ConflictError('Esta conta do Facebook já está associada a outra conta Agentify.');
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { facebookId } });
  writeAuditLog(tenantId, 'tenant_link_facebook', 'tenant', tenantId, { facebookEmail });
}

export async function unlinkFacebookAccount(tenantId: string) {
  await prisma.tenant.update({ where: { id: tenantId }, data: { facebookId: null } });
  writeAuditLog(tenantId, 'tenant_unlink_facebook', 'tenant', tenantId, {});
}

/** Troca o ticket de curta duração (ver signFbLoginTicket) pelos tokens reais de
 *  sessão, ou pelo twoFactorToken se a conta tiver 2FA ativo — mesma forma de
 *  resposta que login(), para o frontend reutilizar a mesma lógica. */
export async function completeFacebookLogin(tenantId: string, requiresTwoFactor: boolean) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) {
    throw new UnauthorizedError('Conta não encontrada');
  }

  if (requiresTwoFactor) {
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

  // SECURITY: Operação atómica para evitar TOCTOU (time-of-check-time-of-use).
  // Tentamos revogar APENAS se o token não estiver já revogado E não estiver expirado.
  // Se count === 0 → ou já foi revogado (possível reuso) ou não existe.
  const now = new Date();
  const revokeResult = await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
    data:  { revokedAt: now },
  });

  if (revokeResult.count === 0) {
    // Token não foi revogado — verificar se existe mas já estava revogado (reuso detectado)
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { tenantId: true, revokedAt: true, expiresAt: true },
    });

    if (stored?.revokedAt) {
      // Token previamente válido a ser reusado → roubo de sessão provável
      // Revogar TODAS as sessões do tenant como precaução
      await prisma.refreshToken.updateMany({
        where: { tenantId: stored.tenantId, revokedAt: null },
        data: { revokedAt: now },
      });
      writeAuditLog(stored.tenantId, 'refresh_token_reuse_detected', 'tenant', stored.tenantId);
    }
    throw new UnauthorizedError('Refresh token expired or revoked');
  }

  // Token revogado com sucesso — agora buscar o tenantId associado
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: { tenantId: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: stored!.tenantId, deletedAt: null },
  });
  if (!tenant) {
    throw new UnauthorizedError('Tenant not found');
  }

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
      phone: true, vatNumber: true,
      addressLine1: true, addressCity: true, addressCountry: true, addressZip: true,
      brandColor: true, logoUrl: true, domain: true,
      facebookId: true,
      createdAt: true, isAdmin: true,
    },
  });
}

export async function updateProfile(tenantId: string, data: {
  name?: string;
  companyName?: string;
  phone?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressCity?: string;
  addressCountry?: string;
  addressZip?: string;
  brandColor?: string;
  logoUrl?: string;
  domain?: string;
}) {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data,
    select: {
      id: true, email: true, name: true, companyName: true,
      plan: true, creditsTotal: true, creditsUsed: true,
      phone: true, vatNumber: true,
      addressLine1: true, addressCity: true, addressCountry: true, addressZip: true,
      brandColor: true, logoUrl: true, domain: true,
      facebookId: true,
      createdAt: true, isAdmin: true,
    },
  });
  writeAuditLog(tenantId, 'profile_updated', 'tenant', tenantId);
  return updated;
}

export async function changePassword(tenantId: string, currentPassword: string, newPassword: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new UnauthorizedError('Tenant not found');

  const valid = await comparePassword(currentPassword, tenant.passwordHash);
  if (!valid) throw new BadRequestError('Palavra-passe atual incorreta');

  const newHash = await hashPassword(newPassword);
  await prisma.tenant.update({ where: { id: tenantId }, data: { passwordHash: newHash } });

  // Revoke all refresh tokens to force re-login on all devices
  await prisma.refreshToken.updateMany({
    where: { tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  writeAuditLog(tenantId, 'password_changed', 'tenant', tenantId);
}

export async function logout(tenantId: string, refreshTokenRaw: string | undefined) {
  if (refreshTokenRaw) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshTokenRaw), tenantId },
      data: { revokedAt: new Date() },
    });
  }
}
