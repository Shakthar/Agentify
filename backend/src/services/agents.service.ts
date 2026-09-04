import prisma from '../lib/prisma.js';
import { PLAN_LIMITS, ALLOWED_MODELS } from '../types/index.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../lib/errors.js';
import { writeAuditLog } from './admin.service.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';
import { subscribeInstagramAccount } from '../lib/instagram.js';
import crypto from 'crypto';
import { getTelegramBotInfo, setTelegramWebhook, deleteTelegramWebhook } from '../lib/telegram.js';

interface AgentSkills {
  handoff?: boolean;
  dataCollection?: boolean;
  scheduling?: boolean;
  fileUpload?: boolean;
  humorDetection?: boolean;
  vendas?: boolean;
}

interface CreateAgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  skills?: AgentSkills;
  whatsappEnabled?: boolean;
  whatsappNumber?: string;
  whatsappToken?: string;
  webChatEnabled?: boolean;
  whitelabelEnabled?: boolean;
  emailEnabled?: boolean;
  offHoursMessage?: string;
  offHourStart?: string;
  offHourEnd?: string;
  // Skill toggles directos (Skills tab)
  skillHandoff?: boolean;
  skillDataCollection?: boolean;
  skillScheduling?: boolean;
  skillFileUpload?: boolean;
  skillHumorDetection?: boolean;
  skillVendas?: boolean;
  testMode?: boolean;
  // Multi-lingua
  languageMode?: string;
  // Rating
  ratingEnabled?: boolean;
  // Proactive
  proactiveEnabled?: boolean;
  proactiveMaxPerDay?: number;
  proactiveMonthBudget?: number;
  // Follow-up
  followUpEnabled?: boolean;
  followUpHours?: number;
  followUpMessage?: string;
  // Alertas
  alertEmail?: string;
  alertHandoffThreshold?: number;
  alertResolutionThreshold?: number;
  alertWeeklyReport?: boolean;
  // CRM
  crmEnabled?: boolean;
  // Instagram
  instagramEnabled?: boolean;
  instagramAccountId?: string;
  instagramPageId?: string;
  instagramToken?: string;
  // Telegram
  telegramEnabled?: boolean;
  telegramBotToken?: string;
  // Calendar
  calendarEnabled?: boolean;
  calendarId?: string;
}

type UpdateAgentInput = Partial<CreateAgentInput>;

interface ListAgentsParams {
  skip?: number;
  take?: number;
  search?: string;
}

function assertModelAllowed(plan: string, model: string) {
  const allowed = ALLOWED_MODELS[plan as keyof typeof ALLOWED_MODELS];
  if (!allowed.includes(model)) {
    throw new ForbiddenError(`Model ${model} not available on ${plan} plan`);
  }
}

export async function listAgents(tenantId: string, params: ListAgentsParams) {
  const skip = params.skip ?? 0;
  const take = Math.min(params.take ?? 10, 50);

  const where = {
    tenantId,
    ...(params.search
      ? { name: { contains: params.search, mode: 'insensitive' as const } }
      : {}),
  };

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, description: true, model: true,
        isActive: true, totalConversations: true, totalMessages: true,
        webChatEnabled: true, whatsappEnabled: true, emailEnabled: true,
        createdAt: true,
      },
    }),
    prisma.agent.count({ where }),
  ]);

  return { agents, total };
}

