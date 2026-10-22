/**
 * Garante colunas novas na DB antes de o servidor aceitar pedidos.
 * Idempotente (ADD COLUMN IF NOT EXISTS) — espelha backend/prisma/migrations/add_billing_currency.sql,
 * para que um deploy nunca arranque com o Prisma a pedir colunas que ainda não existem.
 */
import prisma from './prisma.js';

const STATEMENTS = [
  `ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingCurrency" TEXT NOT NULL DEFAULT 'EUR'`,
  `ALTER TABLE "PlatformInvoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR'`,
  `CREATE TABLE IF NOT EXISTS "PageView" ("id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "path" VARCHAR(300) NOT NULL, "referrerHost" TEXT, "utmSource" TEXT, "utmMedium" TEXT, "utmCampaign" TEXT, "locale" TEXT, "country" VARCHAR(2), "device" TEXT NOT NULL, "visitorHash" TEXT NOT NULL, "isBot" BOOLEAN NOT NULL DEFAULT false, CONSTRAINT "PageView_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView"("path")`,
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
