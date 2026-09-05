-- Migration: Channel schedules (WhatsApp & Instagram)
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Schedule JSON structure:
-- { "enabled": true, "timezone": "Europe/Lisbon",
--   "weekdays": { "start": "18:00", "end": "08:59" },  -- null = always active
--   "weekends": null }                                   -- null = always active

ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "whatsappSchedule"  JSONB,
  ADD COLUMN IF NOT EXISTS "instagramSchedule" JSONB;
