-- Migration: mensagens fora-de-horário dedicadas por canal (Instagram/Telegram) +
-- schedule do Telegram. Corrige um bug em que Instagram reutilizava a mensagem
-- fora-de-horário do WhatsApp (offHoursMessage), sobrescrevendo-a.
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "instagramOffHoursMessage" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "telegramOffHoursMessage" TEXT;
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "telegramSchedule" JSONB;
