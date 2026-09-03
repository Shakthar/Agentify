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
import { encrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';

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

// ── Instagram Connect (via FB.login SDK — token direto do frontend) ──────────

const FB_GRAPH = 'https://graph.facebook.com';
// A troca inicial do code por access_token usa sempre graph.facebook.com (infraestrutura
// OAuth partilhada). Mas para o login "Instagram API with Instagram Login" (standalone,
// sem Pagina do Facebook — o que esta app usa), TODAS as chamadas seguintes com esse token
// (obter o perfil, trocar por long-lived token) tem de ir para graph.instagram.com. Chamar
// graph.facebook.com/me com este tipo de token nao da erro — devolve 200 — mas devolve a
// identidade errada (ex: um "System User" do Business Manager em vez da conta Instagram
// ligada), o que fazia o instagramAccountId guardado nunca bater certo com o pageId que
// chega nos webhooks.
const IG_GRAPH = 'https://graph.instagram.com';

/**
 * Cifra um token do Instagram/Facebook antes de guardar, no mesmo formato
 * "iv:ciphertext" usado em agents.service.ts. Sem isto, o token ficava em
 * texto simples na BD e o decrypt() no webhook falhava (split(':') não
 * encontrava um par iv/ciphertext válido) — TypeError ao tentar responder
 * a DMs do Instagram.
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

// POST /api/integrations/instagram/connect
// Recebe o accessToken do FB SDK, obtém o IG User ID e guarda no agente
router.post('/instagram/connect', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token, code, agentId } = req.body as { token?: string; code?: string; agentId?: string };
  if ((!token && !code) || !agentId) { res.status(400).json({ error: 'token ou code + agentId obrigatórios' }); return; }

  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId: req.tenant!.id } });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }

  const appId     = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID ?? '';
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? process.env.META_APP_SECRET ?? '';

  let accessToken = token ?? '';

  // Se recebemos code (Instagram Login for Business), trocamos por access_token.
  // Este 'code' vem do popup do FB.login() (JS SDK) — NÃO do fluxo de redirect
  // (/api/integrations/facebook/auth + /callback). O SDK não usa o FACEBOOK_REDIRECT_URI
  // do backend como redirect_uri no dialog OAuth interno, por isso a troca do code tem de
  // usar redirect_uri vazio para bater certo com o que foi usado no pedido original —
  // caso contrário a Meta devolve "Error validating verification code ... redirect_uri"
  // (OAuthException code 100, subcode 36008).
  if (code && !accessToken) {
    const codeResp = await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: '',
      code,
    }));
    const codeData = await codeResp.json() as Record<string, unknown>;
    console.log(`[Instagram Connect] code exchange status=${codeResp.status}:`, JSON.stringify(codeData).slice(0, 300));
    if (codeData.access_token) {
      accessToken = codeData.access_token as string;
    } else {
      // Desktop app fallback: Instagram Login for Business pode devolver access_token diretamente no code
      // Se falhar, reporta o erro mas continua sem token (vai falhar mais abaixo)
      console.warn('[Instagram] Code exchange falhou, sem access_token:', codeData);
    }
  }

  if (!accessToken) {
    res.status(400).json({ error: 'Não foi possível obter access_token do Instagram' });
    return;
  }

  // Obtém o Instagram User ID via /me — TEM de ser graph.instagram.com para este tipo de
  // login (Instagram API with Instagram Login), senão devolve a identidade errada (ver nota
  // acima do IG_GRAPH). user_id é o ID que aparece nos webhooks; id é um ID de app, não usar.
  const meResp = await fetch(`${IG_GRAPH}/v21.0/me?fields=user_id,id,username,name&access_token=${accessToken}`);
  const meData = await meResp.json() as Record<string, string>;
  console.log(`[Instagram Connect] /me status=${meResp.status}:`, JSON.stringify(meData).slice(0, 300));
  if (!meResp.ok || (!meData.user_id && !meData.id)) {
    res.status(400).json({ error: 'Token inválido ou sem permissão para obter perfil Instagram' });
    return;
  }

  const igAccountId = meData.user_id ?? meData.id;
  const igName = meData.username ?? meData.name ?? '';

  // Troca por long-lived token (60 dias). Para tokens do Instagram API with Instagram Login,
  // isto usa o endpoint e o grant_type próprios do Instagram (ig_exchange_token em
  // graph.instagram.com com o Instagram App Secret), não o fb_exchange_token do Facebook.
  const igAppSecret = process.env.INSTAGRAM_APP_SECRET ?? appSecret;
  let longToken = accessToken;
  if (igAppSecret) {
    const longResp = await fetch(`${IG_GRAPH}/access_token?` + new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: igAppSecret,
      access_token: accessToken,
    }));
    const longData = await longResp.json() as Record<string, unknown>;
    console.log(`[Instagram Connect] long-lived token exchange status=${longResp.status}:`, JSON.stringify(longData).slice(0, 200));
    if (longData.access_token) longToken = longData.access_token as string;
    else console.warn('[Instagram] Long-lived token exchange falhou, a usar token de curta duração:', longData);
  }

  const encryptedToken = await encryptTokenForTenant(req.tenant!.id, longToken);

  await (prisma.agent as any).update({
    where: { id: agentId, tenantId: req.tenant!.id },
    data: { instagramToken: encryptedToken, instagramAccountId: igAccountId, instagramEnabled: true },
  });

  console.log(`[Instagram] Conta ligada: igAccountId=${igAccountId} name=${igName} agentId=${agentId}`);
  res.json({ success: true, igAccountId, name: igName });
}));

// ── Facebook Login OAuth redirect (mantido para compatibilidade) ──────────────

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

  console.log(`[Facebook OAuth] appId=${appId} secretPrefix=${appSecret.slice(0, 6)}*** redirectUri=${redirectUri}`);

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

    // 2. Converte para long-lived token (60 dias) — endpoint e grant_type do Instagram,
    // não os do Facebook (ver nota junto a IG_GRAPH mais acima no ficheiro).
    const igAppSecret = process.env.INSTAGRAM_APP_SECRET ?? appSecret;
    const longResp = await fetch(`${IG_GRAPH}/access_token?` + new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: igAppSecret,
      access_token: shortToken,
    }));
    const longData = await longResp.json() as Record<string, unknown>;
    const longToken = (longData.access_token as string) ?? shortToken;

    // 3. Obtém o Instagram User ID via /me — graph.instagram.com, não graph.facebook.com
    // (senão devolve a identidade errada, ver nota acima).
    const meResp = await fetch(`${IG_GRAPH}/v21.0/me?fields=user_id,id,username,name&access_token=${longToken}`);
    const meData = await meResp.json() as Record<string, string>;
    const igAccountId = meData.user_id ?? meData.id ?? '';
    const igName = meData.username ?? meData.name ?? '';

    // 4. Guarda no agente (token long-lived do utilizador, ID da conta Instagram)
    const encryptedToken = await encryptTokenForTenant(tenantId, longToken);
    await (prisma.agent as any).update({
      where: { id: agentId, tenantId },
      data: {
        instagramToken: encryptedToken,
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
