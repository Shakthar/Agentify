import prisma from '../lib/prisma.js';
import { PLAN_LIMITS, ALLOWED_MODELS } from '../types/index.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { writeAuditLog } from './admin.service.js';
import { encrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';

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
  const { whatsappToken: _omitWA, instagramToken: _omitIG, ...safeAgent } = agent;
  return {
    ...safeAgent,
    testMode: agent.testMode,
    whatsappTokenConfigured: !!agent.whatsappToken,
    instagramTokenConfigured: !!agent.instagramToken,
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

  const { skills, whatsappToken, instagramToken, ...updateData } = input;

  // Encriptar tokens se fornecidos no update
  let encryptedWhatsappToken: string | undefined;
  let encryptedInstagramToken: string | undefined;
  if (whatsappToken || instagramToken) {
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
    }
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

  return prisma.agent.update({
    where: { id: agentId },
    data: {
      ...updateData,
      ...(encryptedWhatsappToken ? { whatsappToken: encryptedWhatsappToken } : {}),
      ...(encryptedInstagramToken ? { instagramToken: encryptedInstagramToken } : {}),
      ...skillsUpdate,
    },
  });
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
