-- Cobrança em BRL (planos Brasil) — out/2026
-- Tenant.billingCurrency define preço e créditos do plano (EUR ou BRL)
-- PlatformInvoice.currency guarda a moeda de cada fatura

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "billingCurrency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "PlatformInvoice"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
