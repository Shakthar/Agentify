/**
 * Tabela de preços Agentfy (out/2026) — fonte única para o frontend.
 * Espelha backend/src/lib/platformConfig.ts (defaultConfig, PRICING_VERSION 2).
 * Planos calculados para 40% de margem bruta: backend/scripts/pricing-model.mjs
 */
export type Currency = 'EUR' | 'BRL';
export type PlanId = 'free' | 'starter' | 'business' | 'enterprise';

export const PLAN_PRICING: Record<PlanId, { agents: number; EUR: { price: number; credits: number }; BRL: { price: number; credits: number } }> = {
  free:       { agents: 1,  EUR: { price: 0,   credits: 1000 },   BRL: { price: 0,    credits: 1000 } },
  starter:    { agents: 1,  EUR: { price: 49,  credits: 18000 },  BRL: { price: 197,  credits: 12500 } },
  business:   { agents: 3,  EUR: { price: 129, credits: 49000 },  BRL: { price: 497,  credits: 33000 } },
  enterprise: { agents: 10, EUR: { price: 349, credits: 134000 }, BRL: { price: 1297, credits: 88000 } },
};

/** Pacote de 5.000 créditos extra, por plano. */
export const TOP_UP: Record<Exclude<PlanId, 'free'>, { credits: number; EUR: number; BRL: number }> = {
  starter:    { credits: 5000, EUR: 16, BRL: 89 },
  business:   { credits: 5000, EUR: 15, BRL: 84 },
  enterprise: { credits: 5000, EUR: 14, BRL: 79 },
};

/** Média usada para estimar conversas (3-5 trocas, auto-routing, com base de conhecimento). */
export const CREDITS_PER_CONVERSATION = 40;

export function estConversations(credits: number): number {
  const n = credits / CREDITS_PER_CONVERSATION;
  if (n >= 1000) return Math.round(n / 50) * 50;
  if (n >= 100) return Math.round(n / 10) * 10;
  return Math.round(n / 5) * 5;
}

/** Preço de um add-on na moeda pedida. Add-ons são definidos em € e têm preço próprio em R$. */
export function addonPrice(eur: number, currency: Currency): number {
  if (currency === 'EUR') return eur;
  return Math.ceil((eur * 4) / 10) * 10 - 1; // €4→R$19 · €7→R$29 · €9→R$39 · €12→R$49 · €15→R$59 · €18→R$79 · €25→R$99 · €30→R$119
}

export function money(amount: number, currency: Currency, decimals = 0): string {
  const s = amount.toLocaleString(currency === 'BRL' ? 'pt-BR' : 'pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return currency === 'BRL' ? `R$${s}` : `€${s}`;
}

export function num(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Preço por 1.000 créditos do plano. */
export function pricePer1k(plan: PlanId, currency: Currency): string {
  const p = PLAN_PRICING[plan][currency];
  if (!p.price) return '—';
  return money((p.price / p.credits) * 1000, currency, 2);
}

export function defaultCurrency(): Currency {
  if (typeof navigator !== 'undefined' && /^pt-BR/i.test(navigator.language)) return 'BRL';
  return 'EUR';
}
