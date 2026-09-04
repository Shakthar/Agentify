import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as agentsService from '../services/agents.service.js';

const router = Router();
router.use(authenticate);

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(10).max(10000),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(100).max(8000).optional().default(2000),
  skills: z.object({
    handoff: z.boolean().optional(),
    dataCollection: z.boolean().optional(),
    scheduling: z.boolean().optional(),
    fileUpload: z.boolean().optional(),
    humorDetection: z.boolean().optional(),
  }).optional(),
  whatsappEnabled: z.boolean().optional().default(false),
  whatsappNumber: z.string().max(40).optional(),
  whatsappToken: z.string().min(20).max(500).optional(),
  webChatEnabled: z.boolean().optional().default(true),
  whitelabelEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional().default(false),
  offHoursMessage: z.string().max(500).optional(),
  offHourStart: z.string().optional(),
  offHourEnd: z.string().optional(),
  // Skill toggles directos (usados pelo Skills tab)
  skillHandoff:        z.boolean().optional(),
  skillDataCollection: z.boolean().optional(),
  skillScheduling:     z.boolean().optional(),
  skillFileUpload:     z.boolean().optional(),
  skillHumorDetection: z.boolean().optional(),
  skillVendas:         z.boolean().optional(),
  testMode:            z.boolean().optional(),
  languageMode:        z.string().optional(),
  ratingEnabled:       z.boolean().optional(),
  proactiveEnabled:    z.boolean().optional(),
  proactiveMaxPerDay:  z.number().int().min(1).max(500).optional(),
  proactiveMonthBudget: z.number().int().min(1).max(5000).optional(),
  followUpEnabled:     z.boolean().optional(),
  followUpHours:       z.number().int().min(1).max(168).optional(),
  followUpMessage:     z.string().max(1000).optional(),
  alertEmail:          z.string().email().optional().or(z.literal('')),
  alertHandoffThreshold:    z.number().int().min(1).optional(),
  alertResolutionThreshold: z.number().int().min(1).max(100).optional(),
  alertWeeklyReport:   z.boolean().optional(),
  crmEnabled:          z.boolean().optional(),
  instagramEnabled:    z.boolean().optional(),
  instagramAccountId:  z.string().optional(),
  instagramPageId:     z.string().optional(),
  instagramToken:      z.string().min(20).max(500).optional(),
  telegramEnabled:     z.boolean().optional(),
  telegramBotToken:    z.string().min(20).max(200).optional(),
  calendarEnabled:     z.boolean().optional(),
  calendarId:          z.string().optional(),
});

const updateAgentSchema = createAgentSchema.partial();

// GET /api/agents
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await agentsService.listAgents(req.tenant!.id, {
    skip: parseInt(req.query.skip as string) || 0,
    take: parseInt(req.query.take as string) || 10,
    search: req.query.search as string | undefined,
  });
  res.json(result);
}));

// POST /api/agents
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Validation failed', parsed.error.flatten());
  }
  const agent = await agentsService.createAgent(req.tenant!, parsed.data);
  res.status(201).json(agent);
}));

// GET /api/agents/:id
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const agent = await agentsService.getAgent(req.tenant!.id, req.params.id);
  res.json(agent);
}));

// PATCH /api/agents/:id
router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateAgentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('Validation failed', parsed.error.flatten());
  }
  const agent = await agentsService.updateAgent(req.tenant!, req.params.id, parsed.data);
  res.json(agent);
}));

// DELETE /api/agents/:id
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await agentsService.deleteAgent(req.tenant!.id, req.params.id);
  res.status(204).send();
}));

// PATCH /api/agents/:id/toggle
router.patch('/:id/toggle', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await agentsService.toggleAgent(req.tenant!.id, req.params.id);
  res.json(result);
}));

