/**
 * Configuração dinâmica da plataforma — preços, limites e feature flags.
 * Armazenada na tabela PlatformConfig (chave 'pricing').
 * Em memória: carregada no startup e atualizada quando o superadmin edita.
 */
import prisma from './prisma.js';
import { PLAN_LIMITS } from '../types/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FeaturePlanConfig {
  mode: 'disabled' | 'addon' | 'included'; // disabled = sem acesso, addon = cobra extra, included = incluído no plano
  price?: number;        // €/mês se addon (ou €/agente/mês para whitelabel e agentes extra)
  creditsPerTx?: number; // créditos por transação (skill payments)
}

export interface PlanConfig {
  price: number;       // € / mês (sem IVA) — base; o preço em R$ é derivado (eurToBrl)
  credits: number;     // créditos / mês (iguais em € e R$)
  agents: number;      // agentes (1 agente = 1 número WhatsApp)
  priceBRL?: number;   // obsoleto (v2) — ignorado
  creditsBRL?: number; // obsoleto (v2) — ignorado
}

export interface TopUpConfig { credits: number; price: number; priceBRL?: number }

export type Currency = 'EUR' | 'BRL';

export interface PricingConfig {
  version: number;
  fx: { BRLperEUR: number };
  plans: Record<string, PlanConfig>;
  topUp: Record<string, TopUpConfig>; // pacote de créditos extra por plano
  features: {
    scheduling:     Record<string, FeaturePlanConfig>;
    fileUpload:     Record<string, FeaturePlanConfig>;
    humorDetection: Record<string, FeaturePlanConfig>;
    payments:       Record<string, FeaturePlanConfig>; // price=mensalidade, creditsPerTx=créditos/tx
    whitelabel:     Record<string, FeaturePlanConfig>; // price=€/agente/mês
    vendas:         Record<string, FeaturePlanConfig>; // bundle com Pedidos/KDS
    feedback:       Record<string, FeaturePlanConfig>;
    analytics:      Record<string, FeaturePlanConfig>;
    leadGen:        Record<string, FeaturePlanConfig>;
    customSkills:   Record<string, FeaturePlanConfig>;
    extraAgents:    Record<string, FeaturePlanConfig>; // price=€/agente/mês
  };
}

/**
 * Versão da tabela de preços. Ao subir este número, a config guardada na DB é
 * substituída pelos defaults no próximo arranque (as edições do superadmin feitas
 * depois disso voltam a ser respeitadas até à próxima subida de versão).
 * v2 (out/2026): planos recalculados para 40% de margem bruta + tabela BRL.
 * v3 (out/2026): € é a base — R$ = € × câmbio (arredondado p/ cima até final 9), mesmos créditos;
 *                Vendas+Delivery €25/€20/€15; Análises €20/€15; Custom Skills €20 no Enterprise.
 */
export const PRICING_VERSION = 3;

/** € → R$: câmbio e arredondamento para cima até ao próximo valor terminado em 9 (€25 → R$149). */
export function eurToBrl(eur: number, rate = _config?.fx?.BRLperEUR ?? 5.61): number {
  if (eur <= 0) return 0;
  return Math.ceil((eur * rate + 1) / 10) * 10 - 1;
}

/**
 * Créditos calculados com backend/scripts/pricing-model.mjs para margem bruta de 40%
 * no pior caso (cliente consome 100% dos créditos). Custo de 1 crédito ≈ €0,0015.
 */
