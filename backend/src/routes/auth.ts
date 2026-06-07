import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as authService from '../services/auth.service.js';

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

const profileSchema = z.object({
  name:         z.string().min(2).max(100).optional(),
  companyName:  z.string().max(200).optional(),
  phone:        z.string().max(30).optional(),
  vatNumber:    z.string().max(30).optional(),
  addressLine1: z.string().max(200).optional(),
  addressCity:  z.string().max(100).optional(),
  addressCountry: z.string().max(100).optional(),
  addressZip:   z.string().max(20).optional(),
  brandColor:   z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl:      z.string().max(500).refine(
    (v) => !v || (v.startsWith('https://') && !v.toLowerCase().startsWith('javascript:')),
    { message: 'logoUrl deve ser HTTPS' }
  ).optional().or(z.literal('')),
  // SECURITY: domain não pode ser o próprio domínio da plataforma
  domain: z.string().max(200).regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    { message: 'Domínio inválido' }
  ).refine(
    (v) => !['agentify.shaklabs.tech', 'agentfy.shaklabs.tech', 'agentify-production-8d3a.up.railway.app'].includes(v.toLowerCase()),
    { message: 'Não podes usar um domínio da plataforma' }
  ).optional().or(z.literal('')),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

// POST /api/auth/signup
router.post('/signup', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Validation failed', parsed.error.flatten());
  }
  const result = await authService.signup(parsed.data);
  res.status(201).json(result);
}));

// POST /api/auth/login
router.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Invalid email or password format');
  }
  const result = await authService.login(parsed.data.email, parsed.data.password);
  res.json(result);
}));

// POST /api/auth/refresh
router.post('/refresh', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.json(result);
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await authService.getProfile(req.tenant!.id);
  res.json(profile);
}));

// PUT /api/auth/profile — update profile fields
router.put('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Dados inválidos', parsed.error.flatten());
  const updated = await authService.updateProfile(req.tenant!.id, parsed.data);
  res.json(updated);
}));

// POST /api/auth/change-password
router.post('/change-password', authenticate, authLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Dados inválidos', parsed.error.flatten());
  await authService.changePassword(req.tenant!.id, parsed.data.currentPassword, parsed.data.newPassword);
  res.json({ message: 'Palavra-passe alterada. Sessão encerrada nos outros dispositivos.' });
}));

// POST /api/auth/logout
router.post('/logout', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await authService.logout(req.tenant!.id, req.body.refreshToken);
  res.json({ message: 'Logged out' });
}));

export default router;
