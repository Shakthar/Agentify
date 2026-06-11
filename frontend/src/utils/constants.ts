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
  starter:    50,    // 50 créditos/transação (addon €15/mês)
  business:   20,    // 20 créditos/transação (incluído no plano)
  enterprise: 10,    // 10 créditos/transação (incluído no plano)
};

// Créditos mensais e preço por plano (usado em vários componentes)
export const PLAN_CREDITS: Record<string, number> = {
  free:       1000,
  starter:    5000,
  business:   15000,
  enterprise: 40000,
};

export const PLAN_PRICE: Record<string, number> = {
  free:       0,
  starter:    59,
  business:   159,
  enterprise: 399,
};

export const PLAN_AGENTS: Record<string, number> = {
  free:       1,
  starter:    1,
  business:   3,
  enterprise: 10,
};

// Custo por crédito por plano (€)
export const CREDIT_COST_EUR: Record<string, number> = {
  free:       0,       // gratuito
  starter:    0.0118,  // €59 / 5.000
  business:   0.0106,  // €159 / 15.000
  enterprise: 0.00998, // €399 / 40.000
};

export const AVAILABLE_MODELS_BY_PLAN: Record<string, { value: string; label: string; description: string; badge?: string }[]> = {
  free: [
    { value: 'auto',                      label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',               label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
  ],
  starter: [
    { value: 'auto',                       label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',                label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',       description: 'Respostas mais elaboradas e contexto mais longo' },
  ],
  business: [
    { value: 'auto',                       label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',                label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',       description: 'Respostas mais elaboradas e contexto mais longo' },
    { value: 'gpt-4o',                     label: 'GPT-4o',                  description: 'Modelo OpenAI avançado para tarefas complexas' },
    { value: 'gemini-1.5-pro',             label: 'Gemini 1.5 Pro',          description: 'Google — janela de contexto de 1M tokens' },
  ],
  enterprise: [
    { value: 'auto',                       label: '⚡ Automático',            description: 'Escolhe o modelo ideal para cada conversa automaticamente', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',        description: 'Rápido e eficiente — ideal para FAQs e suporte simples' },
    { value: 'gpt-4o-mini',                label: 'GPT-4o Mini',             description: 'Modelo OpenAI leve e rápido' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5',       description: 'Respostas mais elaboradas e contexto mais longo' },
    { value: 'gpt-4o',                     label: 'GPT-4o',                  description: 'Modelo OpenAI avançado para tarefas complexas' },
    { value: 'gemini-1.5-pro',             label: 'Gemini 1.5 Pro',          description: 'Google — janela de contexto de 1M tokens' },
    { value: 'claude-opus-4-5-20251101',   label: 'Claude Opus 4.5',         description: 'Máxima inteligência — exclusivo Enterprise', badge: 'Premium' },
  ],
};
