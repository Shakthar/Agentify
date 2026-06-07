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

/** Verifica o código TOTP durante o login (segundo fator). Previne replay persistentemente (DB). */
export async function verifyTwoFactorCode(tenantId: string, code: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { twoFactorSecret: true, twoFactorLastCode: true },
  });
  if (!tenant?.twoFactorSecret) {
    throw new UnauthorizedError('2FA não configurado');
  }

  const result = await verifyOTP({ token: code, secret: tenant.twoFactorSecret });
  if (!result.valid) {
    throw new UnauthorizedError('Código 2FA inválido ou expirado');
  }

  // SECURITY: Anti-replay persistente em DB.
  // Chave = o próprio código de 6 dígitos (sem janela de tempo do servidor).
  //
  // PORQUÊ não usar `"${window}:${code}"` (solução anterior):
  //   otplib aceita códigos de janelas adjacentes (window=1 → ±30s).
  //   Um código usado na janela T e armazenado como "T:code" pode ser re-usado
  //   na janela T+1 com chave "T+1:code" diferente → replay bem-sucedido.
  //
  // Usando apenas o código: qualquer re-uso do mesmo valor é bloqueado,
  // independentemente de quando ocorre dentro da janela de validade (~90s).
  // Risco de falso positivo (mesmo 6 dígitos em janela futura) = 1/1.000.000 por
  // utilizador por login — negligenciável, e o utilizador só espera 30s.
  const codeKey = code; // 6 dígitos — único por tenant dentro da janela de validade

  if (tenant.twoFactorLastCode === codeKey) {
    throw new UnauthorizedError('Código 2FA já utilizado. Aguarda a próxima janela de 30 segundos.');
  }

  // Guardar atomicamente o código usado (evita condição de corrida em multi-instância)
  const updated = await prisma.tenant.updateMany({
    where: { id: tenantId, twoFactorLastCode: { not: codeKey } },
    data:  { twoFactorLastCode: codeKey },
  });

  if (updated.count === 0) {
    // Outro pedido concorrente já registou este mesmo código
    throw new UnauthorizedError('Código 2FA já utilizado. Aguarda a próxima janela de 30 segundos.');
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
