import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../lib/prisma.js';

const router = Router();
router.use(authenticate);

// GET /api/referral/me
router.get('/me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tenant = await (prisma.tenant.findUnique as any)({
    where: { id: req.tenant!.id },
    select: { referralCode: true, referralCredits: true, referredBy: true },
  }) as { referralCode: string | null; referralCredits: number; referredBy: string | null } | null;

  let code = tenant?.referralCode;
  if (!code) {
    code = req.tenant!.id.slice(-8).toUpperCase();
    await (prisma.tenant.update as any)({ where: { id: req.tenant!.id }, data: { referralCode: code } });
  }

  const referrals = await (prisma.tenant.count as any)({
    where: { referredBy: code },
  });

  res.json({ code, referralCredits: tenant?.referralCredits ?? 0, referrals });
}));

export default router;
