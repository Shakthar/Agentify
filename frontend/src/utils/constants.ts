export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

export const ROUTES = {
  home: '/',
  login: '/',
  dashboard: '/dashboard',
  agents: '/dashboard/agents',
  createAgent: '/dashboard/create',
  agentDetail: (id: string) => `/dashboard/${id}`,
  credits: '/dashboard/credits',
  plans: '/dashboard/plans',
  billing: '/dashboard/billing',
  admin: '/dashboard/admin',
  settings: '/dashboard/settings',
  profile: '/dashboard/profile',
  whitelabelDashboard: '/dashboard/whitelabel',
  ordersLive: '/dashboard/orders/live',
  whitelabel: (agentId: string) => `/w/${agentId}`,
  portal: (agentId: string) => `/w/${agentId}`, // alias kept for compat
} as const;

export const CREDIT_ALERT_THRESHOLDS = [70, 80, 90] as const;

export const PAYMENT_SKILL_COST: Record<string, number | null> = {
  free:       null,  // bloqueado
  starter:    25,    // 25 créditos/transação
  pro:        15,    // 15 créditos/transação
  business:   0,     // incluído
  enterprise: 0,     // incluído
};

export const AVAILABLE_MODELS_BY_PLAN: Record<string, { value: string; label: string; description: string; badge?: string }[]> = {
  free: [
    { value: 'auto',                    label: '⚡ Automático',             description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',             label: 'GPT-4o Mini',               description: 'Modelo OpenAI leve e rápido' },
  ],
  starter: [
    { value: 'auto',                      label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',               label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',      description: 'Respostas mais elaboradas e contexto mais longo' },
  ],
  pro: [
    { value: 'auto',                      label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',               label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',      description: 'Respostas mais elaboradas e contexto mais longo' },
    { value: 'gpt-4o',                    label: 'GPT-4o',                  description: 'Modelo OpenAI avançado para tarefas complexas' },
  ],
  business: [
    { value: 'auto',                      label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',               label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',      description: 'Respostas mais elaboradas e contexto mais longo' },
    { value: 'gpt-4o',                    label: 'GPT-4o',                  description: 'Modelo OpenAI avançado para tarefas complexas' },
    { value: 'gemini-1.5-pro',            label: 'Gemini 1.5 Pro',          description: 'Google — janela de contexto de 1M tokens' },
  ],
  enterprise: [
    { value: 'auto',                      label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',               label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',      description: 'Respostas mais elaboradas e contexto mais longo' },
    { value: 'gpt-4o',                    label: 'GPT-4o',                  description: 'Modelo OpenAI avançado para tarefas complexas' },
    { value: 'gemini-1.5-pro',            label: 'Gemini 1.5 Pro',          description: 'Google — janela de contexto de 1M tokens' },
    { value: 'claude-opus-4-5-20251101',  label: 'Claude Opus 4.5',         description: 'Máxima inteligência — exclusivo Enterprise', badge: 'Premium' },
  ],
};
