-- Migration: suporte ao Instagram API with Instagram Login (substitui o fluxo antigo via Login do Facebook)
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "instagramTokenExpiresAt" TIMESTAMP(3);
