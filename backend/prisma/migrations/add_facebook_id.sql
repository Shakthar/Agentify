-- Migration: adiciona facebookId ao Tenant, para "Continuar com Facebook"
-- (login/registo na plataforma + associação de conta na aba de Perfil)
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "facebookId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_facebookId_key" ON "Tenant"("facebookId");
