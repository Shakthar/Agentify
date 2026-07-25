-- Migration: Customer identity unification + cross-channel + message dedup
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Customer table (unified identity across channels)
CREATE TABLE IF NOT EXISTS "Customer" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "phone"       TEXT,
  "email"       TEXT,
  "name"        TEXT,
  "externalIds" JSONB,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_phone_key" ON "Customer"("tenantId", "phone") WHERE "phone" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_email_key" ON "Customer"("tenantId", "email") WHERE "email" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer"("email");

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 2. Add customerId + channels to Conversation
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "channels"   TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Conversation_customerId_idx" ON "Conversation"("customerId");

-- 3. Add channelMessageId to Message (deduplication)
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "channelMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "Message_channelMessageId_idx" ON "Message"("channelMessageId");
