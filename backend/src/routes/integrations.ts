/**
 * Integrações de terceiros (Google Calendar OAuth, etc.)
 * GET  /api/integrations/google/auth      — devolve URL de autorização Google
 * GET  /api/integrations/google/callback  — callback OAuth (sem auth middleware)
 * DELETE /api/integrations/google         — desliga a conta Google de um agente
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/index.js';
import {
  isConfigured,
  getOAuthUrl,
  exchangeCode,
  encryptCalendarToken,
  decryptCalendarToken,
} from '../lib/googleCalendar.js';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/integrations/google/auth?agentId=X
router.get('/google/auth', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Google OAuth não está configurado nesta plataforma. Adiciona GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI às variáveis de ambiente.' });
    return;
  }
  const { agentId } = req.query as { agentId?: string };
  if (!agentId) { res.status(400).json({ error: 'agentId obrigatório' }); return; }

  // Verifica que o agente pertence ao tenant
  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId: req.tenant!.id } });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }

  const state = Buffer.from(JSON.stringify({ tenantId: req.tenant!.id, agentId })).toString('base64url');
  const url = getOAuthUrl(state);
  res.json({ url });
}));

// GET /api/integrations/google/callback?code=X&state=X
// Chamado pelo Google após o utilizador autorizar — sem authenticate middleware
router.get('/google/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/dashboard?gcal=error&reason=${error ?? 'missing_params'}`);
  }

  let tenantId: string;
  let agentId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as Record<string, string>;
    tenantId = decoded.tenantId;
    agentId  = decoded.agentId;
    if (!tenantId || !agentId) throw new Error('invalid');
  } catch {
    return res.redirect(`${frontendUrl}/dashboard?gcal=error&reason=invalid_state`);
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);
    const encryptedToken = encryptCalendarToken(refreshToken, email);

    await (prisma.agent as any).update({
      where: { id: agentId, tenantId },
      data: { calendarToken: encryptedToken, calendarEnabled: true },
    });

    return res.redirect(
      `${frontendUrl}/dashboard/${agentId}?gcal=success&email=${encodeURIComponent(email)}`,
    );
  } catch (err) {
    console.error('[Google Calendar] callback error:', err);
    return res.redirect(`${frontendUrl}/dashboard/${agentId}?gcal=error&reason=token_exchange`);
  }
}));

// GET /api/integrations/google/status?agentId=X — devolve email conectado
router.get('/google/status', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.query as { agentId?: string };
  if (!agentId) { res.status(400).json({ error: 'agentId obrigatório' }); return; }

  const agent = await (prisma.agent as any).findFirst({
    where: { id: agentId, tenantId: req.tenant!.id },
    select: { calendarToken: true, calendarEnabled: true },
  });
  if (!agent) { res.status(404).json({ error: 'Not found' }); return; }

  if (!agent.calendarToken) {
    res.json({ connected: false });
    return;
  }
  try {
    const { email } = decryptCalendarToken(agent.calendarToken);
    res.json({ connected: true, email, enabled: agent.calendarEnabled });
  } catch {
    res.json({ connected: false });
  }
}));

// DELETE /api/integrations/google?agentId=X — desliga conta Google
router.delete('/google', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.query as { agentId?: string };
  if (!agentId) { res.status(400).json({ error: 'agentId obrigatório' }); return; }

  await (prisma.agent as any).update({
    where: { id: agentId, tenantId: req.tenant!.id },
    data: { calendarToken: null, calendarEnabled: false },
  });
  res.json({ success: true });
}));

export default router;
