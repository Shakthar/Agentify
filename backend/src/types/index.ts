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
    billingCurrency: string;
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
 * Limites por plano (valores EUR). Os valores reais são sincronizados a partir de
 * platformConfig (getConfig) no arranque — ver lib/platformConfig.ts.
 * - free: 1.000 créditos concedidos UMA VEZ no signup, nunca resetam.
 * - starter/business/enterprise: créditos resetam a cada pagamento mensal.
 * - Tenants em BRL têm os mesmos créditos; o preço em R$ é € × câmbio (platformConfig.eurToBrl).
 *
 * 1 Agente = 1 Número WhatsApp (relação 1:1)
 * Modelo de custos e margem (40% bruta): backend/scripts/pricing-model.mjs
 */
export const PLAN_LIMITS: Record<Plan, { agents: number; credits: number; conversations: number; paymentSkillCost: number | null }> = {
  free:       { agents: 1,  credits: 1000,   conversations: Infinity, paymentSkillCost: null },
  starter:    { agents: 1,  credits: 18000,  conversations: Infinity, paymentSkillCost: 50   },
  business:   { agents: 3,  credits: 49000,  conversations: Infinity, paymentSkillCost: 20   },
  enterprise: { agents: 10, credits: 134000, conversations: Infinity, paymentSkillCost: 10   },
};

export const ALLOWED_MODELS: Record<Plan, string[]> = {
  free:       ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini'],
  starter:    ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929'],
  business:   ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'gpt-4o'],
  enterprise: ['auto', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'gpt-4o', 'claude-opus-4-5-20251101'],
};

/**
 * Multiplicador de créditos por 1.000 tokens. Alinhado ao custo real de cada modelo
 * face ao Haiku 4.5 (mix 85% input / 15% output), para o custo por crédito ser ~igual
 * em todos os modelos (≈ €0,0015) e a margem se manter em qualquer escolha.
 *   Haiku $1/$5 → 1 · Sonnet $3/$15 → 3 · Opus $5/$25 → 5 · GPT-4o $2,50/$10 → 3 (arred. p/ cima) · GPT-4o mini → 1 (mínimo)
 */
export const TOKEN_COSTS: Record<string, number> = {
  'claude-haiku-4-5-20251001':  1,
  'gpt-4o-mini':                1,
  'claude-sonnet-4-5-20250929': 3,
  'gpt-4o':                     3,
  'claude-opus-4-5-20251101':   5,
};

/**
 * Custo real da API em EUR por 1 000 tokens (input e output separados).
 * Preços oficiais dos fornecedores (USD × 0.93 ≈ EUR, conservador), out/2026.
 * inputPer1K  = custo por 1 K tokens de entrada (prompt)
 * outputPer1K = custo por 1 K tokens de saída (completion)
 */
export const API_EUR_COST: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  'claude-haiku-4-5-20251001':  { inputPer1K: 0.000930, outputPer1K: 0.004650 }, // $1/$5 per M
  'gpt-4o-mini':                { inputPer1K: 0.000140, outputPer1K: 0.000558 }, // $0.15/$0.60 per M
  'claude-sonnet-4-5-20250929': { inputPer1K: 0.002790, outputPer1K: 0.013950 }, // $3/$15 per M
  'gpt-4o':                     { inputPer1K: 0.002325, outputPer1K: 0.009300 }, // $2.50/$10 per M
  'claude-opus-4-5-20251101':   { inputPer1K: 0.004650, outputPer1K: 0.023250 }, // $5/$25 per M
};
