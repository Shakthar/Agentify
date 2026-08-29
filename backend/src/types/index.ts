import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  tenant?: {
    id: string;
    email: string;
    plan: string;
    creditsTotal: number;
    creditsUsed: number;
    isAdmin: boolean;
    subscriptionMethod: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: Date | null;
  };
}

export interface JWTPayload {
  tenantId: string;
  email: string;
  plan: string;
  impersonatedBy?: string;
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

export type Plan = 'free' | 'starter' | 'business' | 'enterprise';

/**
 * Limites por plano.
 * - free: 1.000 créditos concedidos UMA VEZ no signup, nunca resetam.
 *         Para obter mais, o utilizador tem de fazer upgrade.
 * - starter/business/enterprise: créditos resetam mensalmente.
 *
 * 1 Agente = 1 Número WhatsApp (relação 1:1)
 * 1 Agente PODE conectar a múltiplas plataformas (Shopify, Menu, etc.)
 */
export const PLAN_LIMITS: Record<Plan, { agents: number; credits: number; conversations: number; paymentSkillCost: number | null; waMsgCreditCost: number }> = {
  // waMsgCreditCost = créditos debitados por cada mensagem enviada via WhatsApp/Instagram API
  // Meta cobra ~R$0,035/msg; a plataforma cobra mais para ter margem.
  // Planos superiores têm custo menor por msg (benefício do plano).
  free:       { agents: 1,  credits: 1000,  conversations: Infinity, paymentSkillCost: null, waMsgCreditCost: 8  },
  starter:    { agents: 1,  credits: 5000,  conversations: Infinity, paymentSkillCost: 50,   waMsgCreditCost: 6  },
  business:   { agents: 3,  credits: 15000, conversations: Infinity, paymentSkillCost: 20,   waMsgCreditCost: 5  },
  enterprise: { agents: 10, credits: 40000, conversations: Infinity, paymentSkillCost: 10,   waMsgCreditCost: 4  },
};

export const ALLOWED_MODELS: Record<Plan, string[]> = {
  free:       ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini'],
  starter:    ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929'],
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

/**
 * Custo real da API em EUR por 1 000 tokens (input e output separados).
 * Baseado nos preços oficiais dos fornecedores (USD × 0.93 ≈ EUR, Jun 2026).
 * inputPer1K  = custo por 1 K tokens de entrada (prompt)
 * outputPer1K = custo por 1 K tokens de saída (completion)
 */
export const API_EUR_COST: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  'claude-haiku-4-5-20251001':  { inputPer1K: 0.000233, outputPer1K: 0.001163 }, // $0.25/$1.25 per M
  'gpt-4o-mini':                { inputPer1K: 0.000140, outputPer1K: 0.000558 }, // $0.15/$0.60 per M
  'claude-sonnet-4-5-20250929': { inputPer1K: 0.002790, outputPer1K: 0.013950 }, // $3/$15 per M
  'gpt-4o':                     { inputPer1K: 0.004650, outputPer1K: 0.013950 }, // $5/$15 per M
  'gemini-1.5-pro':             { inputPer1K: 0.001163, outputPer1K: 0.004650 }, // $1.25/$5 per M
  'claude-opus-4-5-20251101':   { inputPer1K: 0.013950, outputPer1K: 0.069750 }, // $15/$75 per M
};
