export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const ROUTES = {
  home: '/',
  login: '/',
  dashboard: '/dashboard',
  agents: '/dashboard/agents',
  createAgent: '/dashboard/create',
  agentDetail: (id: string) => `/dashboard/${id}`,
  billing: '/dashboard/billing',
  analytics: '/dashboard/analytics',
} as const;

export const CREDIT_ALERT_THRESHOLDS = [70, 80, 90] as const;

export const AVAILABLE_MODELS_BY_PLAN: Record<string, { value: string; label: string }[]> = {
  free: [
    { value: 'claude-haiku-3', label: 'Claude Haiku 3 (rápido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
  ],
  starter: [
    { value: 'claude-haiku-3', label: 'Claude Haiku 3 (rápido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (recomendado)' },
  ],
  pro: [
    { value: 'claude-haiku-3', label: 'Claude Haiku 3 (rápido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o (avançado)' },
  ],
  business: [
    { value: 'claude-haiku-3', label: 'Claude Haiku 3 (rápido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o (avançado)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  enterprise: [
    { value: 'claude-haiku-3', label: 'Claude Haiku 3 (rápido)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o (avançado)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'claude-opus-4', label: 'Claude Opus 4 (exclusivo)' },
  ],
};
