import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as adminService from '../services/admin.service.js';

const router = Router();
router.use(authenticate);

// GET /api/admin/metrics
router.get('/metrics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const metrics = await adminService.getMetrics(req.tenant!.id);
  res.json(metrics);
}));

// GET /api/admin/audit-logs?skip=0&take=50
router.get('/audit-logs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const skip = parseInt(req.query.skip as string) || 0;
  const take = Math.min(parseInt(req.query.take as string) || 50, 100);
  const result = await adminService.getAuditLogs(req.tenant!.id, skip, take);
  res.json(result);
}));

export default router;
