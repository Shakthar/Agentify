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
  price?: number;        // €/mês se addon (ou €/agente/mês para whitelabel)
  creditsPerTx?: number; // créditos por transação (skill payments)
}

export interface PricingConfig {
  plans: Record<string, { price: number; credits: number; agents: number }>;
  features: {
    scheduling:     Record<string, FeaturePlanConfig>;
    fileUpload:     Record<string, FeaturePlanConfig>;
    humorDetection: Record<string, FeaturePlanConfig>;
    payments:       Record<string, FeaturePlanConfig>; // price=mensalidade, creditsPerTx=créditos/tx
    whitelabel:     Record<string, FeaturePlanConfig>; // price=€/agente/mês
  };
}

export function defaultConfig(): PricingConfig {
  return {
    plans: {
      free:       { price: 0,   credits: 3000,  agents: 3   },
      starter:    { price: 39,  credits: 10000, agents: 10  },
      pro:        { price: 89,  credits: 30000, agents: 20  },
      business:   { price: 159, credits: 60000, agents: 30  },
      enterprise: { price: 259, credits: 75000, agents: 999 },
    },
    features: {
      scheduling: {
        free:       { mode: 'addon',    price: 7 },
        starter:    { mode: 'included' },
        pro:        { mode: 'included' },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      fileUpload: {
        free:       { mode: 'addon',    price: 5 },
        starter:    { mode: 'included' },
        pro:        { mode: 'included' },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      humorDetection: {
        free:       { mode: 'addon',    price: 9 },
        starter:    { mode: 'addon',    price: 9 },
        pro:        { mode: 'included' },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
      payments: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 25, creditsPerTx: 50 },
        pro:        { mode: 'addon',    price: 15, creditsPerTx: 35 },
        business:   { mode: 'addon',    price: 5,  creditsPerTx: 20 },
        enterprise: { mode: 'included',            creditsPerTx: 10 },
      },
      whitelabel: {
        free:       { mode: 'disabled' },
        starter:    { mode: 'addon',    price: 5 },
        pro:        { mode: 'addon',    price: 3 },
        business:   { mode: 'included' },
        enterprise: { mode: 'included' },
      },
    },
  };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _config: PricingConfig = defaultConfig();

export function getConfig(): PricingConfig {
  return _config;
}

export async function loadConfigFromDB(): Promise<void> {
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: 'pricing' } });
    if (row?.value) {
      _config = deepMerge(defaultConfig(), row.value as Partial<PricingConfig>) as PricingConfig;
      syncToPlanLimits();
      console.log('[Config] Preços carregados da DB');
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
  const plans = ['free', 'starter', 'pro', 'business', 'enterprise'] as const;
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

import prisma from './prisma.js';
import { PLAN_LIMITS } from '../types/index.js';

export interface PricingConfig {
  plans: {
    free:       { price: number; credits: number; agents: number };
    starter:    { price: number; credits: number; agents: number };
    pro:        { price: number; credits: number; agents: number };
    business:   { price: number; credits: number; agents: number };
    enterprise: { price: number; credits: number; agents: number };
  };
  skillAddons: {
    scheduling:     number; // €/mês addon plano Free
    fileUpload:     number; // €/mês addon plano Free
    humorDetection: number; // €/mês addon plano Free + Starter
  };
  payments: {
    monthlyFee:  { free: null; starter: number; pro: number; business: number; enterprise: number | null };
    creditsPerTx: { free: null; starter: number; pro: number; business: number; enterprise: number };
  };
  whitelabel: {
    starterPerAgent: number; // €/agente/mês
    proPerAgent:     number; // €/agente/mês
  };
}

export function defaultConfig(): PricingConfig {
  return {
    plans: {
      free:       { price: 0,   credits: 3000,  agents: 3   },
      starter:    { price: 39,  credits: 10000, agents: 10  },
      pro:        { price: 89,  credits: 30000, agents: 20  },
      business:   { price: 159, credits: 60000, agents: 30  },
      enterprise: { price: 259, credits: 75000, agents: 999 },
    },
    skillAddons: {
      scheduling:     7,
      fileUpload:     5,
      humorDetection: 9,
    },
    payments: {
      monthlyFee:  { free: null, starter: 25, pro: 15, business: 5, enterprise: null },
      creditsPerTx: { free: null, starter: 50, pro: 35, business: 20, enterprise: 10 },
    },
    whitelabel: {
      starterPerAgent: 5,
      proPerAgent:     3,
    },
  };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _config: PricingConfig = defaultConfig();

export function getConfig(): PricingConfig {
  return _config;
}

export async function loadConfigFromDB(): Promise<void> {
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: 'pricing' } });
    if (row?.value) {
      const loaded = row.value as Partial<PricingConfig>;
      _config = deepMerge(defaultConfig(), loaded) as PricingConfig;
      syncToPlanLimits();
      console.log('[Config] Preços carregados da DB');
    } else {
      // Primeira execução — guardar defaults
      await prisma.platformConfig.create({ data: { key: 'pricing', value: _config as object } });
      console.log('[Config] Defaults de preços guardados na DB');
    }
  } catch (e) {
    console.warn('[Config] Falha ao carregar config, a usar defaults:', (e as Error).message);
  }
}

export async function saveConfig(updates: Partial<PricingConfig>): Promise<PricingConfig> {
  _config = deepMerge(_config, updates) as PricingConfig;
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
  const plans = ['free', 'starter', 'pro', 'business', 'enterprise'] as const;
  for (const plan of plans) {
    const p = _config.plans[plan];
    const pmt = _config.payments;
    if (PLAN_LIMITS[plan]) {
      PLAN_LIMITS[plan].credits          = p.credits;
      PLAN_LIMITS[plan].agents           = p.agents;
      PLAN_LIMITS[plan].paymentSkillCost = pmt.creditsPerTx[plan] ?? null;
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
