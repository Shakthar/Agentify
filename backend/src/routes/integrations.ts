/**
 * Integrações de terceiros (Google Calendar OAuth, Instagram Login OAuth)
 * GET  /api/integrations/google/auth         — URL de autorização Google Calendar
 * GET  /api/integrations/google/callback     — callback OAuth Google
 * GET  /api/integrations/google/status       — estado da ligação Google
 * DELETE /api/integrations/google            — desliga conta Google
 *
 * GET  /api/integrations/instagram/auth      — URL de autorização Instagram Login
 * GET  /api/integrations/instagram/callback  — callback OAuth Instagram Login
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
import { encrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';
import {
  subscribeInstagramAccount,
  exchangeInstagramCode,
  exchangeLongLivedToken,
  getInstagramProfile,
} from '../lib/instagram.js';

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

// ── Instagram Connect (Instagram API with Instagram Login) ───────────────────
//
// MIGRAÇÃO (11/09/2026): substituído o fluxo antigo via Login do Facebook
// (FB.login SDK + Business Login config_id, token EAA..., exigia uma Página
// do Facebook ligada e a permissão pages_manage_metadata para receber
// webhooks — nunca aprovada) por este fluxo: o cliente autentica DIRETAMENTE
// com a conta Instagram dele, sem Página nenhuma envolvida. Ver
// backend/src/lib/instagram.ts para a explicação completa e os detalhes de
// cada chamada. Contas ligadas pelo fluxo antigo precisam de reconectar por
// aqui — decisão tomada a 11/09 (substituição total, não coexistência).
//
// Variáveis de ambiente necessárias (diferentes de FACEBOOK_APP_ID/SECRET):
//   INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET — Meta App Dashboard > Instagram >
//   API setup with Instagram Login > Business login settings.
//   INSTAGRAM_REDIRECT_URI (opcional — default: {BACKEND_URL}/api/integrations/instagram/callback)

/**
 * Cifra um token do Instagram antes de guardar, no mesmo formato "iv:ciphertext"
 * usado em agents.service.ts. Sem isto, o token ficava em texto simples na BD
 * e o decrypt() no webhook falhava (split(':') não encontrava um par iv/ciphertext
 * válido) — TypeError ao tentar responder a DMs do Instagram.
 */
async function encryptTokenForTenant(tenantId: string, token: string): Promise<string> {
  const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { encryptionKey: true } });
  const dataKey = unwrapDataKey(tenantRecord?.encryptionKey);
  if (!dataKey) {
    console.warn(`[Instagram] Sem chave de encriptação para tenant=${tenantId} — a guardar token sem cifrar (não devia acontecer)`);
    return token;
  }
  const { ciphertext, iv } = encrypt(token, dataKey);
  return `${iv}:${ciphertext}`;
}

// GET /api/integrations/instagram/auth?agentId=X
// Devolve o URL do diálogo OAuth do Instagram Login
router.get('/instagram/auth', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.query as { agentId?: string };
  if (!agentId) { res.status(400).json({ error: 'agentId obrigatório' }); return; }

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    res.status(503).json({ error: 'INSTAGRAM_APP_ID não configurado nas variáveis de ambiente' });
    return;
  }

  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId: req.tenant!.id } });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }

  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/integrations/instagram/callback`;

  const state = Buffer.from(JSON.stringify({ tenantId: req.tenant!.id, agentId })).toString('base64url');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // instagram_business_basic é a permissão-base; instagram_business_manage_messages
    // habilita o envio/receção de DMs (ver instagram.ts, subscribeInstagramAccount).
    scope: 'instagram_business_basic,instagram_business_manage_messages',
    state,
  });

  res.json({ url: `https://www.instagram.com/oauth/authorize?${params}` });
}));

// GET /api/integrations/instagram/callback?code=X&state=X
// Callback chamado pelo Instagram após o login — sem authenticate middleware
router.get('/instagram/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/dashboard?ig=error&reason=${encodeURIComponent(error_description ?? error ?? 'missing_params')}`);
  }

  let tenantId: string;
  let agentId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as Record<string, string>;
    tenantId = decoded.tenantId;
    agentId  = decoded.agentId;
    if (!tenantId || !agentId) throw new Error('invalid');
  } catch {
    return res.redirect(`${frontendUrl}/dashboard?ig=error&reason=invalid_state`);
  }

  const appId     = process.env.INSTAGRAM_APP_ID ?? '';
  const appSecret = process.env.INSTAGRAM_APP_SECRET ?? '';
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/integrations/instagram/callback`;

  if (!appId || !appSecret) {
    console.error('[Instagram OAuth] INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET em falta nas variáveis de ambiente');
    return res.redirect(`${frontendUrl}/dashboard/${agentId}?ig=error&reason=not_configured`);
  }

  console.log(`[Instagram OAuth] appId=${appId} redirectUri=${redirectUri}`);

  try {
    // 1. Troca code por access_token de curta duração + Instagram-scoped User ID
    const exchanged = await exchangeInstagramCode(code, redirectUri, appId, appSecret);
    if (!exchanged) throw new Error('Falha na troca do code por access_token');

    // 2. Converte para long-lived token (60 dias)
    const longLived = await exchangeLongLivedToken(exchanged.accessToken, appSecret);
    const longToken = longLived?.accessToken ?? exchanged.accessToken;
    const expiresAt = longLived ? new Date(Date.now() + longLived.expiresIn * 1000) : null;
    if (!longLived) {
      console.warn('[Instagram OAuth] Long-lived token exchange falhou — a usar token de curta duração (expira em ~1h, vai falhar em breve)');
    }

    // 3. Perfil (username, para mostrar no dashboard)
    const profile = await getInstagramProfile(longToken);
    const igAccountId = profile?.userId ?? exchanged.userId;
    const igName = profile?.username ?? profile?.name ?? '';

    // 4. Guarda no agente (instagramPageId fica a null — Instagram Login não usa Página)
    const encryptedToken = await encryptTokenForTenant(tenantId, longToken);
    await (prisma.agent as any).update({
      where: { id: agentId, tenantId },
      data: {
        instagramToken: encryptedToken,
        instagramAccountId: igAccountId,
        instagramTokenExpiresAt: expiresAt,
        instagramPageId: null,
        instagramEnabled: true,
      },
    });

    // 5. Subscreve a conta para receber webhooks (mensagens, comentários, menções) —
    // sem isto a Meta não entrega nenhum evento desta conta ao nosso webhook.
    const subscribed = await subscribeInstagramAccount(igAccountId, longToken);
    if (!subscribed) {
      console.warn(`[Instagram OAuth] Não foi possível subscrever a conta ${igAccountId} aos webhooks — verifica se instagram_business_manage_messages já está aprovada no App Review.`);
    }

    console.log(`[Instagram] Conta ligada via Instagram Login: igAccountId=${igAccountId} name=${igName} agentId=${agentId}`);
    return res.redirect(
      `${frontendUrl}/dashboard/${agentId}?ig=success&igId=${igAccountId}&name=${encodeURIComponent(igName)}${subscribed ? '' : '&warn=webhook_subscribe_failed'}`,
    );
  } catch (err) {
    console.error('[Instagram OAuth] callback error:', err);
    return res.redirect(`${frontendUrl}/dashboard/${agentId}?ig=error&reason=token_exchange`);
  }
}));

export default router;
