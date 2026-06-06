import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  tenant?: {
    id: string;
    email: string;
    plan: string;
    creditsTotal: number;
    creditsUsed: number;
    isAdmin: boolean;
  };
}

export interface JWTPayload {
  tenantId: string;
  email: string;
  plan: string;
  iat?: number;
  exp?: number;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  skills?: {
    handoff?: boolean;
    dataCollection?: boolean;
    scheduling?: boolean;
    fileUpload?: boolean;
    humorDetection?: boolean;
  };
  whatsappEnabled?: boolean;
  whatsappNumber?: string;
  webChatEnabled?: boolean;
  emailEnabled?: boolean;
  offHoursMessage?: string;
  offHourStart?: string;
  offHourEnd?: string;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {}

export interface CreateConversationInput {
  agentId: string;
  channelType: string;
  visitorId?: string;
  externalId?: string;
}

export interface SendMessageInput {
  content: string;
  role: 'user' | 'assistant';
}

export type Plan = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

/**
 * Limites por plano.
 * - free: créditos concedidos UMA VEZ no signup, nunca resetam.
 *         Para obter mais, o utilizador tem de fazer upgrade.
 * - starter/pro/business/enterprise: créditos resetam mensalmente
 *         via webhook do Stripe (implementação pendente).
 */
export const PLAN_LIMITS: Record<Plan, { agents: number; credits: number; conversations: number; paymentSkillCost: number | null }> = {
  free:       { agents: 3,   credits: 3000,  conversations: 100,      paymentSkillCost: null },  // null = bloqueado
  starter:    { agents: 10,  credits: 10000, conversations: Infinity, paymentSkillCost: 25  },  // 25 créditos/transação
  pro:        { agents: 20,  credits: 30000, conversations: Infinity, paymentSkillCost: 15  },  // 15 créditos/transação
  business:   { agents: 30,  credits: 60000, conversations: Infinity, paymentSkillCost: 0   },  // incluído
  enterprise: { agents: 999, credits: 75000, conversations: Infinity, paymentSkillCost: 0   },  // incluído
};

export const ALLOWED_MODELS: Record<Plan, string[]> = {
  free:       ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini'],
  starter:    ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929'],
  pro:        ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'gpt-4o'],
  business:   ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'gpt-4o', 'gemini-1.5-pro'],
  enterprise: ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'gpt-4o', 'gemini-1.5-pro', 'claude-opus-4-5-20251101'],
};

export const TOKEN_COSTS: Record<string, number> = {
  'claude-haiku-4-5-20251001':  1,
  'gpt-4o-mini':                1,
  'claude-sonnet-4-5-20250929': 3,
  'gpt-4o':                     5,
  'gemini-1.5-pro':             4,
  'claude-opus-4-5-20251101':   15,
};
