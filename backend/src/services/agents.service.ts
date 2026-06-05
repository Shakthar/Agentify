import prisma from '../lib/prisma.js';
import { PLAN_LIMITS, ALLOWED_MODELS } from '../types/index.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

interface AgentSkills {
  handoff?: boolean;
  dataCollection?: boolean;
  scheduling?: boolean;
  fileUpload?: boolean;
  humorDetection?: boolean;
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
  webChatEnabled?: boolean;
  emailEnabled?: boolean;
  offHoursMessage?: string;
  offHourStart?: string;
  offHourEnd?: string;
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

  const { skills, ...agentData } = input;

  return prisma.agent.create({
    data: {
      tenantId: tenant.id,
      ...agentData,
      skillHandoff: skills?.handoff ?? true,
      skillDataCollection: skills?.dataCollection ?? true,
      skillScheduling: skills?.scheduling ?? false,
      skillFileUpload: skills?.fileUpload ?? false,
      skillHumorDetection: skills?.humorDetection ?? false,
    },
  });
}

export async function getAgent(tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
  });
  if (!agent) {
    throw new NotFoundError('Agent not found');
  }

  return {
    ...agent,
    skills: {
      handoff: agent.skillHandoff,
      dataCollection: agent.skillDataCollection,
      scheduling: agent.skillScheduling,
      fileUpload: agent.skillFileUpload,
      humorDetection: agent.skillHumorDetection,
    },
    statistics: {
      totalConversations: agent.totalConversations,
      totalMessages: agent.totalMessages,
      averageResolution: agent.averageResolution,
    },
  };
}

export async function updateAgent(
  tenant: { id: string; plan: string },
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

  const { skills, ...updateData } = input;
  const skillsUpdate = skills
    ? {
        skillHandoff: skills.handoff,
        skillDataCollection: skills.dataCollection,
        skillScheduling: skills.scheduling,
        skillFileUpload: skills.fileUpload,
        skillHumorDetection: skills.humorDetection,
      }
    : {};

  return prisma.agent.update({
    where: { id: agentId },
    data: { ...updateData, ...skillsUpdate },
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

  return { id: agent.id, isActive: agent.isActive };
}
