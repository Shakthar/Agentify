/**
 * Tabela de preços Agentfy (out/2026) — fonte única para o frontend.
 * Espelha backend/src/lib/platformConfig.ts (defaultConfig, PRICING_VERSION 3).
 * O EURO é a base: os preços em R$ são sempre € × câmbio, arredondados para cima
 * até ao próximo valor terminado em 9 (ex.: €25 × 5,61 = R$140,25 → R$149).
 * Os créditos são os mesmos em € e R$. Margem bruta ≥ 40%: backend/scripts/pricing-model.mjs
 */
export type Currency = 'EUR' | 'BRL';
export type PlanId = 'free' | 'starter' | 'business' | 'enterprise';

/** Câmbio usado para converter € → R$ (PTAX 14/10/2026). Manter igual a platformConfig.fx.BRLperEUR. */
export const BRL_PER_EUR = 5.61;

/** € → R$: câmbio e arredondamento para cima até ao próximo valor terminado em 9. */
export function eurToBrl(eur: number): number {
  if (eur <= 0) return 0;
  return Math.ceil((eur * BRL_PER_EUR + 1) / 10) * 10 - 1;
}

const PLAN_BASE: Record<PlanId, { agents: number; price: number; credits: number }> = {
  free:       { agents: 1,  price: 0,   credits: 1000 },
  starter:    { agents: 1,  price: 49,  credits: 18000 },
  business:   { agents: 3,  price: 129, credits: 49000 },
  enterprise: { agents: 10, price: 349, credits: 134000 },
};

export const PLAN_PRICING: Record<PlanId, { agents: number; EUR: { price: number; credits: number }; BRL: { price: number; credits: number } }> =
  Object.fromEntries(Object.entries(PLAN_BASE).map(([id, p]) => [id, {
    agents: p.agents,
    EUR: { price: p.price, credits: p.credits },
    BRL: { price: eurToBrl(p.price), credits: p.credits },
  }])) as never;

const TOP_UP_EUR: Record<Exclude<PlanId, 'free'>, number> = { starter: 16, business: 15, enterprise: 14 };

/** Pacote de 5.000 créditos extra, por plano. */
export const TOP_UP: Record<Exclude<PlanId, 'free'>, { credits: number; EUR: number; BRL: number }> =
  Object.fromEntries(Object.entries(TOP_UP_EUR).map(([id, eur]) => [id, { credits: 5000, EUR: eur, BRL: eurToBrl(eur) }])) as never;

/** Média usada para estimar conversas (3-5 trocas, auto-routing, com base de conhecimento). */
export const CREDITS_PER_CONVERSATION = 40;

export function estConversations(credits: number): number {
  const n = credits / CREDITS_PER_CONVERSATION;
  if (n >= 1000) return Math.round(n / 50) * 50;
  if (n >= 100) return Math.round(n / 10) * 10;
  return Math.round(n / 5) * 5;
}

/** Preço de um add-on (definido em €) na moeda pedida. */
export function addonPrice(eur: number, currency: Currency): number {
  return currency === 'EUR' ? eur : eurToBrl(eur);
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