export function defaultConfig(): PricingConfig {
  return {
    version: PRICING_VERSION,
    fx: { BRLperEUR: 5.61 }, // PTAX 14/10/2026 — usado só para relatórios (MRR em €)
    plans: {
      // FREE: 1.000 créditos concedidos UMA VEZ no signup (não renovam)
      free:       { price: 0,   credits: 1000,   agents: 1  },
      starter:    { price: 49,  credits: 18000,  agents: 1  },
      business:   { price: 129, credits: 49000,  agents: 3  },
      enterprise: { price: 349, credits: 134000, agents: 10 },
    },
    topUp: {
      starter:    { credits: 5000, price: 16 },
      business:   { credits: 5000, price: 15 },
      enterprise: { credits: 5000, price: 14 },
    },
    // Add-ons — espelham a tabela da página Planos & Addons (frontend/src/utils/pricing.ts)
    features: {
      scheduling: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 7 },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      fileUpload: {
        free:       { mode: 'addon',    price: 8 },
        starter:    { mode: 'included' },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      humorDetection: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 9 },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      payments: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 15, creditsPerTx: 50 },
        business:   { mode: 'included',            creditsPerTx: 20 },
        enterprise: { mode: 'included',            creditsPerTx: 10 },
      },
      whitelabel: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 5 },
        business:   { mode: 'addon',    price: 3 },
        enterprise: { mode: 'included' },
      },
      // Vendas + Delivery/Pedidos + KDS
      vendas: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 25 },
        business:   { mode: 'addon',    price: 20 },
        enterprise: { mode: 'addon',    price: 15 },
      },
      feedback: {
        free:       { mode: 'addon',    price: 4 },
        starter:    { mode: 'addon',    price: 4 },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      analytics: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 20 },
        business:   { mode: 'addon',    price: 15 },
        enterprise: { mode: 'included' },
      },
      leadGen: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'disabled' },
        business:   { mode: 'addon',    price: 25 },
        enterprise: { mode: 'included' },
      },
      customSkills: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'disabled' },
        business:   { mode: 'addon',    price: 30 },
        enterprise: { mode: 'addon',    price: 20 },
      },
      extraAgents: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 20 },
        business:   { mode: 'addon',    price: 15 },
        enterprise: { mode: 'addon',    price: 10 },
      },
    },
  };
}

/** Preço e créditos de um plano na moeda do tenant. */
export function planTerms(plan: string, currency: Currency | string = 'EUR'): { price: number; credits: number; currency: Currency } {
  const p = _config.plans[plan];
  if (!p) return { price: 0, credits: 0, currency: currency === 'BRL' ? 'BRL' : 'EUR' };
  return currency === 'BRL'
    ? { price: eurToBrl(p.price), credits: p.credits, currency: 'BRL' }
    : { price: p.price, credits: p.credits, currency: 'EUR' };
}

/** Converte um valor para EUR (relatórios). */
export function toEur(amount: number, currency: Currency | string = 'EUR'): number {
  return currency === 'BRL' ? amount / (_config.fx?.BRLperEUR || 5.61) : amount;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _config: PricingConfig = defaultConfig();

export function getConfig(): PricingConfig {
  return _config;
}

export async function loadConfigFromDB(): Promise<void> {
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: 'pricing' } });
    const stored = row?.value as Partial<PricingConfig> | undefined;
    if (stored && (stored.version ?? 1) >= PRICING_VERSION) {
      _config = deepMerge(defaultConfig(), stored) as PricingConfig;
      syncToPlanLimits();
      console.log('[Config] Preços carregados da DB');
    } else if (stored) {
      // Tabela de preços antiga → substituir pelos defaults da versão atual
      _config = defaultConfig();
      await prisma.platformConfig.update({ where: { key: 'pricing' }, data: { value: _config as object } });
      syncToPlanLimits();
      console.log(`[Config] Tabela de preços v${stored.version ?? 1} substituída pela v${PRICING_VERSION}`);
    } else {
      await prisma.platformConfig.create({ data: { key: 'pricing', value: _config as object } });
      console.log('[Config] Defaults de preços guardados na DB');
    }
  } catch (e) {
    console.warn('[Config] Falha ao carregar config, a usar defaults:', (e as Error).message);
  }
}

export async function saveConfig(updates: Partial<PricingConfig>): Promise<PricingConfig> {
  _config = deepMerge(_config, updates) as PricingConfig;
  _config.version = PRICING_VERSION;
  await prisma.platformConfig.upsert({
    where:  { key: 'pricing' },
    update: { value: _config as object },
    create: { key: 'pricing', value: _config as object },
  });
  syncToPlanLimits();
  return _config;
}

// ─── Sync para PLAN_LIMITS (retrocompatibilidade) ─────────────────────────────
function syncToPlanLimits(): void {
  const plans = ['free', 'starter', 'business', 'enterprise'] as const;
  for (const plan of plans) {
    const p = _config.plans[plan];
    const pmt = _config.features.payments[plan];
    if (PLAN_LIMITS[plan]) {
      PLAN_LIMITS[plan].credits = p.credits;
      PLAN_LIMITS[plan].agents  = p.agents;
      // paymentSkillCost: null se disabled, creditsPerTx se addon/included
      PLAN_LIMITS[plan].paymentSkillCost =
        pmt?.mode === 'disabled' ? null : (pmt?.creditsPerTx ?? null);
    }
  }
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function deepMerge(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return override ?? base;
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge((base as Record<string, unknown>)[key], (override as Record<string, unknown>)[key]);
  }
  return result;
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
