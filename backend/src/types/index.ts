import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  tenant?: {
    id: string;
    email: string;
    plan: string;
    creditsTotal: number;
    creditsUsed: number;
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

export const PLAN_LIMITS: Record<Plan, { agents: number; credits: number; conversations: number }> = {
  free:       { agents: 3,  credits: 3000,  conversations: 100 },
  starter:    { agents: 10, credits: 10000, conversations: Infinity },
  pro:        { agents: 20, credits: 30000, conversations: Infinity },
  business:   { agents: 30, credits: 60000, conversations: Infinity },
  enterprise: { agents: 999, credits: 75000, conversations: Infinity },
};

export const ALLOWED_MODELS: Record<Plan, string[]> = {
  free:       ['claude-haiku-3', 'gpt-4o-mini'],
  starter:    ['claude-haiku-3', 'gpt-4o-mini', 'claude-sonnet-4'],
  pro:        ['claude-haiku-3', 'gpt-4o-mini', 'claude-sonnet-4', 'gpt-4o'],
  business:   ['claude-haiku-3', 'gpt-4o-mini', 'claude-sonnet-4', 'gpt-4o', 'gemini-1.5-pro'],
  enterprise: ['claude-haiku-3', 'gpt-4o-mini', 'claude-sonnet-4', 'gpt-4o', 'gemini-1.5-pro', 'claude-opus-4'],
};

export const TOKEN_COSTS: Record<string, number> = {
  'claude-haiku-3':   1,
  'gpt-4o-mini':      1,
  'claude-sonnet-4':  3,
  'gpt-4o':           5,
  'gemini-1.5-pro':   4,
  'claude-opus-4':    15,
};
