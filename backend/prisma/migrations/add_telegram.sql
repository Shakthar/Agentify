-- Migration: adiciona suporte ao Telegram como canal de mensagens (1 agente = 1 bot)
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "telegramEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "telegramBotToken" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "telegramWebhookSecret" TEXT;
