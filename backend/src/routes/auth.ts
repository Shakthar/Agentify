import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, loginLimiter, signupLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as authService from '../services/auth.service.js';
import { signOAuthState, verifyOAuthState, signFbLoginTicket, verifyFbLoginTicket } from '../lib/auth.js';

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
router.post('/signup', authLimiter, signupLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Validation failed', parsed.error.flatten());
  }
  const result = await authService.signup(parsed.data);
  res.status(201).json(result);
}));

// POST /api/auth/login
router.post('/login', authLimiter, loginLimiter, asyncHandler(async (req: Request, res: Response) => {
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

// ── Login com Facebook (autenticação da própria conta Agentify) ───────────────
// Distinto da ligação de contas Instagram/WhatsApp a um agente (ver
// routes/integrations.ts) — isto autentica/regista o utilizador na plataforma.

const FB_GRAPH_VERSION = 'v26.0';

// Configuração "Facebook Login for Business" (User access token, sem ativos) criada
// especificamente para este fluxo de login/registo + associação de conta na aba de
// Perfil. A Agentfy é uma app do tipo Business, por isso o diálogo OAuth clássico com
// `scope=email,public_profile` é rejeitado ("precisa de pelo menos uma supported
// permission") — apps Business têm sempre de usar uma Configuração (`config_id`) em
// vez de `scope`. `public_profile` vem sempre incluído automaticamente nesta
// configuração; só é preciso pedir `email` explicitamente ao criá-la no painel.
const FB_LOGIN_CONFIG_ID = '1802300544308849';

// GET /api/auth/facebook — devolve o URL do diálogo OAuth do Facebook
router.get('/facebook', authLimiter, asyncHandler(async (_req: Request, res: Response) => {
  const appId = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID;
  if (!appId) {
    res.status(503).json({ error: 'FACEBOOK_APP_ID não configurado nas variáveis de ambiente' });
    return;
  }

  const redirectUri = process.env.FACEBOOK_LOGIN_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/auth/facebook/callback`;

  const state = signOAuthState();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    config_id: FB_LOGIN_CONFIG_ID,
    state,
  });

  res.json({ url: `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?${params}` });
}));

// GET /api/auth/facebook/callback — troca o code por um token, obtém o perfil e
// faz login/registo do Tenant, redirecionando de volta ao frontend com um ticket
// de curta duração (nunca tokens de sessão reais no URL — ver POST /facebook/exchange).
router.get('/facebook/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  if (error) {
    res.redirect(`${frontendUrl}/?fbAuthError=${encodeURIComponent(error_description ?? error)}`);
    return;
  }
  if (!code || !state) {
    res.redirect(`${frontendUrl}/?fbAuthError=${encodeURIComponent('Pedido inválido')}`);
    return;
  }

  let oauthMode: 'login' | 'link' = 'login';
  let oauthTenantId: string | undefined;
  try {
    const parsedState = verifyOAuthState(state);
    oauthMode = parsedState.mode;
    oauthTenantId = parsedState.tenantId;
  } catch {
    res.redirect(`${frontendUrl}/?fbAuthError=${encodeURIComponent('Sessão OAuth expirada — tenta outra vez')}`);
    return;
  }

  // Fluxo de associação (aba de Perfil): erros redirecionam para o perfil, não para a home.
  const errorRedirectBase = oauthMode === 'link' ? `${frontendUrl}/dashboard/profile` : frontendUrl;
  const errorParam = oauthMode === 'link' ? 'fbLinkError' : 'fbAuthError';

  const appId = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    res.redirect(`${frontendUrl}/?fbAuthError=${encodeURIComponent('App Facebook não configurada')}`);
    return;
  }

  const redirectUri = process.env.FACEBOOK_LOGIN_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/auth/facebook/callback`;

  try {
    const tokenResp = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?` +
        new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code }),
    );
    const tokenData = await tokenResp.json() as { access_token?: string; error?: { message?: string } };
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[Facebook Login] Falha ao trocar code por token:', JSON.stringify(tokenData));
      res.redirect(`${errorRedirectBase}?${errorParam}=${encodeURIComponent('Não foi possível concluir o login com o Facebook')}`);
      return;
    }

    const profileResp = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/me?fields=id,name,email&access_token=${encodeURIComponent(tokenData.access_token)}`,
    );
    const profile = await profileResp.json() as { id?: string; name?: string; email?: string; error?: { message?: string } };
    if (!profileResp.ok || !profile.id) {
      console.error('[Facebook Login] Perfil inválido (permissão recusada):', JSON.stringify(profile));
      res.redirect(`${errorRedirectBase}?${errorParam}=${encodeURIComponent('Não foi possível obter os dados da tua conta do Facebook.')}`);
      return;
    }
    if (oauthMode === 'login' && !profile.email) {
      console.error('[Facebook Login] Perfil sem email (conta sem email verificado):', JSON.stringify(profile));
      res.redirect(`${frontendUrl}/?fbAuthError=${encodeURIComponent('A tua conta do Facebook não tem um email verificado. Usa email e password para criar conta.')}`);
      return;
    }

    if (oauthMode === 'link') {
      if (!oauthTenantId) {
        res.redirect(`${frontendUrl}/dashboard/profile?fbLinkError=${encodeURIComponent('Sessão expirada — entra novamente e tenta associar outra vez')}`);
        return;
      }
      try {
        await authService.linkFacebookAccount(oauthTenantId, profile.id, profile.email ?? '');
        res.redirect(`${frontendUrl}/dashboard/profile?fbLink=success`);
      } catch (err) {
        const message = err instanceof ConflictError ? err.message : 'Não foi possível associar a conta do Facebook';
        res.redirect(`${frontendUrl}/dashboard/profile?fbLinkError=${encodeURIComponent(message)}`);
      }
      return;
    }

    const { tenantId, requiresTwoFactor } = await authService.loginOrSignupWithFacebook({
      email: profile.email!,
      name: profile.name ?? profile.email!.split('@')[0],
      facebookId: profile.id,
    });

    const ticket = signFbLoginTicket(tenantId, requiresTwoFactor);
    res.redirect(`${frontendUrl}/?fbTicket=${encodeURIComponent(ticket)}`);
  } catch (err) {
    console.error('[Facebook Login] Erro no callback:', err);
    res.redirect(`${errorRedirectBase}?${errorParam}=${encodeURIComponent('Erro inesperado ao ligar com o Facebook')}`);
  }
}));

// POST /api/auth/facebook/exchange — troca o ticket de curta duração pelos tokens
// de sessão reais (ou pelo twoFactorToken, se a conta tiver 2FA ativo).
router.post('/facebook/exchange', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { ticket } = req.body as { ticket?: string };
  if (!ticket) throw new BadRequestError('ticket obrigatório');

  let payload: { tenantId: string; requiresTwoFactor: boolean };
  try {
    payload = verifyFbLoginTicket(ticket);
  } catch {
    throw new UnauthorizedError('Ticket inválido ou expirado — tenta o login novamente');
  }

  const result = await authService.completeFacebookLogin(payload.tenantId, payload.requiresTwoFactor);
  res.json(result);
}));