export async function createAgent(
  tenant: { id: string; plan: string },
  input: CreateAgentInput,
) {
  const plan = tenant.plan as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];

  assertModelAllowed(tenant.plan, input.model);

  const agentCount = await prisma.agent.count({ where: { tenantId: tenant.id } });
  if (agentCount >= limits.agents) {
    throw new ForbiddenError(`Agent limit (${limits.agents}) reached for ${plan} plan`);
  }

  const { skills, whatsappToken, ...agentData } = input;

  // Encriptar token do WhatsApp se fornecido
  let encryptedWhatsappToken: string | undefined;
  if (whatsappToken) {
    const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { encryptionKey: true } });
    const dataKey = unwrapDataKey(tenantRecord?.encryptionKey);
    if (dataKey) {
      const { ciphertext, iv } = encrypt(whatsappToken, dataKey);
      encryptedWhatsappToken = `${iv}:${ciphertext}`;
    }
  }

  const agent = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      ...agentData,
      whatsappToken: encryptedWhatsappToken,
      skillHandoff: skills?.handoff ?? true,
      skillDataCollection: skills?.dataCollection ?? true,
      skillScheduling: skills?.scheduling ?? false,
      skillFileUpload: skills?.fileUpload ?? false,
      skillHumorDetection: skills?.humorDetection ?? false,
      skillVendas: false,
      testMode: input.testMode ?? true,
      languageMode: input.languageMode ?? 'auto',
      ratingEnabled: input.ratingEnabled ?? true,
      proactiveEnabled: false,
      followUpEnabled: false,
      alertWeeklyReport: false,
      crmEnabled: false,
      instagramEnabled: false,
      calendarEnabled: false,
    },
  });

  writeAuditLog(tenant.id, 'agent_created', 'agent', agent.id, { name: agent.name, model: agent.model });
  return agent;
}