// GET /api/agents/:id/export-csv
router.get('/:id/export-csv', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prismaD = await import('../lib/prisma.js');
  const conversations = await prismaD.default.conversation.findMany({
    where: { agentId: req.params.id, tenantId: req.tenant!.id },
    include: { messages: { orderBy: { createdAt: 'asc' } as any } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const bom = '\xEF\xBB\xBF';
  const header = 'ID,Data,Canal,Visitante,Mensagens,Tokens,Resolvido,Avaliacao,Texto';
  const rows = conversations.map((c: any) => {
    const d = new Date(c.createdAt).toISOString().slice(0, 10);
    const name = (c.visitorName ?? c.visitorId ?? '').replace(/,/g, ' ');
    const txt = (c.ratingText ?? '').replace(/,/g, ' ').replace(/\n/g, ' ');
    return `${c.id},${d},${c.channelType},${name},${c._count?.messages ?? 0},${c.tokensUsed},${c.resolved ? 'sim' : 'nao'},${c.rating ?? ''},${txt}`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="conversas-${req.params.id}.csv"`);
  res.send(bom + [header, ...rows].join('\n'));
}));

// POST /api/agents/:id/conversations/:convId/rate
router.post('/:id/conversations/:convId/rate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { rating, ratingText } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new BadRequestError('Rating 1-5');
  const prismaD = await import('../lib/prisma.js');
  const conv = await prismaD.default.conversation.findFirst({ where: { id: req.params.convId, tenantId: req.tenant!.id } });
  if (!conv) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await prismaD.default.conversation.update({
    where: { id: req.params.convId },
    data: { rating: Number(rating), ratingText: ratingText ?? null } as any,
  });
  res.json(updated);
}));

// POST /api/agents/:id/whatsapp/register
// Chama o endpoint da Meta Graph API para activar o número (passo 3 obrigatório)
router.post('/:id/whatsapp/register', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { pin } = req.body as { pin?: string };
  if (!pin || !/^\d{6}$/.test(pin)) {
    throw new BadRequestError('PIN deve ter exactamente 6 dígitos numéricos');
  }
  const prismaD = await import('../lib/prisma.js');
  const agent = await prismaD.default.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }
  const phoneNumberId = (agent as any).whatsappNumber;
  if (!phoneNumberId) throw new BadRequestError('Phone Number ID não configurado neste agente');
  const token: string | undefined = (agent as any).whatsappToken ?? process.env.WHATSAPP_TOKEN;
  if (!token) throw new BadRequestError('Token WhatsApp não configurado');

  const version = process.env.WHATSAPP_API_VERSION ?? 'v20.0';
  const metaRes = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  });
  const metaBody = await metaRes.json() as Record<string, unknown>;
  if (!metaRes.ok) {
    res.status(400).json({ error: 'Erro da Meta API', details: metaBody });
    return;
  }
  res.json({ success: true, meta: metaBody });
}));

// POST /api/agents/:id/whatsapp/embedded-signup
// Troca o code do Embedded Signup por um access token permanente e guarda no agente.
router.post('/:id/whatsapp/embedded-signup', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) throw new BadRequestError('code em falta');
  const prismaD = await import('../lib/prisma.js');
  const agent = await prismaD.default.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }

  const appId = process.env.META_APP_ID ?? '4098020310452947';
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error('META_APP_SECRET não configurado');

  // Trocar code por access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v26.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
  );
  const tokenBody = await tokenRes.json() as { access_token?: string; error?: { message?: string } };
  if (!tokenRes.ok || !tokenBody.access_token) {
    const errMsg = tokenBody.error?.message ?? 'Erro ao trocar token com a Meta';
    res.status(400).json({ error: errMsg }); return;
  }
  const accessToken = tokenBody.access_token;

  // Guardar token no agente
  await (prismaD.default.agent as any).update({
    where: { id: agent.id },
    data: { whatsappToken: accessToken, whatsappEnabled: true },
  });

  // Devolver phoneNumberId se conhecido (pode vir no body do frontend)
  const { phoneNumberId } = req.body as { phoneNumberId?: string };
  if (phoneNumberId) {
    await (prismaD.default.agent as any).update({
      where: { id: agent.id },
      data: { whatsappNumber: phoneNumberId },
    });
  }

  res.json({ success: true, phoneNumberId: phoneNumberId ?? null });
}));

// POST /api/agents/:id/briefing
// IA analisa as conversas recentes e responde ao dono sobre o que precisa de atenção.
// Suporta conversa contínua: o owner envia mensagens, o agente responde com contexto das suas conversas.
router.post('/:id/briefing', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { message, history } = req.body as {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const prismaD = await import('../lib/prisma.js');
  const agent = await prismaD.default.agent.findFirst({
    where: { id: req.params.id, tenantId: req.tenant!.id },
  });
  if (!agent) { res.status(404).json({ error: 'Agente não encontrado' }); return; }

  // Últimas 48h de conversas
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const [conversations, leads, flagged] = await Promise.all([
    prismaD.default.conversation.findMany({
      where: { agentId: agent.id, tenantId: req.tenant!.id, createdAt: { gte: since } },
      include: { messages: { orderBy: { createdAt: 'desc' } as any, take: 2 } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    (prismaD.default as any).crmContact.findMany({
      where: { agentId: agent.id, tenantId: req.tenant!.id, status: 'lead' },
      orderBy: { lastSeenAt: 'desc' },
      take: 20,
    }),
    prismaD.default.conversation.findMany({
      where: { agentId: agent.id, tenantId: req.tenant!.id, flaggedForOwner: true, resolved: false } as any,
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, visitorName: true, visitorId: true, channelType: true, createdAt: true, urgency: true } as any,
    }),
  ]);

  const pending   = conversations.filter((c: any) => !c.resolved);
  const handedOff = conversations.filter((c: any) => c.handedOffToHuman);

  const flaggedLines = (flagged as any[]).slice(0, 5).map((c: any) =>
    `• 🔴 LEAD/ALERTA: ${c.visitorName ?? c.visitorId ?? 'Anónimo'} via ${c.channelType} (${new Date(c.createdAt).toLocaleDateString('pt-PT')})`
  ).join('\n');

  const convLines = conversations.slice(0, 15).map((c: any) => {
    const lastMsg = (c.messages?.[0]?.content as string | undefined)?.slice(0, 80) ?? '';
    const status  = c.resolved ? 'resolvida' : (c.handedOffToHuman ? 'HANDOFF' : 'PENDENTE');
    const visitor = c.visitorName ?? c.visitorId ?? 'anónimo';
    return `• [${status}] ${visitor} via ${c.channelType} — "${lastMsg}"`;
  }).join('\n');

  const leadLines = leads.slice(0, 10).map((l: any) =>
    `• ${l.name ?? 'Sem nome'} | ${l.phone ?? '-'} | ${l.email ?? '-'} | última interação: ${l.lastSeenAt?.toISOString().slice(0, 10) ?? '-'}`,
  ).join('\n');

  const systemPrompt = `És o agente de IA "${agent.name}" da plataforma Agentfy. O teu dono está a falar contigo sobre o estado das conversas e leads.

RESUMO DAS ÚLTIMAS 48H:
- Total de conversas: ${conversations.length} | Pendentes: ${pending.length} | Handoffs: ${handedOff.length}
- Leads sinalizados a aguardar ação: ${(flagged as any[]).length}
- Leads no CRM: ${leads.length}

${(flagged as any[]).length > 0 ? `🔴 LEADS/ALERTAS QUE PRECISAM DE AÇÃO IMEDIATA:\n${flaggedLines}\n` : ''}
CONVERSAS RECENTES:
${convLines || 'Nenhuma conversa nas últimas 48 horas.'}

LEADS NO CRM:
${leadLines || 'Nenhum lead registado.'}

Responde de forma directa, concisa e útil ao teu dono. Começa sempre pelos itens urgentes/flagged se existirem. Usa bullet points quando faz sentido. Responde sempre em português. Não inventes informação além do que tens acima.`;

  const { callLLM } = await import('../lib/llm.js');
  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(history ?? []),
    { role: 'user', content: message ?? 'O que está a acontecer? O que precisa da minha atenção?' },
  ];

  const response = await callLLM('claude-haiku-4-5-20251001', systemPrompt, msgs, 800, 0.6);

  res.json({
    reply: response.content,
    stats: {
      conversations: conversations.length,
      pending: pending.length,
      handoffs: handedOff.length,
      leads: leads.length,
      flagged: (flagged as any[]).length,
    },
    flagged: (flagged as any[]).map((c: any) => ({
      id: c.id,
      visitor: c.visitorName ?? c.visitorId ?? 'Anónimo',
      channel: c.channelType,
      date: c.createdAt,
    })),
  });
}));

// PATCH /api/agents/:id/conversations/:convId/unflag — dono marca como visto
router.patch('/:id/conversations/:convId/unflag', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prismaD = await import('../lib/prisma.js');
  const conv = await prismaD.default.conversation.findFirst({
    where: { id: req.params.convId, tenantId: req.tenant!.id, agentId: req.params.id },
  });
  if (!conv) { res.status(404).json({ error: 'Not found' }); return; }
  await (prismaD.default.conversation as any).update({
    where: { id: req.params.convId },
    data: { flaggedForOwner: false },
  });
  res.json({ success: true });
}));

// GET /api/agents/:id/observe
router.get('/:id/observe', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prismaD = await import('../lib/prisma.js');
  const open = await prismaD.default.conversation.findMany({
    where: { agentId: req.params.id, tenantId: req.tenant!.id, resolved: false },
    include: { messages: { orderBy: { createdAt: 'desc' } as any, take: 5 } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ conversations: open, agentId: req.params.id });
}));

export default router;
