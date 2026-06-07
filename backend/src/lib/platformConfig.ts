/**
 * Configuração dinâmica da plataforma — preços, limites e feature flags.
 * Armazenada na tabela PlatformConfig (chave 'pricing').
 * Em memória: carregada no startup e atualizada quando o superadmin edita.
 * Retrocompatível com PLAN_LIMITS — as mudanças são refletidas nele.
 */
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