export async function getAgent(tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
  });
  if (!agent) {
    throw new NotFoundError('Agent not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { whatsappToken: _omitWA, instagramToken: _omitIG, telegramBotToken: _omitTG, ...safeAgent } = agent as any;
  return {
    ...safeAgent,
    testMode: agent.testMode,
    whatsappTokenConfigured: !!agent.whatsappToken,
    instagramTokenConfigured: !!agent.instagramToken,
    telegramBotTokenConfigured: !!(agent as any).telegramBotToken,
    skills: {
      handoff: agent.skillHandoff,
      dataCollection: agent.skillDataCollection,
      scheduling: agent.skillScheduling,
      fileUpload: agent.skillFileUpload,
      humorDetection: agent.skillHumorDetection,
      vendas: agent.skillVendas,
    },
    statistics: {
      totalConversations: agent.totalConversations,
      totalMessages: agent.totalMessages,
      averageResolution: agent.averageResolution,
    },
  };
}

export async function updateAgent(
  tenant: { id: string; plan: string; isAdmin?: boolean },
  agentId: string,
  input: UpdateAgentInput,
) {
  const existing = await prisma.agent.findFirst({
    where: { id: agentId, tenantId: tenant.id },
  });
  if (!existing) {
    throw new NotFoundError('Agent not found');
  }

  if (input.model) {
    assertModelAllowed(tenant.plan, input.model);
  }

  // SECURITY: plan gate para skills e whitelabel no backend
  // (o frontend já bloqueia, mas um atacante podia chamar a API directamente)
  // Admins bypass all plan gates (test mode)
  if (!tenant.isAdmin) {
    const PLAN_ORDER = ['free', 'starter', 'business', 'enterprise'];
    const planIdx = PLAN_ORDER.indexOf(tenant.plan);

    if ((input.skillScheduling || input.skillFileUpload) && planIdx < PLAN_ORDER.indexOf('starter')) {
      throw new ForbiddenError('Skill requires Starter plan or higher');
    }
    if (input.skillHumorDetection && planIdx < PLAN_ORDER.indexOf('starter')) {
      throw new ForbiddenError('Skill requires Starter plan or higher');
    }
    if (input.skills?.scheduling && planIdx < PLAN_ORDER.indexOf('starter')) {
      throw new ForbiddenError('Skill requires Starter plan or higher');
    }
    if (input.skills?.fileUpload && planIdx < PLAN_ORDER.indexOf('starter')) {
      throw new ForbiddenError('Skill requires Starter plan or higher');
    }
    if (input.skills?.humorDetection && planIdx < PLAN_ORDER.indexOf('starter')) {
      throw new ForbiddenError('Skill requires Starter plan or higher');
    }
    if (input.whitelabelEnabled && planIdx < PLAN_ORDER.indexOf('starter')) {
      throw new ForbiddenError('Whitelabel requires Starter plan or higher');
    }
  }

  const { skills, whatsappToken, instagramToken, telegramBotToken, ...updateData } = input;

  // Encriptar tokens se fornecidos no update
  let encryptedWhatsappToken: string | undefined;
  let encryptedInstagramToken: string | undefined;
  let encryptedTelegramBotToken: string | undefined;
  if (whatsappToken || instagramToken || telegramBotToken) {
    const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { encryptionKey: true } });
    const dataKey = unwrapDataKey(tenantRecord?.encryptionKey);
    if (dataKey) {
      if (whatsappToken) {
        const { ciphertext, iv } = encrypt(whatsappToken, dataKey);
        encryptedWhatsappToken = `${iv}:${ciphertext}`;
      }
      if (instagramToken) {
        const { ciphertext, iv } = encrypt(instagramToken, dataKey);
        encryptedInstagramToken = `${iv}:${ciphertext}`;
      }
      if (telegramBotToken) {
        const { ciphertext, iv } = encrypt(telegramBotToken, dataKey);
        encryptedTelegramBotToken = `${iv}:${ciphertext}`;
      }
    }
  }

  // Se um novo token de bot do Telegram foi colado agora, valida-o e regista o
  // webhook ANTES de gravar — ao contrário do Instagram (onde a validação corre em
  // segundo plano após gravar, porque testa vários campos), aqui é uma única
  // chamada rápida à API do Telegram, por isso vale a pena ser síncrona: um token
  // errado nunca fica "guardado" sem funcionar, o cliente vê logo o erro.
  let telegramConnectData: { telegramUsername?: string; telegramWebhookSecret?: string } = {};
  if (telegramBotToken) {
    const botInfo = await getTelegramBotInfo(telegramBotToken);
    if (!botInfo) {
      throw new BadRequestError('Token do bot do Telegram inválido — confirma que copiaste o token certo do @BotFather.');
    }
    const webhookSecret = crypto.randomBytes(24).toString('hex');
    const backendUrl = process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app';
    const registered = await setTelegramWebhook(telegramBotToken, `${backendUrl}/api/webhooks/telegram/${agentId}`, webhookSecret);
    if (!registered) {
      throw new BadRequestError('Não foi possível registar o webhook do Telegram — tenta novamente dentro de alguns segundos.');
    }
    telegramConnectData = { telegramUsername: botInfo.username, telegramWebhookSecret: webhookSecret };
  }

  const skillsUpdate = skills
    ? {
        skillHandoff: skills.handoff,
        skillDataCollection: skills.dataCollection,
        skillScheduling: skills.scheduling,
        skillFileUpload: skills.fileUpload,
        skillHumorDetection: skills.humorDetection,
        skillVendas: skills.vendas,
      }
    : {};

  const updatedAgent = await prisma.agent.update({
    where: { id: agentId },
    data: {
      ...updateData,
      ...(encryptedWhatsappToken ? { whatsappToken: encryptedWhatsappToken } : {}),
      ...(encryptedInstagramToken ? { instagramToken: encryptedInstagramToken } : {}),
      ...(encryptedTelegramBotToken ? { telegramBotToken: encryptedTelegramBotToken } : {}),
      ...telegramConnectData,
      ...skillsUpdate,
    },
  });

  // Se o Instagram foi ligado/configurado manualmente (Passo 3 do dashboard, sem
  // passar pelo OAuth /instagram/connect) e agora já temos token + IDs, subscreve
  // a Página (mensagens) e a conta Instagram (comentários) aos webhooks aqui também
  // — sem isto a Meta não entrega mensagens nem comentários desta conta, mesmo com
  // o token e os IDs certos guardados.
  // Só verifica/subscreve quando este pedido tocou de facto em algo do Instagram
  // (evita chamadas desnecessárias à Meta em updates que nada têm a ver, ex.: WhatsApp).
  const touchedInstagram = instagramToken !== undefined
    || (updateData as any).instagramPageId !== undefined
    || (updateData as any).instagramAccountId !== undefined;
  const pageIdForSub = (updatedAgent as any).instagramPageId as string | undefined;
  const igAccountIdForSub = (updatedAgent as any).instagramAccountId as string | undefined;
  if (touchedInstagram && (pageIdForSub || igAccountIdForSub)) {
    let rawTokenForSub = instagramToken; // token novo, em texto simples, se foi enviado agora
    if (!rawTokenForSub && existing.instagramToken) {
      // Nenhum token novo neste pedido (ex.: só se guardou o Page ID agora) —
      // reutiliza o token já guardado, desencriptando-o.
      try {
        const tenantForDecrypt = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { encryptionKey: true } });
        const dataKeyForDecrypt = unwrapDataKey(tenantForDecrypt?.encryptionKey);
        const [ivExisting, ciphertextExisting] = existing.instagramToken.split(':');
        if (dataKeyForDecrypt && ivExisting && ciphertextExisting) {
          rawTokenForSub = decrypt(ciphertextExisting, ivExisting, dataKeyForDecrypt);
        }
      } catch (err) {
        console.error('[Instagram] Falha ao desencriptar token existente para subscrever webhooks:', err);
      }
    }
    if (rawTokenForSub && igAccountIdForSub) {
      subscribeInstagramAccount(igAccountIdForSub, pageIdForSub ?? '', rawTokenForSub).then((ok) => {
        if (!ok) console.warn(`[Instagram] Não foi possível subscrever a conta ${igAccountIdForSub} aos webhooks (agentId=${agentId}).`);
      });
    }
  } else if (instagramToken) {
    console.warn(`[Instagram] Token do Instagram guardado manualmente sem instagramPageId/instagramAccountId — não foi possível subscrever webhooks para agentId=${agentId}.`);
  }

  // Telegram: um token novo já foi validado e o webhook registado mais acima
  // (síncrono). Aqui só tratamos o caso de o cliente só mexer no toggle
  // telegramEnabled (sem colar um token novo) — reativa/remove o webhook usando
  // o token já guardado, em segundo plano (não bloqueia a resposta do PATCH).
  const telegramEnabledTouched = (updateData as any).telegramEnabled !== undefined;
  if (!telegramBotToken && telegramEnabledTouched && (existing as any).telegramBotToken) {
    const tenantForDecrypt = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { encryptionKey: true } });
    const dataKeyForDecrypt = unwrapDataKey(tenantForDecrypt?.encryptionKey);
    const [ivExisting, ciphertextExisting] = ((existing as any).telegramBotToken as string).split(':');
    let rawTokenForToggle: string | undefined;
    try {
      if (dataKeyForDecrypt && ivExisting && ciphertextExisting) {
        rawTokenForToggle = decrypt(ciphertextExisting, ivExisting, dataKeyForDecrypt);
      }
    } catch (err) {
      console.error('[Telegram] Falha ao desencriptar token existente para (des)registar webhook:', err);
    }
    if (rawTokenForToggle) {
      if ((updateData as any).telegramEnabled) {
        const backendUrl = process.env.BACKEND_URL ?? 'https://agentify-production-8d3a.up.railway.app';
        const existingSecret = (existing as any).telegramWebhookSecret as string | undefined;
        const secret = existingSecret ?? crypto.randomBytes(24).toString('hex');
        setTelegramWebhook(rawTokenForToggle, `${backendUrl}/api/webhooks/telegram/${agentId}`, secret).then((ok) => {
          if (!ok) console.warn(`[Telegram] Não foi possível reativar o webhook do bot (agentId=${agentId}).`);
        });
        if (!existingSecret) {
          prisma.agent.update({ where: { id: agentId }, data: { telegramWebhookSecret: secret } as any }).catch(() => {});
        }
      } else {
        deleteTelegramWebhook(rawTokenForToggle).catch(() => {});
      }
    }
  }

  return updatedAgent;
}

export async function deleteAgent(tenantId: string, agentId: string) {
  const existing = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
  });
  if (!existing) {
    throw new NotFoundError('Agent not found');
  }
  await prisma.agent.delete({ where: { id: agentId } });
  writeAuditLog(tenantId, 'agent_deleted', 'agent', agentId, { name: existing.name });
}

export async function toggleAgent(tenantId: string, agentId: string) {
  const existing = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
  });
  if (!existing) {
    throw new NotFoundError('Agent not found');
  }

  const agent = await prisma.agent.update({
    where: { id: agentId },
    data: { isActive: !existing.isActive },
  });

  writeAuditLog(tenantId, agent.isActive ? 'agent_activated' : 'agent_deactivated', 'agent', agentId, { isActive: agent.isActive });
  return agent;
}
