import { generateSecret, generateURI, verify as verifyOTP } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../lib/prisma.js';
import { BadRequestError, UnauthorizedError } from '../lib/errors.js';

const ISSUER = 'Agentfy';

/** Configura o TOTP — devolve o QR code para o user escanear no Google Authenticator / Authy.
 *  O secret é guardado mas 2FA não está ativo até `enableTwoFactor` ser chamado com um código válido. */
export async function setupTwoFactor(
  tenantId: string,
  email: string,
): Promise<{ qrCodeDataUrl: string; secret: string }> {
  const secret = generateSecret({ length: 20 });
  const otpAuthUrl = generateURI({ issuer: ISSUER, label: email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { twoFactorSecret: secret },
  });

  return { qrCodeDataUrl, secret };
}

/** Confirma o primeiro código TOTP e ativa o 2FA. */
export async function enableTwoFactor(tenantId: string, code: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.twoFactorSecret) {
    throw new BadRequestError('Configure o 2FA primeiro (/2fa/setup)');
  }
  if (tenant.twoFactorEnabled) {
    throw new BadRequestError('2FA já está ativo');
  }

  const result = await verifyOTP({ token: code, secret: tenant.twoFactorSecret });
  if (!result.valid) {
    throw new UnauthorizedError('Código inválido');
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { twoFactorEnabled: true },
  });
}

/** Desativa o 2FA — requer código TOTP atual para confirmar. */
export async function disableTwoFactor(tenantId: string, code: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.twoFactorEnabled || !tenant.twoFactorSecret) {
    throw new BadRequestError('2FA não está ativo');
  }

  const result = await verifyOTP({ token: code, secret: tenant.twoFactorSecret });
  if (!result.valid) {
    throw new UnauthorizedError('Código inválido');
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
}

/** Verifica o código TOTP durante o login (segundo fator). Previne replay na mesma janela. */
// Anti-replay: cache em memória por janela TOTP (30s). Suficiente para instância única (Railway).
const _usedCodes = new Map<string, number>(); // key=`tenantId:window:code`, value=timestamp

export async function verifyTwoFactorCode(tenantId: string, code: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.twoFactorSecret) {
    throw new UnauthorizedError('2FA não configurado');
  }

  const result = await verifyOTP({ token: code, secret: tenant.twoFactorSecret });
  if (!result.valid) {
    throw new UnauthorizedError('Código 2FA inválido ou expirado');
  }

  // Anti-replay: rejeita o mesmo código na mesma janela de 30s
  const window = Math.floor(Date.now() / 30000);
  const cacheKey = `${tenantId}:${window}:${code}`;
  if (_usedCodes.has(cacheKey)) {
    throw new UnauthorizedError('Código 2FA já utilizado. Aguarda a próxima janela de 30 segundos.');
  }
  _usedCodes.set(cacheKey, Date.now());

  // Limpa entradas com mais de 2 minutos (evita crescimento ilimitado da Map)
  const cutoff = Date.now() - 120_000;
  for (const [k, ts] of _usedCodes) {
    if (ts < cutoff) _usedCodes.delete(k);
  }
}

export async function getTwoFactorStatus(
  tenantId: string,
): Promise<{ enabled: boolean }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { twoFactorEnabled: true },
  });
  return { enabled: tenant?.twoFactorEnabled ?? false };
}
