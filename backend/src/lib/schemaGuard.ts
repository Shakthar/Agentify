/**
 * Garante colunas novas na DB antes de o servidor aceitar pedidos.
 * Idempotente (ADD COLUMN IF NOT EXISTS) — espelha backend/prisma/migrations/add_billing_currency.sql,
 * para que um deploy nunca arranque com o Prisma a pedir colunas que ainda não existem.
 */
import prisma from './prisma.js';

const STATEMENTS = [
  `ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingCurrency" TEXT NOT NULL DEFAULT 'EUR'`,
  `ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR'`,
];

export async function ensureSchema(): Promise<void> {
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.error('[Schema] Falha ao aplicar:', sql, (e as Error).message);
    }
  }
  console.log('[Schema] Colunas de billing verificadas');
}
