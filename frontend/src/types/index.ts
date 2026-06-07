export interface Tenant {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  plan: Plan;
  creditsTotal: number;
  creditsUsed: number;
  createdAt: string;
  isAdmin?: boolean;
  // Profile / billing
  phone?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressCity?: string;
  addressCountry?: string;
  addressZip?: string;
  // White-label
  brandColor?: string;
  logoUrl?: string;
  domain?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  webChatEnabled: boolean;
  whitelabelEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappNumber?: string;
  notifyPhone?: string;
  emailEnabled: boolean;
  skillHandoff: boolean;
  skillDataCollection: boolean;
  skillScheduling: boolean;
  skillFileUpload: boolean;
  skillHumorDetection: boolean;
  totalConversations: number;
  totalMessages: number;
  averageResolution: number;
  offHoursMessage?: string;
  offHourStart?: string;
  offHourEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens: number;
  timestamp: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  channelType: string;
  visitorId?: string;
  sentiment?: number;
  urgency?: string;
  resolved: boolean;
  handedOffToHuman: boolean;
  tokensUsed: number;
  creditsUsed: number;
  createdAt: string;
  closedAt?: string;
  agent?: { name: string };
  messages?: Message[];
  _count?: { messages: number };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: unknown;
  createdAt: string;
}

export interface AdminMetrics {
  agents: { total: number; active: number };
  conversations: { total: number; today: number; open: number };
  messages: { total: number };
  credits: { total: number; used: number; available: number; usedPercent: number };
}

export interface PlatformExpense {
  id: string;
  category: string;
  description: string;
  amount: number;
  recurring: boolean;
  period: string;
  createdAt: string;
}

export interface PlatformMetrics {
  tenants: { total: number; byPlan: Record<string, number> };
  agents: { total: number; active: number };
  conversations: { total: number; today: number };
  messages: { total: number };
  revenue: { mrr: number; arr: number };
  expenses: { monthly: number; items: PlatformExpense[] };
  usage: {
    creditsConsumed: number;  // créditos internos consumidos (todos os tenants)
    inputTokens: number;      // tokens reais enviados ao LLM
    outputTokens: number;     // tokens reais recebidos do LLM
    realApiCostEur: number;   // custo real EUR pago à Anthropic/OpenAI
  };
  balance: number;
}

export interface CreditLog {
  id: string;
  amount: number;
  reason: string;
  details?: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  tenant?: Tenant;
  // signup returns these at root level
  id?: string;
  email?: string;
  name?: string;
  plan?: string;
  creditsTotal?: number;
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
  notifyPhone?: string;
  webChatEnabled?: boolean;
  whitelabelEnabled?: boolean;
  emailEnabled?: boolean;
  offHoursMessage?: string;
  offHourStart?: string;
  offHourEnd?: string;
}

export type Plan = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export const PLAN_COLORS: Record<Plan, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  business: 'bg-orange-100 text-orange-700',
  enterprise: 'bg-green-100 text-green-700',
};

export const MODEL_LABELS: Record<string, string> = {
  'claude-haiku-4-5-20251001':  'Claude Haiku 4.5',
  'gpt-4o-mini':                'GPT-4o Mini',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'gpt-4o':                     'GPT-4o',
  'gemini-1.5-pro':             'Gemini 1.5 Pro',
  'claude-opus-4-5-20251101':   'Claude Opus 4.5',
};
