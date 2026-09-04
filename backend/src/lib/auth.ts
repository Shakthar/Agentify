import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { JWTPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set');
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Token temporário (5 min) emitido após password correta quando 2FA está ativo.
 *  Não é um access token — só serve para completar o segundo fator. */
export function signTwoFactorToken(tenantId: string): string {
  return jwt.sign({ tenantId, type: 'pending_2fa' }, JWT_SECRET, { expiresIn: '5m' } as jwt.SignOptions);
}

export function verifyTwoFactorToken(token: string): { tenantId: string } {
  const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { tenantId: string; type: string };
  if (payload.type !== 'pending_2fa') throw new Error('Invalid token type');
  return { tenantId: payload.tenantId };
}

/** State assinado (CSRF) para o fluxo OAuth do "Login com Facebook" — stateless,
 *  não precisa de sessão/cookie: a Meta devolve-o tal e qual no callback e nós
 *  validamos a assinatura e o prazo. Válido por 10 min. */
export function signOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ nonce, type: 'oauth_state' }, JWT_SECRET, { expiresIn: '10m' } as jwt.SignOptions);
}

export function verifyOAuthState(state: string): void {
  const payload = jwt.verify(state, JWT_SECRET, { algorithms: ['HS256'] }) as { type: string };
  if (payload.type !== 'oauth_state') throw new Error('Invalid state type');
}

/** Ticket de curta duração (2 min) emitido no callback do "Login com Facebook",
 *  passado ao frontend via redirect e trocado por tokens reais em
 *  POST /api/auth/facebook/exchange. Evita colocar tokens de sessão no URL. */
export function signFbLoginTicket(tenantId: string, requiresTwoFactor: boolean): string {
  return jwt.sign({ tenantId, requiresTwoFactor, type: 'fb_login_ticket' }, JWT_SECRET, { expiresIn: '2m' } as jwt.SignOptions);
}

export function verifyFbLoginTicket(ticket: string): { tenantId: string; requiresTwoFactor: boolean } {
  const payload = jwt.verify(ticket, JWT_SECRET, { algorithms: ['HS256'] }) as { tenantId: string; requiresTwoFactor: boolean; type: string };
  if (payload.type !== 'fb_login_ticket') throw new Error('Invalid token type');
  return { tenantId: payload.tenantId, requiresTwoFactor: payload.requiresTwoFactor };
}