// GET /api/auth/facebook/link — devolve o URL do diálogo OAuth do Facebook para
// ASSOCIAR a conta do Facebook a um Tenant já autenticado (aba de Perfil). Usa o
// mesmo diálogo do login, mas o `state` transporta mode='link' + tenantId, para o
// callback saber que deve chamar linkFacebookAccount em vez de fazer login/registo.
router.get('/facebook/link', authenticate, authLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const appId = process.env.FACEBOOK_APP_ID ?? process.env.META_APP_ID;
  if (!appId) {
    res.status(503).json({ error: 'FACEBOOK_APP_ID não configurado nas variáveis de ambiente' });
    return;
  }

  const redirectUri = process.env.FACEBOOK_LOGIN_REDIRECT_URI
    ?? `${process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app'}/api/auth/facebook/callback`;

  const state = signOAuthState('link', req.tenant!.id);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    config_id: FB_LOGIN_CONFIG_ID,
    state,
  });

  res.json({ url: `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?${params}` });
}));

// POST /api/auth/facebook/unlink — remove a associação da conta do Facebook do Tenant atual.
router.post('/facebook/unlink', authenticate, authLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await authService.unlinkFacebookAccount(req.tenant!.id);
  res.json({ message: 'Conta do Facebook desassociada' });
}));

export default router;
