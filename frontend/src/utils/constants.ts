export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

export const ROUTES = {
  home: '/',
  login: '/',
  dashboard: '/dashboard',
  agents: '/dashboard/agents',
  createAgent: '/dashboard/create',
  agentDetail: (id: string) => `/dashboard/${id}`,
  billing: '/dashboard/billing',
  admin: '/dashboard/admin',
  settings: '/dashboard/settings',
} as const;

export const CREDIT_ALERT_THRESHOLDS = [70, 80, 90] as const;

export const AVAILABLE_MODELS_BY_PLAN: Record<string, { value: string; label: string }[]> = {
  free: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rapido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rapido)' },
  ],
  starter: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rapido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rapido)' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (recomendado)' },
  ],
  pro: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rapido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rapido)' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o (avancado)' },
  ],
  business: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rapido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rapido)' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o (avancado)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  enterprise: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (rapido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rapido)' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o (avancado)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (exclusivo)' },
  ],
};
