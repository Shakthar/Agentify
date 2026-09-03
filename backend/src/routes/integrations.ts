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
// O config_id usado no FB.login (Business Login) devolve um token EAA... normal do
// Facebook — graph.instagram.com REJEITA este token ("Cannot parse access token"), por
// isso todas as chamadas continuam em graph.facebook.com. O problema não é o host: é que
// /me com este tipo de token devolve o System User da app (o "dono" do token), não a
// conta Instagram que o utilizador concedeu no ecrã de consentimento. Para descobrir qual
// conta Instagram foi concedida, a forma correta é inspecionar os granular_scopes do
// próprio token via /debug_token (ver findGrantedInstagramAccountId abaixo).

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

/**
 * Descobre o Instagram Account ID concedido pelo utilizador durante o consentimento do
 * Business Login. Confirmado contra a documentação oficial da Meta (Login do Facebook
 * para Empresas, configuração de "token de acesso do usuário do sistema"): este config_id
 * devolve um Business Integration System User Access Token — por isso /me devolve o System
 * User da app ("Agentfy System User"), não a conta Instagram escolhida.
 *
 * Testámos 3 mecanismos, do mais para o menos confiável (o 2º falhou em produção com
 * "missing permissions" porque o token de System User não tem acesso de leitura ao
 * Business Manager do cliente, apenas aos scopes de página/instagram concedidos):
 *
 *   1. GET /me/accounts?fields=instagram_business_account — lista as Páginas de Facebook
 *      concedidas a este token (scope pages_show_list) e, para cada uma, o campo
 *      instagram_business_account devolve o IGUser ligado a essa Página (scope
 *      instagram_basic). Mecanismo clássico e mais amplamente documentado para ligar
 *      Página <-> Conta Instagram, sem depender de acesso ao Business Manager.
 *   2. GET /me?fields=client_business_id + GET /{client_business_id}/instagram_accounts
 *      — requer permissão business_management sobre esse negócio.
 *   3. Reserva: /debug_token e os granular_scopes, equivalente para tokens de utilizador.
 */
async function findGrantedInstagramAccountId(accessToken: string, appId: string, appSecret: string): Promise<{ id: string; name: string } | undefined> {
  // 1. Páginas concedidas → instagram_business_account (mecanismo principal)
  const pagesResp = await fetch(`${FB_GRAPH}/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`);
  const pagesData = await pagesResp.json() as { data?: Array<{ id: string; name?: string; instagram_business_account?: { id: string } }>; error?: unknown };
  console.log(`[Instagram Connect] me/accounts status=${pagesResp.status}:`, JSON.stringify(pagesData).slice(0, 800));

  for (const page of pagesData.data ?? []) {
    if (page.instagram_business_account?.id) {
      const igId = page.instagram_business_account.id;
      const igResp = await fetch(`${FB_GRAPH}/v21.0/${igId}?fields=username&access_token=${accessToken}`);
      const igData = await igResp.json() as { username?: string; error?: unknown };
      console.log(`[Instagram Connect] ig account ${igId} status=${igResp.status}:`, JSON.stringify(igData).slice(0, 300));
      return { id: igId, name: igData.username ?? page.name ?? '' };
    }
  }

  // 2. client_business_id → instagram_accounts (reserva)
  const meResp = await fetch(`${FB_GRAPH}/v21.0/me?fields=client_business_id,name&access_token=${accessToken}`);
  const meData = await meResp.json() as { client_business_id?: string; name?: string; error?: unknown };
  console.log(`[Instagram Connect] /me (client_business_id) status=${meResp.status}:`, JSON.stringify(meData).slice(0, 300));

  if (meData.client_business_id) {
    const igListResp = await fetch(`${FB_GRAPH}/v21.0/${meData.client_business_id}/instagram_accounts?fields=id,username&access_token=${accessToken}`);
    const igListData = await igListResp.json() as { data?: Array<{ id: string; username?: string }>; error?: unknown };
    console.log(`[Instagram Connect] instagram_accounts status=${igListResp.status}:`, JSON.stringify(igListData).slice(0, 500));
    if (igListData.data?.length) {
      const first = igListData.data[0];
      return { id: first.id, name: first.username ?? meData.name ?? '' };
    }
  }

  // 3. Reserva final: granular_scopes via /debug_token (tokens de utilizador, não de sistema)
  const debugResp = await fetch(`${FB_GRAPH}/debug_token?` + new URLSearchParams({
    input_token: accessToken,
    access_token: `${appId}|${appSecret}`,
  }));
  const debugData = await debugResp.json() as { data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } };
  const relevantScopes = ['instagram_manage_messages', 'instagram_basic', 'instagram_manage_comments', 'instagram_content_publish'];
  const scopes = debugData.data?.granular_scopes ?? [];
  // Log só os scopes relevantes (filtrado) para não sermos cortados pelo tamanho do array completo.
  console.log(`[Instagram Connect] debug_token status=${debugResp.status} granular_scopes(relevantes)=`, JSON.stringify(scopes.filter(s => relevantScopes.includes(s.scope))));

  for (const scope of scopes) {
    if (relevantScopes.includes(scope.scope) && scope.target_ids?.length) {
      return { id: scope.target_ids[0], name: meData.name ?? '' };
    }
  }
  return undefined;
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

  // Descobre a conta Instagram concedida (ver findGrantedInstagramAccountId acima).
  const granted = await findGrantedInstagramAccountId(accessToken, appId, appSecret);
  if (!granted) {
    res.status(400).json({
      error: 'Não foi possível identificar automaticamente a conta Instagram concedida. '
        + 'Introduz o Instagram Account ID manualmente no campo abaixo (consulta os logs do servidor '
        + 'para diagnosticar, se precisares).',
    });
    return;
  }
  const { id: igAccountId, name: igName } = granted;

  // Troca por long-lived token (60 dias) — endpoint do Facebook, como a troca do code
  // (graph.instagram.com rejeita este token por completo, ver nota acima de FB_GRAPH).
  let longToken = accessToken;
  if (appId && appSecret) {
    const longResp = await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: accessToken,
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

    // 2. Converte para long-lived token (60 dias) — endpoint do Facebook
    // (graph.instagram.com rejeita este token por completo, ver nota junto a FB_GRAPH).
    const longResp = await fetch(`${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    }));
    const longData = await longResp.json() as Record<string, unknown>;
    const longToken = (longData.access_token as string) ?? shortToken;

    // 3. Descobre a conta Instagram concedida (ver findGrantedInstagramAccountId acima).
    const granted = await findGrantedInstagramAccountId(longToken, appId, appSecret);
    const igAccountId = granted?.id ?? '';
    const igName = granted?.name ?? '';

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
