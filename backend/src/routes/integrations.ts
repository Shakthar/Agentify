/**
 * Integrações de terceiros (Google Calendar OAuth, Facebook Login OAuth)
 * GET  /api/integrations/google/auth         — URL de autorização Google Calendar
 * GET  /api/integrations/google/callback     — callback OAuth Google
 * GET  /api/integrations/google/status       — estado da ligação Google
 * DELETE /api/integrations/google            — desliga conta Google
 *
 * GET  /api/integrations/facebook/auth       — URL de autorização Facebook Login
 * GET  /api/integrations/facebook/callback   — callback OAuth Facebook (Instagram token)
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

// ── Facebook Login OAuth (para obter token Instagram automaticamente) ─────────

const FB_GRAPH = 'https://graph.facebook.com';

// GET /api/integrations/facebook/auth?agentId=X
// Devolve o URL do diálogo OAuth do Facebook Login
router.get('/facebook/auth', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.query as { agentId?: string };
  if (!agentId) { res.status(400).json({ error: 'agentId obrigatório' }); return; }

  const appId = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID;
  if (!appId) {
    res.status(503).json({ error: 'FACEBOOK_APP_ID não configurado nas variáveis de ambiente' });
    return;
  }

  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId: req.tenant!.id } });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }

  const redirectUri = process.env.FACEBOOK_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/integrations/facebook/callback`;

  const state = Buffer.from(JSON.stringify({ tenantId: req.tenant!.id, agentId })).toString('base64url');

  const igConfigId = process.env.INSTAGRAM_CONFIG_ID ?? '1334200631878203';

  const params = new URLSearchParams({
    client_id: appId,
    config_id: igConfigId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  res.json({ url: `https://www.facebook.com/dialog/oauth?${params}` });
}));

// GET /api/integrations/facebook/callback?code=X&state=X
// Callback chamado pelo Facebook após o login — sem authenticate middleware
router.get('/facebook/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/dashboard?fb=error&reason=${encodeURIComponent(error_description ?? error ?? 'missing_params')}`);
  }

  let tenantId: string;
  let agentId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as Record<string, string>;
    tenantId = decoded.tenantId;
    agentId  = decoded.agentId;
    if (!tenantId || !agentId) throw new Error('invalid');
  } catch {
    return res.redirect(`${frontendUrl}/dashboard?fb=error&reason=invalid_state`);
  }

  const appId     = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID ?? '';
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? process.env.META_APP_SECRET ?? '';
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/integrations/facebook/callback`;

  try {
    // 1. Troca code por short-lived token
    const tokenResp = await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }));
    const tokenData = await tokenResp.json() as Record<string, unknown>;
    if (!tokenData.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    const shortToken = tokenData.access_token as string;

    // 2. Converte para long-lived token (60 dias)
    const longResp = await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    }));
    const longData = await longResp.json() as Record<string, unknown>;
    const longToken = (longData.access_token as string) ?? shortToken;

    // 3. Obtém o Instagram User ID via /me (nova Instagram API com Instagram Login)
    const meResp = await fetch(`${FB_GRAPH}/me?fields=id,name&access_token=${longToken}`);
    const meData = await meResp.json() as Record<string, string>;
    const igAccountId = meData.id ?? '';
    const igName = meData.name ?? '';

    // 4. Guarda no agente (token long-lived do utilizador, ID da conta Instagram)
    await (prisma.agent as any).update({
      where: { id: agentId, tenantId },
      data: {
        instagramToken: longToken,
        instagramAccountId: igAccountId || undefined,
        instagramEnabled: !!igAccountId,
      },
    });

    return res.redirect(
      `${frontendUrl}/dashboard/${agentId}?fb=success&igId=${igAccountId}&name=${encodeURIComponent(igName)}`,
    );
  } catch (err) {
    console.error('[Facebook OAuth] callback error:', err);
    return res.redirect(`${frontendUrl}/dashboard/${agentId}?fb=error&reason=token_exchange`);
  }
}));

export default router;
